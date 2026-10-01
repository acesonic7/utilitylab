import type {
  Project,
  Attribute,
  DesignRow,
  GenerationMethod,
  ScoreWeights,
} from './schema'
import { cellKey, dominance as dominanceOf } from './validation'
import { dOptimalSearch } from './dOptimal'
import { firstViolation } from './constraints'
import { clampBlocks } from './blocks'
import { findLevelInAttr, getLevelsForAlt } from './levelLookup'

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
  /** Called as the search advances; fraction runs from 0 to 1. Cheap to call often. */
  onProgress?: (p: GenerationProgress) => void
}

export type GenerationProgress = { fraction: number; label: string }

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
  /** Choice tasks in the design that still break a constraint; set only when there are some. */
  constraintFailures?: number
  // The seed actually used, so the run can be reproduced.
  seed: number
}

// Seeds are integers in [1, 2^32 − 1]; anything else is folded into that range.
export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 1
  return (Math.floor(Math.abs(seed)) % 0xffffffff) || 1
}

export function randomSeed(): number {
  return normalizeSeed(1 + Math.floor(Math.random() * 0xfffffffe))
}

// xorshift32, deterministic for a given seed
function makeRng(seed: number) {
  let state = seed | 0
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
  const lvl = findLevelInAttr(attr, levelId)
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
      const levels = getLevelsForAlt(attr, alt.id)
      if (levels.length === 0) continue
      const idx = Math.floor(rng() * levels.length)
      cells[cellKey(alt.id, attr.id)] = levels[idx].id
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

  // Balance: max % deviation per (alt, attr) when overrides exist; aggregated
  // across applicable alts when not.
  let maxBal = 0
  for (const attr of project.attributes) {
    const applicable = altsActive.filter((a) => appliesToAlt(attr, a.id))
    if (applicable.length === 0) continue
    const hasOverrides =
      !!attr.levelsByAlternative && Object.keys(attr.levelsByAlternative).length > 0
    if (hasOverrides) {
      for (const alt of applicable) {
        const altLevels = getLevelsForAlt(attr, alt.id)
        if (altLevels.length < 2) continue
        const counts: Record<string, number> = {}
        for (const l of altLevels) counts[l.id] = 0
        for (const row of rows) {
          const lid = row.cells[cellKey(alt.id, attr.id)]
          if (lid && lid in counts) counts[lid]++
        }
        const ideal = rows.length / altLevels.length
        if (ideal === 0) continue
        for (const id in counts) {
          const dev = (Math.abs(counts[id] - ideal) / ideal) * 100
          if (dev > maxBal) maxBal = dev
        }
      }
    } else {
      if (attr.levels.length < 2) continue
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

  // Dominance: the same rule as the Diagnostics check.
  let dominance = 0
  for (const row of rows) {
    for (const A of altsActive) {
      for (const B of altsActive) {
        if (A !== B && dominanceOf(project, row, A, B)) dominance++
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

export function generateDesign(project: Project, request: GenerateInput): GenerationResult {
  // Never more blocks than choice tasks, or some respondents would get an empty block.
  const numTasks = Math.max(1, Math.floor(Number.isFinite(request.numTasks) ? request.numTasks : 1))
  const input = { ...request, numTasks, numBlocks: clampBlocks(request.numBlocks, numTasks) }
  const weights = input.weights ?? defaultScoreWeights
  const seed = input.seed === undefined ? randomSeed() : normalizeSeed(input.seed)
  const rng = makeRng(seed)

  if (input.method === 'd-optimal') {
    const result = dOptimalSearch(project, {
      numTasks: input.numTasks,
      numBlocks: input.numBlocks,
      multistarts: input.multistarts ?? 5,
      rng,
      onProgress: input.onProgress,
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
      constraintFailures: result.violatingRows > 0 ? result.violatingRows : undefined,
      seed,
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
      constraintFailures: failedTasks > 0 ? failedTasks : undefined,
      seed,
    }
  }

  // balanced search: K random candidates, keep best
  const k = input.iterations ?? 1000
  let bestRows: DesignRow[] | null = null
  let bestScore = Infinity
  let bestMetrics: GenerationResult['metrics'] | null = null
  let bestIter = 0
  let bestFailures = Infinity
  for (let i = 1; i <= k; i++) {
    input.onProgress?.({ fraction: (i - 1) / k, label: `Candidate ${i} of ${k}` })
    const { rows, failedTasks } = randomRows(project, input.numTasks, input.numBlocks, rng)
    const metrics = computeMetrics(project, rows)
    const score = compositeScore(metrics, weights)
    // Honouring the constraints comes first; the score only ranks candidates that do equally well.
    if (failedTasks < bestFailures || (failedTasks === bestFailures && score < bestScore)) {
      bestRows = rows
      bestScore = score
      bestMetrics = metrics
      bestIter = i
      bestFailures = failedTasks
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
    constraintFailures: bestFailures > 0 && Number.isFinite(bestFailures) ? bestFailures : undefined,
    seed,
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
