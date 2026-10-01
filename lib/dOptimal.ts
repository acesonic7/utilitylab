import type { Project, Attribute, DesignRow } from './schema'
import { cellKey } from './validation'
import { logDetSPD, zeros, dot } from './linalg'
import { firstViolation, rowViolationCount, violatingRows } from './constraints'
import { findLevelInAttr, getLevelsForAlt } from './levelLookup'

// ── model ───────────────────────────────────────────────────────────────────
// MNL with dummy coding; the first level (lowest position) is the base.
//   - numeric:                 1 parameter, the raw value
//   - boolean / categorical:   K-1 parameters; base level → all zeros,
//                              level with index p (p≥1) → e_{p-1}
// Constants:
//   - with an opt-out: the opt-out is the zero-utility reference. Labeled designs get
//     one constant per designed alternative; unlabeled designs one shared constant.
//   - without an opt-out: labeled designs get a constant for every designed
//     alternative except the last one (the reference); unlabeled designs none.
// When an attribute does not apply to an alternative, its slice stays zero.

export const CODING = 'dummy' as const

export function paramCount(attr: Attribute): number {
  if (attr.type === 'numeric') return 1
  return Math.max(1, attr.levels.length - 1)
}

export type ParamLayout = {
  offsets: Record<string, number> // attrId → start index
  ascStart: number // start index of constants (-1 if none)
  ascCount: number
  // Designed alternatives with their own constant (labeled), in order of ascStart + i.
  ascAltIds: string[]
  // Unlabeled design with an opt-out: one constant shared by every designed alternative.
  sharedConstant: boolean
  optOutModelled: boolean
  totalK: number
}

function activeAlts(project: Project) {
  return project.alternatives.filter((a) => !a.isOptOut)
}

// Alternatives that enter the model: designed ones, then any opt-out (zero utility).
export function modelAlts(project: Project) {
  return [...activeAlts(project), ...project.alternatives.filter((a) => a.isOptOut)]
}

export function paramLayout(project: Project): ParamLayout {
  const active = activeAlts(project)
  const optOut = project.alternatives.some((a) => a.isOptOut)
  const labeled = project.experimentType === 'labeled'
  const ascAltIds = labeled ? (optOut ? active : active.slice(0, -1)).map((a) => a.id) : []
  const sharedConstant = !labeled && optOut && active.length > 0
  const ascCount = ascAltIds.length + (sharedConstant ? 1 : 0)
  const offsets: Record<string, number> = {}
  let k = ascCount
  for (const attr of project.attributes) {
    offsets[attr.id] = k
    k += paramCount(attr)
  }
  return {
    offsets,
    ascStart: ascCount > 0 ? 0 : -1,
    ascCount,
    ascAltIds,
    sharedConstant,
    optOutModelled: optOut,
    totalK: k,
  }
}

function sortedLevels(attr: Attribute) {
  return attr.levels.slice().sort((a, b) => a.position - b.position)
}

function encodeLevel(attr: Attribute, levelId: string): number[] {
  const lvl = findLevelInAttr(attr, levelId)
  if (!lvl) return new Array(paramCount(attr)).fill(0)
  if (attr.type === 'numeric') return [Number(lvl.value)]
  const levels = sortedLevels(attr)
  if (levels.length < 2) return [0]
  const vec = new Array(levels.length - 1).fill(0)
  const idx = levels.findIndex((l) => l.id === lvl.id)
  if (idx >= 1) vec[idx - 1] = 1
  return vec
}

function encodeAlt(project: Project, row: DesignRow, altId: string, layout: ParamLayout): number[] {
  const x = new Array(layout.totalK).fill(0)
  const alt = project.alternatives.find((a) => a.id === altId)
  if (!alt || alt.isOptOut) return x
  if (layout.sharedConstant) x[layout.ascStart] = 1
  const ascIdx = layout.ascAltIds.indexOf(altId)
  if (ascIdx >= 0) x[layout.ascStart + ascIdx] = 1
  for (const attr of project.attributes) {
    const applies = attr.appliesTo === 'all' || attr.appliesTo.includes(altId)
    if (!applies) continue
    const lid = row.cells[cellKey(altId, attr.id)]
    if (!lid) continue
    const enc = encodeLevel(attr, lid)
    const start = layout.offsets[attr.id]
    for (let j = 0; j < enc.length; j++) x[start + j] = enc[j]
  }
  return x
}

// One choice task's design matrix, coded exactly as the D-error codes it
// (designed alternatives in project order, then any opt-out).
export function encodeChoiceTask(
  project: Project,
  row: DesignRow,
  layoutIn?: ParamLayout,
): { altIds: string[]; X: number[][] } {
  const layout = layoutIn ?? paramLayout(project)
  const alts = modelAlts(project)
  return {
    altIds: alts.map((a) => a.id),
    X: alts.map((alt) => encodeAlt(project, row, alt.id, layout)),
  }
}

// Why a design with this many choice tasks cannot identify every parameter, or null.
export function identificationIssue(project: Project, numTasks: number): string | null {
  const alts = modelAlts(project)
  const J = alts.length
  if (activeAlts(project).length < 1 || J < 2) {
    return 'A design needs at least two alternatives in each choice task (an opt-out counts as one).'
  }
  const K = paramLayout(project).totalK
  if (K === 0) return 'Add at least one attribute with two or more levels.'
  for (const attr of project.attributes) {
    for (const alt of activeAlts(project)) {
      const applies = attr.appliesTo === 'all' || attr.appliesTo.includes(alt.id)
      if (applies && getLevelsForAlt(attr, alt.id).length < 2) {
        return `“${attr.name}” needs at least two levels for ${alt.label}.`
      }
    }
  }
  const min = Math.ceil(K / (J - 1))
  if (numTasks < min) {
    return `This model has ${K} parameters, so it needs at least ${min} choice tasks (each choice task among ${J} alternatives gives ${J - 1} pieces of information).`
  }
  return null
}

export function buildPriorVector(project: Project, layout?: ParamLayout): number[] {
  const lay = layout ?? paramLayout(project)
  const beta = new Array(lay.totalK).fill(0)
  for (const attr of project.attributes) {
    if (!attr.priors) continue
    const start = lay.offsets[attr.id]
    const len = paramCount(attr)
    for (let j = 0; j < len; j++) {
      beta[start + j] = attr.priors[j] ?? 0
    }
  }
  return beta
}

// Human-readable labels for each prior coefficient
export function priorLabels(attr: Attribute): string[] {
  if (attr.type === 'numeric') return [attr.name]
  const levels = sortedLevels(attr)
  if (levels.length < 2) return ['—']
  const label = (l: (typeof levels)[number]) => l.displayValue ?? String(l.value)
  const base = label(levels[0])
  return levels.slice(1).map((l) => `${label(l)} vs ${base}`)
}

// ── D-error ─────────────────────────────────────────────────────────────────

export function computeDError(
  project: Project,
  rows: DesignRow[],
  priors?: number[],
  layoutIn?: ParamLayout,
): number {
  const layout = layoutIn ?? paramLayout(project)
  const K = layout.totalK
  if (K === 0 || rows.length === 0) return Infinity
  const beta = priors ?? buildPriorVector(project, layout)
  const alts = modelAlts(project)
  const J = alts.length
  if (J < 2) return Infinity

  const F = zeros(K, K)
  for (const row of rows) {
    const X: number[][] = alts.map((alt) => encodeAlt(project, row, alt.id, layout))
    const V = X.map((x) => dot(beta, x))
    const maxV = Math.max(...V)
    const expV = V.map((v) => Math.exp(v - maxV))
    const sumExp = expV.reduce((s, v) => s + v, 0)
    const P = expV.map((v) => v / sumExp)

    const Xbar = new Array(K).fill(0)
    for (let i = 0; i < J; i++) {
      const w = P[i]
      const xi = X[i]
      for (let k = 0; k < K; k++) Xbar[k] += w * xi[k]
    }
    for (let i = 0; i < J; i++) {
      const w = P[i]
      const xi = X[i]
      const d = new Array(K)
      for (let k = 0; k < K; k++) d[k] = xi[k] - Xbar[k]
      for (let r = 0; r < K; r++) {
        const wdr = w * d[r]
        const Fr = F[r]
        for (let c = 0; c < K; c++) Fr[c] += wdr * d[c]
      }
    }
  }
  const ld = logDetSPD(F)
  if (!Number.isFinite(ld)) return Infinity
  return Math.exp(-ld / K)
}

// ── coordinate-exchange search ──────────────────────────────────────────────
// Coordinate exchange (Meyer & Nachtsheim 1995, Technometrics 37(1), 60–69,
// doi:10.1080/00401706.1995.10485889): one attribute level of one alternative in one
// choice task changes at a time; every other level is tried and the one with the
// lowest D-error is kept. No candidate set of whole profiles is built or exchanged,
// so this is not a modified Fedorov algorithm (Cook & Nachtsheim 1980).

export type DOptimalInput = {
  numTasks: number
  numBlocks: number
  multistarts: number
  maxPasses?: number
  rng: () => number
  /** Called at each start and after every accepted swap, e.g. to replay the search. The rows change in place, so copy what you keep. */
  onStep?: (rows: DesignRow[], dError: number) => void
  /** Called per choice task of each pass; fraction is by multistart, the label says where the search is. */
  onProgress?: (p: { fraction: number; label: string }) => void
}

export type DOptimalResult = {
  rows: DesignRow[]
  /** Choice tasks in rows that still break a constraint (the constraints can't all be met). */
  violatingRows: number
  dError: number
  multistartsRun: number
  totalPasses: number
}

function randomCells(
  project: Project,
  rng: () => number,
): Record<string, string> {
  const cells: Record<string, string> = {}
  const altsActive = project.alternatives.filter((a) => !a.isOptOut)
  for (const alt of altsActive) {
    for (const attr of project.attributes) {
      const applies = attr.appliesTo === 'all' || attr.appliesTo.includes(alt.id)
      if (!applies) continue
      const levels = getLevelsForAlt(attr, alt.id)
      if (levels.length === 0) continue
      const idx = Math.floor(rng() * levels.length)
      cells[cellKey(alt.id, attr.id)] = levels[idx].id
    }
  }
  return cells
}

function randomContext(
  project: Project,
  rng: () => number,
): Record<string, string> {
  const context: Record<string, string> = {}
  for (const cv of project.contextVariables ?? []) {
    if (cv.levels.length === 0) continue
    const idx = Math.floor(rng() * cv.levels.length)
    context[cv.id] = cv.levels[idx].id
  }
  return context
}

const MAX_CONSTRAINT_RETRIES = 200

function randomRows(
  project: Project,
  numTasks: number,
  numBlocks: number,
  rng: () => number,
): DesignRow[] {
  const rows: DesignRow[] = []
  const constraints = project.constraints
  const useConstraints = !!(constraints && constraints.length > 0)
  for (let i = 0; i < numTasks; i++) {
    let cells = randomCells(project, rng)
    if (useConstraints) {
      const taskId = i + 1
      const block = (i % numBlocks) + 1
      let tries = 0
      while (
        tries++ < MAX_CONSTRAINT_RETRIES &&
        firstViolation({ taskId, block, cells }, project, constraints)
      ) {
        cells = randomCells(project, rng)
      }
    }
    rows.push({
      taskId: i + 1,
      block: (i % numBlocks) + 1,
      cells,
      context: randomContext(project, rng),
    })
  }
  return rows
}

function coordinateExchange(
  project: Project,
  startRows: DesignRow[],
  layout: ParamLayout,
  beta: number[],
  maxPasses: number,
  onStep?: DOptimalInput['onStep'],
  onRow?: (pass: number, task: number) => void,
): { rows: DesignRow[]; dError: number; passes: number } {
  const rows: DesignRow[] = startRows.map((r) => ({ ...r, cells: { ...r.cells } }))
  const constraints = project.constraints
  const useConstraints = !!(constraints && constraints.length > 0)
  let curD = computeDError(project, rows, beta, layout)
  onStep?.(rows, curD)
  let pass = 0
  let improved = true
  while (improved && pass < maxPasses) {
    improved = false
    pass++
    for (let t = 0; t < rows.length; t++) {
      onRow?.(pass, t)
      const row = rows[t]
      for (const alt of project.alternatives) {
        if (alt.isOptOut) continue
        for (const attr of project.attributes) {
          const applies = attr.appliesTo === 'all' || attr.appliesTo.includes(alt.id)
          if (!applies) continue
          const k = cellKey(alt.id, attr.id)
          const currentLevelId = row.cells[k]
          if (!currentLevelId) continue
          // Candidates rank by the row's constraint violations first, then D-error, so a swap
          // never adds a violation and a start that breaks a constraint is repaired, not frozen.
          const curV = useConstraints ? rowViolationCount(row, project, constraints) : 0
          let bestNewV = curV
          let bestNewD = curD
          let bestNewLevel: string | null = null
          for (const lvl of getLevelsForAlt(attr, alt.id)) {
            if (lvl.id === currentLevelId) continue
            row.cells[k] = lvl.id
            const v = useConstraints ? rowViolationCount(row, project, constraints) : 0
            if (v > bestNewV) {
              row.cells[k] = currentLevelId
              continue
            }
            const newD = computeDError(project, rows, beta, layout)
            if (v < bestNewV || newD < bestNewD) {
              bestNewV = v
              bestNewD = newD
              bestNewLevel = lvl.id
            }
            row.cells[k] = currentLevelId
          }
          if (bestNewLevel) {
            row.cells[k] = bestNewLevel
            curD = bestNewD
            improved = true
            onStep?.(rows, curD)
          }
        }
      }
    }
  }
  return { rows, dError: curD, passes: pass }
}

export function dOptimalSearch(project: Project, input: DOptimalInput): DOptimalResult {
  const layout = paramLayout(project)
  const beta = buildPriorVector(project, layout)
  const M = input.multistarts
  const maxPasses = input.maxPasses ?? 30

  let bestRows: DesignRow[] | null = null
  let bestD = Infinity
  let bestV = Infinity
  let totalPasses = 0
  for (let m = 0; m < M; m++) {
    const start = randomRows(project, input.numTasks, input.numBlocks, input.rng)
    const onRow = input.onProgress
      ? (pass: number, t: number) =>
          input.onProgress!({
            // Finished starts, plus an estimate within this one: a start usually converges in a
            // few passes, so assume four and stop short of the next start's share.
            fraction: (m + Math.min(0.9, (pass - 1 + (t + 1) / start.length) / 4)) / M,
            label: `Start ${m + 1} of ${M} · pass ${pass} · choice task ${t + 1} of ${start.length}`,
          })
      : undefined
    const r = coordinateExchange(project, start, layout, beta, maxPasses, input.onStep, onRow)
    totalPasses += r.passes
    // A start that honours the constraints beats any that doesn't, whatever its D-error. Keep the
    // first start even when nothing is identified, so a run never returns no rows.
    const v = violatingRows(r.rows, project)
    if (bestRows === null || v < bestV || (v === bestV && r.dError < bestD)) {
      bestV = v
      bestD = r.dError
      bestRows = r.rows
    }
  }
  return {
    rows: bestRows ?? [],
    violatingRows: bestRows ? bestV : 0,
    dError: bestD,
    multistartsRun: M,
    totalPasses,
  }
}
