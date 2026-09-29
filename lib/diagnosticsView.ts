import type { Constraint, Project } from './schema'
import { constraintLabel, rowViolates } from './constraints'
import {
  correlationMatrix,
  type CorrelationPair,
  type LevelBalanceRow,
  type TaskDiagnostics,
} from './diagnostics'
import { levelDisplayText } from './format'
import { findLevelInAttr } from './levelLookup'
import { cellKey } from './validation'

export const MINUS = '−'

/** Signed figure with a true minus sign; zero carries no sign. */
export function formatSigned(r: number, digits: number): string {
  const mag = Math.abs(r).toFixed(digits)
  if (Number(mag) === 0) return mag
  return `${r < 0 ? MINUS : '+'}${mag}`
}

export function formatCount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

// ── constraints ─────────────────────────────────────────────────────────────

export type TaskKey = { block: number; taskId: number }

export type ConstraintViolationGroup = {
  constraint: Constraint
  label: string
  tasks: TaskKey[]
}

export type ConstraintViolations = {
  /** Violations per design row, aligned with project.design.rows. */
  byRow: number[]
  groups: ConstraintViolationGroup[]
  total: number
  defined: number
  enabled: number
}

// Same rule as countViolations in lib/constraints, kept per row so a task id repeated across blocks stays apart.
export function constraintViolations(project: Project): ConstraintViolations {
  const rows = project.design?.rows ?? []
  const constraints = project.constraints ?? []
  const byRow = rows.map(() => 0)
  const groups: ConstraintViolationGroup[] = []
  for (const c of constraints) {
    const tasks: TaskKey[] = []
    rows.forEach((row, i) => {
      if (!rowViolates(row, project, c)) return
      tasks.push({ block: row.block, taskId: row.taskId })
      byRow[i]++
    })
    if (tasks.length > 0) groups.push({ constraint: c, label: constraintLabel(c, project), tasks })
  }
  return {
    byRow,
    groups,
    total: byRow.reduce((s, n) => s + n, 0),
    defined: constraints.length,
    enabled: constraints.filter((c) => c.enabled).length,
  }
}

// ── correlation ─────────────────────────────────────────────────────────────

export type AltCorrelation = { altId: string; attrIds: string[]; pairs: CorrelationPair[] }

export function correlationsByAlt(project: Project): AltCorrelation[] {
  return project.alternatives
    .filter((a) => !a.isOptOut)
    .map((a) => ({ altId: a.id, ...correlationMatrix(project, a.id) }))
}

export type LocatedPair = { altId: string; a: string; b: string; r: number; severity: CorrelationPair['severity'] }

function located(all: AltCorrelation[]): LocatedPair[] {
  const out: LocatedPair[] = []
  for (const c of all) {
    for (const p of c.pairs) {
      if (p.r !== null) out.push({ altId: c.altId, a: p.a, b: p.b, r: p.r, severity: p.severity })
    }
  }
  return out
}

/** The largest |r| across alternatives, with every pair that ties with it at three decimals. */
export function strongestPairs(all: AltCorrelation[]): { abs: number; pairs: LocatedPair[] } | null {
  const pairs = located(all)
  if (pairs.length === 0) return null
  const abs = Math.max(...pairs.map((p) => Math.abs(p.r)))
  return { abs, pairs: pairs.filter((p) => Math.abs(p.r) >= abs - 5e-4) }
}

// ── dominance ───────────────────────────────────────────────────────────────

export function dominatedCounts(byTask: TaskDiagnostics[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const t of byTask) {
    for (const d of t.dominated) out.set(d.altId, (out.get(d.altId) ?? 0) + 1)
  }
  return out
}

export type DiagnosticsInsight = {
  altId: string
  /** 0 when the insight is about a correlation only. */
  dominatedIn: number
  tasks: number
  pair: LocatedPair | null
}

// Deterministic: the most-dominated alternative (first in order on ties) and its strongest flagged correlation;
// without dominance, the strongest flagged correlation anywhere.
export function buildInsight(
  project: Project,
  byTask: TaskDiagnostics[],
  correlations: AltCorrelation[],
): DiagnosticsInsight | null {
  const counts = dominatedCounts(byTask)
  const flagged = located(correlations)
    .filter((p) => p.severity !== 'ok')
    .sort((x, y) => Math.abs(y.r) - Math.abs(x.r))
  let best: string | null = null
  let bestN = 0
  for (const alt of project.alternatives) {
    if (alt.isOptOut) continue
    const n = counts.get(alt.id) ?? 0
    if (n > bestN) {
      best = alt.id
      bestN = n
    }
  }
  if (best) {
    return {
      altId: best,
      dominatedIn: bestN,
      tasks: byTask.length,
      pair: flagged.find((p) => p.altId === best) ?? null,
    }
  }
  const top = flagged[0]
  return top ? { altId: top.altId, dominatedIn: 0, tasks: byTask.length, pair: top } : null
}

// ── overlap ─────────────────────────────────────────────────────────────────

/** The shared level values of an identical pair, e.g. "30 min · Medium". */
export function sharedLevelsText(project: Project, rowIndex: number, altId: string, attrIds: string[]): string {
  const row = project.design?.rows[rowIndex]
  if (!row) return ''
  const parts: string[] = []
  for (const id of attrIds) {
    const attr = project.attributes.find((a) => a.id === id)
    if (!attr) continue
    const lid = row.cells[cellKey(altId, id)]
    parts.push(levelDisplayText(attr, lid ? findLevelInAttr(attr, lid) : undefined))
  }
  return parts.join(' · ')
}

// ── level balance ───────────────────────────────────────────────────────────

export type BalanceSummary = {
  maxDeviation: number | null
  attributes: number
  contexts: number
  outside: LevelBalanceRow[]
}

export function balanceSummary(rows: LevelBalanceRow[], maxDeviationPct: number): BalanceSummary {
  return {
    maxDeviation: rows.length > 0 ? Math.max(...rows.map((r) => r.maxDeviation)) : null,
    attributes: new Set(rows.filter((r) => r.kind === 'attribute').map((r) => r.id)).size,
    contexts: rows.filter((r) => r.kind === 'context').length,
    outside: rows.filter((r) => r.maxDeviation > maxDeviationPct),
  }
}

export function isOutsideBand(count: number, ideal: number, maxDeviationPct: number): boolean {
  if (ideal === 0) return false
  return Math.abs(((count - ideal) / ideal) * 100) > maxDeviationPct
}
