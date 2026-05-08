import type {
  Project,
  Attribute,
  DesignRow,
  GenerationMethod,
  ScoreWeights,
} from './schema'
import { cellKey } from './validation'
import { dOptimalSearch } from './dOptimal'
import { firstViolation } from './constraints'

export const defaultScoreWeights: ScoreWeights = {
  balance: 1,
  correlation: 1,
  dominance: 50,
  overlap: 50,
}

export type GenerateInput = {
  numTasks: number
  numBlocks: number
  method: GenerationMethod
  iterations?: number
  multistarts?: number
  seed?: number
  weights?: ScoreWeights
}

export type GenerationResult = {
  rows: DesignRow[]
  numBlocks: number
  score: number
  metrics: {
    maxBalanceDeviationPct: number
    maxAbsCorrelation: number
    dominanceCount: number
    overlapCount: number
  }
  iterationsRun: number
  multistartsRun?: number
  dError?: number
  constraintFailures?: number
}

// xorshift32, deterministic when seeded
function makeRng(seed?: number) {
  let state = (seed ?? Math.floor(Math.random() * 0xffffffff)) | 0
  if (state === 0) state = 0xa5a5a5a5
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return ((state >>> 0) % 0xffffffff) / 0xffffffff
  }
}

function appliesToAlt(attr: Attribute, altId: string): boolean {
  return attr.appliesTo === 'all' || attr.appliesTo.includes(altId)
}

function levelScalar(attr: Attribute, levelId: string): number {
  const lvl = attr.levels.find((l) => l.id === levelId)
  if (!lvl) return 0
  if (attr.type === 'numeric') return Number(lvl.value)
  return lvl.position
}

function pearson(x: number[], y: number[]): number {
  const n = x.length
  if (n < 2) return 0
  let mx = 0
  let my = 0
  for (let i = 0; i < n; i++) {
    mx += x[i]
    my += y[i]
  }
  mx /= n
  my /= n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const ax = x[i] - mx
    const ay = y[i] - my
    num += ax * ay
    dx += ax * ax
    dy += ay * ay
  }
  const den = Math.sqrt(dx * dy)
  return den === 0 ? 0 : num / den
}

function generateRow(
  project: Project,
  taskId: number,
  block: number,
  rng: () => number,
): DesignRow {
  const cells: Record<string, string> = {}
  const altsActive = project.alternatives.filter((a) => !a.isOptOut)
  for (const alt of altsActive) {
    for (const attr of project.attributes) {
      if (!appliesToAlt(attr, alt.id)) continue
      if (attr.levels.length === 0) continue
      const idx = Math.floor(rng() * attr.levels.length)
      cells[cellKey(alt.id, attr.id)] = attr.levels[idx].id
    }
  }
  // Scenario context: one value per task, applied uniformly across alts.
  const context: Record<string, string> = {}
  for (const cv of project.contextVariables ?? []) {
    if (cv.levels.length === 0) continue
    const idx = Math.floor(rng() * cv.levels.length)
    context[cv.id] = cv.levels[idx].id
  }
  return { taskId, block, cells, context }
}

const MAX_CONSTRAINT_RETRIES = 200

// Retries until a constraint-satisfying row is found, or returns the last attempt
// flagged as failed. Failure count is tracked separately by the caller.
function generateValidRow(
  project: Project,
  taskId: number,
  block: number,
  rng: () => number,
): { row: DesignRow; failed: boolean } {
  const constraints = project.constraints
  if (!constraints || constraints.length === 0) {
    return { row: generateRow(project, taskId, block, rng), failed: false }
  }
  let row = generateRow(project, taskId, block, rng)
  for (let i = 0; i < MAX_CONSTRAINT_RETRIES; i++) {
    if (!firstViolation(row, project, constraints)) {
      return { row, failed: false }
    }
    row = generateRow(project, taskId, block, rng)
  }
  return { row, failed: true }
}

function randomRows(
  project: Project,
  numTasks: number,
  numBlocks: number,
  rng: () => number,
): { rows: DesignRow[]; failedTasks: number } {
  const rows: DesignRow[] = []
  let failedTasks = 0
  for (let i = 0; i < numTasks; i++) {
    const { row, failed } = generateValidRow(
      project,
      i + 1,
      (i % numBlocks) + 1,
      rng,
    )
    if (failed) failedTasks++
    rows.push(row)
  }
  return { rows, failedTasks }
}

function computeMetrics(
  project: Project,
  rows: DesignRow[],
): GenerationResult['metrics'] {
  const altsActive = project.alternatives.filter((a) => !a.isOptOut)

  // Balance: max % deviation across all attributes
  let maxBal = 0
  for (const attr of project.attributes) {
    const applicable = altsActive.filter((a) => appliesToAlt(attr, a.id))
    if (applicable.length === 0 || attr.levels.length < 2) continue
    const counts: Record<string, number> = {}
    for (const l of attr.levels) counts[l.id] = 0
    for (const row of rows) {
      for (const alt of applicable) {
        const lid = row.cells[cellKey(alt.id, attr.id)]
        if (lid && lid in counts) counts[lid]++
      }
    }
    const totalSlots = rows.length * applicable.length
    const ideal = totalSlots / attr.levels.length
    if (ideal === 0) continue
    for (const id in counts) {
      const dev = (Math.abs(counts[id] - ideal) / ideal) * 100
      if (dev > maxBal) maxBal = dev
    }
  }

  // Correlation: max |r| across within-alt attribute pairs
  let maxCorr = 0
  for (const alt of altsActive) {
    const attrs = project.attributes.filter((a) => appliesToAlt(a, alt.id))
    for (let i = 0; i < attrs.length; i++) {
      for (let j = i + 1; j < attrs.length; j++) {
        const A = attrs[i]
        const B = attrs[j]
        const xs: number[] = []
        const ys: number[] = []
        for (const row of rows) {
          const lA = row.cells[cellKey(alt.id, A.id)]
          const lB = row.cells[cellKey(alt.id, B.id)]
          if (!lA || !lB) continue
          xs.push(levelScalar(A, lA))
          ys.push(levelScalar(B, lB))
        }
        const r = Math.abs(pearson(xs, ys))
        if (r > maxCorr) maxCorr = r
      }
    }
  }

  // Dominance: count tasks where one alt dominates another
  let dominance = 0
  const directional = project.attributes.filter(
    (a) => a.preferenceDirection && a.preferenceDirection !== 'none',
  )
  for (const row of rows) {
    for (let i = 0; i < altsActive.length; i++) {
      for (let j = 0; j < altsActive.length; j++) {
        if (i === j) continue
        const A = altsActive[i]
        const B = altsActive[j]
        const common = directional.filter(
          (attr) => appliesToAlt(attr, A.id) && appliesToAlt(attr, B.id),
        )
        if (common.length === 0) continue
        let allAtLeast = true
        let strictBetter = false
        for (const attr of common) {
          const lA = row.cells[cellKey(A.id, attr.id)]
          const lB = row.cells[cellKey(B.id, attr.id)]
          if (!lA || !lB) {
            allAtLeast = false
            break
          }
          const sA = levelScalar(attr, lA)
          const sB = levelScalar(attr, lB)
          const dir = attr.preferenceDirection!
          const aWorse = dir === 'higher' ? sA < sB : sA > sB
          const aBetter = dir === 'higher' ? sA > sB : sA < sB
          if (aWorse) {
            allAtLeast = false
            break
          }
          if (aBetter) strictBetter = true
        }
        if (allAtLeast && strictBetter) dominance++
      }
    }
  }

  // Overlap: count tasks with two byte-identical alts
  let overlap = 0
  for (const row of rows) {
    for (let i = 0; i < altsActive.length; i++) {
      for (let j = i + 1; j < altsActive.length; j++) {
        const A = altsActive[i]
        const B = altsActive[j]
        const common = project.attributes.filter(
          (attr) => appliesToAlt(attr, A.id) && appliesToAlt(attr, B.id),
        )
        if (common.length === 0) continue
        const identical = common.every(
          (attr) =>
            row.cells[cellKey(A.id, attr.id)] === row.cells[cellKey(B.id, attr.id)],
        )
        if (identical) overlap++
      }
    }
  }

  return {
    maxBalanceDeviationPct: maxBal,
    maxAbsCorrelation: maxCorr,
    dominanceCount: dominance,
    overlapCount: overlap,
  }
}

function compositeScore(
  metrics: GenerationResult['metrics'],
  weights: ScoreWeights,
): number {
  return (
    weights.balance * metrics.maxBalanceDeviationPct +
    weights.correlation * metrics.maxAbsCorrelation * 100 +
    weights.dominance * metrics.dominanceCount +
    weights.overlap * metrics.overlapCount
  )
}

export function generateDesign(project: Project, input: GenerateInput): GenerationResult {
  const weights = input.weights ?? defaultScoreWeights
  const rng = makeRng(input.seed)

  if (input.method === 'd-optimal') {
    const result = dOptimalSearch(project, {
      numTasks: input.numTasks,
      numBlocks: input.numBlocks,
      multistarts: input.multistarts ?? 5,
      rng,
    })
    const metrics = computeMetrics(project, result.rows)
    return {
      rows: result.rows,
      numBlocks: input.numBlocks,
      score: compositeScore(metrics, weights),
      metrics,
      iterationsRun: result.totalPasses,
      multistartsRun: result.multistartsRun,
      dError: result.dError,
    }
  }

  if (input.method === 'random') {
    const { rows, failedTasks } = randomRows(project, input.numTasks, input.numBlocks, rng)
    const metrics = computeMetrics(project, rows)
    return {
      rows,
      numBlocks: input.numBlocks,
      score: compositeScore(metrics, weights),
      metrics,
      iterationsRun: 1,
      constraintFailures: failedTasks,
    }
  }

  // balanced search: K random candidates, keep best
  const k = input.iterations ?? 1000
  let bestRows: DesignRow[] | null = null
  let bestScore = Infinity
  let bestMetrics: GenerationResult['metrics'] | null = null
  let bestIter = 0
  let totalFailures = 0
  for (let i = 1; i <= k; i++) {
    const { rows, failedTasks } = randomRows(project, input.numTasks, input.numBlocks, rng)
    totalFailures += failedTasks
    const metrics = computeMetrics(project, rows)
    const score = compositeScore(metrics, weights)
    if (score < bestScore) {
      bestRows = rows
      bestScore = score
      bestMetrics = metrics
      bestIter = i
    }
  }
  return {
    rows: bestRows ?? [],
    numBlocks: input.numBlocks,
    score: bestScore,
    metrics:
      bestMetrics ?? {
        maxBalanceDeviationPct: 0,
        maxAbsCorrelation: 0,
        dominanceCount: 0,
        overlapCount: 0,
      },
    iterationsRun: bestIter,
    constraintFailures: totalFailures > 0 ? totalFailures : undefined,
  }
}

// Suggest task counts that allow perfect balance.
// Returns multiples of LCM(level counts) up to a sensible cap.
export function suggestNumTasks(project: Project): number[] {
  const counts = project.attributes
    .filter((a) => a.levels.length > 1)
    .map((a) => a.levels.length)
  if (counts.length === 0) return [4, 8, 12, 16, 24]
  const base = counts.reduce(lcmOf, 1)
  const cap = 64
  const out: number[] = []
  for (let m = 1; m * base <= cap; m++) {
    const v = m * base
    if (v >= 4) out.push(v)
    if (out.length >= 6) break
  }
  return out
}

function gcdOf(a: number, b: number): number {
  return b === 0 ? a : gcdOf(b, a % b)
}
function lcmOf(a: number, b: number): number {
  return (a * b) / gcdOf(a, b)
}
