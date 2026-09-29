import type { Project, Attribute, DesignRow } from './schema'
import { cellKey } from './validation'
import { det, zeros, dot } from './linalg'
import { firstViolation } from './constraints'
import { findLevelInAttr, getLevelsForAlt } from './levelLookup'

// ── encoding ────────────────────────────────────────────────────────────────
// Effects coding with the FIRST level (position 0) as the reference.
//   - numeric:                 1 parameter, the raw value
//   - boolean (2 levels):      1 parameter, position 0 → -1, position 1 → +1
//   - categorical with K lvls: K-1 parameters,
//                                 position 0 (reference) → vector of -1s,
//                                 position p (p≥1)       → e_{p-1} (one-hot)
// When an attribute does not apply to an alternative, that alternative's slice
// of the parameter vector is filled with zeros.

export function paramCount(attr: Attribute): number {
  if (attr.type === 'numeric') return 1
  return Math.max(1, attr.levels.length - 1)
}

export type ParamLayout = {
  offsets: Record<string, number> // attrId → start index
  ascStart: number // start index of alt-specific constants (-1 if none)
  ascCount: number // J-1 for labeled, 0 otherwise
  totalK: number
}

function activeAlts(project: Project) {
  return project.alternatives.filter((a) => !a.isOptOut)
}

export function paramLayout(project: Project): ParamLayout {
  const ascNeeded =
    project.experimentType === 'labeled' ? Math.max(0, activeAlts(project).length - 1) : 0
  const offsets: Record<string, number> = {}
  let k = 0
  // ASCs come first (one per non-reference alt; last active alt is the reference)
  const ascStart = ascNeeded > 0 ? 0 : -1
  k += ascNeeded
  for (const attr of project.attributes) {
    offsets[attr.id] = k
    k += paramCount(attr)
  }
  return { offsets, ascStart, ascCount: ascNeeded, totalK: k }
}

function encodeLevel(attr: Attribute, levelId: string): number[] {
  const lvl = findLevelInAttr(attr, levelId)
  if (!lvl) return new Array(paramCount(attr)).fill(0)
  if (attr.type === 'numeric') return [Number(lvl.value)]
  const K = attr.levels.length
  if (K < 2) return [0]
  const vec = new Array(K - 1).fill(0)
  if (lvl.position === 0) {
    return vec.fill(-1)
  }
  vec[lvl.position - 1] = 1
  return vec
}

function encodeAlt(
  project: Project,
  row: DesignRow,
  altId: string,
  layout: ParamLayout,
  altsActive: ReturnType<typeof activeAlts>,
): number[] {
  const x = new Array(layout.totalK).fill(0)
  // ASC: dummy for non-reference active alts (last active alt is reference)
  if (layout.ascCount > 0) {
    const idx = altsActive.findIndex((a) => a.id === altId)
    if (idx >= 0 && idx < altsActive.length - 1) {
      x[layout.ascStart + idx] = 1
    }
  }
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
// (non-opt-out alternatives only, in project order).
export function encodeChoiceTask(
  project: Project,
  row: DesignRow,
  layoutIn?: ParamLayout,
): { altIds: string[]; X: number[][] } {
  const layout = layoutIn ?? paramLayout(project)
  const altsActive = activeAlts(project)
  return {
    altIds: altsActive.map((a) => a.id),
    X: altsActive.map((alt) => encodeAlt(project, row, alt.id, layout, altsActive)),
  }
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
  if (attr.type === 'boolean') {
    const t = attr.levels.find((l) => Boolean(l.value) === true)
    const f = attr.levels.find((l) => Boolean(l.value) === false)
    const tLabel = t?.displayValue ?? 'true'
    const fLabel = f?.displayValue ?? 'false'
    return [`${tLabel} vs ${fLabel}`]
  }
  if (attr.levels.length < 2) return ['—']
  const ref = attr.levels[0]
  const refLabel = ref.displayValue ?? String(ref.value)
  return attr.levels.slice(1).map((l) => {
    const lvlLabel = l.displayValue ?? String(l.value)
    return `${lvlLabel} vs ${refLabel}`
  })
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
  const altsActive = activeAlts(project)
  const J = altsActive.length

  const F = zeros(K, K)
  for (const row of rows) {
    const X: number[][] = altsActive.map((alt) =>
      encodeAlt(project, row, alt.id, layout, altsActive),
    )
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
  const detF = det(F)
  if (!isFinite(detF) || detF <= 0) return Infinity
  return Math.pow(detF, -1 / K)
}

// ── modified Federov search ─────────────────────────────────────────────────

export type DOptimalInput = {
  numTasks: number
  numBlocks: number
  multistarts: number
  maxPasses?: number
  rng: () => number
}

export type DOptimalResult = {
  rows: DesignRow[]
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

function federovImprove(
  project: Project,
  startRows: DesignRow[],
  layout: ParamLayout,
  beta: number[],
  maxPasses: number,
): { rows: DesignRow[]; dError: number; passes: number } {
  const rows: DesignRow[] = startRows.map((r) => ({ ...r, cells: { ...r.cells } }))
  const constraints = project.constraints
  const useConstraints = !!(constraints && constraints.length > 0)
  let curD = computeDError(project, rows, beta, layout)
  let pass = 0
  let improved = true
  while (improved && pass < maxPasses) {
    improved = false
    pass++
    for (let t = 0; t < rows.length; t++) {
      const row = rows[t]
      for (const alt of project.alternatives) {
        if (alt.isOptOut) continue
        for (const attr of project.attributes) {
          const applies = attr.appliesTo === 'all' || attr.appliesTo.includes(alt.id)
          if (!applies) continue
          const k = cellKey(alt.id, attr.id)
          const currentLevelId = row.cells[k]
          if (!currentLevelId) continue
          let bestNewD = curD
          let bestNewLevel: string | null = null
          for (const lvl of getLevelsForAlt(attr, alt.id)) {
            if (lvl.id === currentLevelId) continue
            row.cells[k] = lvl.id
            // Skip swap candidates that introduce a constraint violation
            if (useConstraints && firstViolation(row, project, constraints)) {
              row.cells[k] = currentLevelId
              continue
            }
            const newD = computeDError(project, rows, beta, layout)
            if (newD < bestNewD) {
              bestNewD = newD
              bestNewLevel = lvl.id
            }
            row.cells[k] = currentLevelId
          }
          if (bestNewLevel) {
            row.cells[k] = bestNewLevel
            curD = bestNewD
            improved = true
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
  let totalPasses = 0
  for (let m = 0; m < M; m++) {
    const start = randomRows(project, input.numTasks, input.numBlocks, input.rng)
    const r = federovImprove(project, start, layout, beta, maxPasses)
    totalPasses += r.passes
    if (r.dError < bestD) {
      bestD = r.dError
      bestRows = r.rows
    }
  }
  return {
    rows: bestRows ?? [],
    dError: bestD,
    multistartsRun: M,
    totalPasses,
  }
}
