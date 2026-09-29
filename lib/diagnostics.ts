import type { Attribute, ContextVariable, DesignRow, Level, Project } from './schema'
import {
  appliesToAlt,
  cellKey,
  getLevel,
  getScalar,
  pearson,
  resolveValidationConfig,
  validate,
  type Finding,
  type Report,
} from './validation'
import { formatNumeric } from './format'

// ── correlation ─────────────────────────────────────────────────────────────

export type CorrelationPair = {
  a: string
  b: string
  r: number | null
  severity: 'ok' | 'warning' | 'concern'
}

function isConstant(xs: number[]): boolean {
  return xs.every((v) => v === xs[0])
}

export function correlationMatrix(
  project: Project,
  altId: string,
): { attrIds: string[]; pairs: CorrelationPair[] } {
  const alt = project.alternatives.find((a) => a.id === altId)
  if (!alt || alt.isOptOut) return { attrIds: [], pairs: [] }
  const cfg = resolveValidationConfig(project).correlation
  const rows = project.design?.rows ?? []
  const attrs = project.attributes.filter((a) => appliesToAlt(a, altId))
  const pairs: CorrelationPair[] = []
  for (let i = 0; i < attrs.length; i++) {
    for (let j = i + 1; j < attrs.length; j++) {
      const A = attrs[i]
      const B = attrs[j]
      const xs: number[] = []
      const ys: number[] = []
      for (const row of rows) {
        const lA = getLevel(A, row.cells[cellKey(altId, A.id)])
        const lB = getLevel(B, row.cells[cellKey(altId, B.id)])
        if (!lA || !lB) continue
        xs.push(getScalar(A, lA))
        ys.push(getScalar(B, lB))
      }
      // Undefined when a series is constant; validation treats that as r = 0 (no finding).
      const r = xs.length < 2 || isConstant(xs) || isConstant(ys) ? null : pearson(xs, ys)
      const abs = r === null ? 0 : Math.abs(r)
      const severity =
        abs > cfg.concernThreshold ? 'concern' : abs > cfg.warnThreshold ? 'warning' : 'ok'
      pairs.push({ a: A.id, b: B.id, r, severity })
    }
  }
  return { attrIds: attrs.map((a) => a.id), pairs }
}

// ── level balance ───────────────────────────────────────────────────────────

export type LevelCount = { levelId: string; label: string; count: number }

export type LevelBalanceRow = {
  kind: 'attribute' | 'context'
  id: string
  name: string
  altId?: string
  counts: LevelCount[]
  ideal: number
  // Largest |actual − ideal| / ideal, in percent (same unit as balance.maxDeviationPct).
  maxDeviation: number
}

function levelLabel(owner: Attribute | ContextVariable, level: Level): string {
  const pivot = 'pivot' in owner ? owner.pivot : undefined
  const v = Number(level.value)
  if (pivot && pivot.mode !== 'none' && Number.isFinite(v)) {
    if (pivot.mode === 'relative') return `×${Number.isInteger(v) ? v.toFixed(1) : String(v)}`
    if (pivot.mode === 'absolute') return v === 0 ? '±0' : v > 0 ? `+${v}` : `−${Math.abs(v)}`
  }
  if (level.displayValue) return level.displayValue
  if (owner.type === 'numeric') return formatNumeric(v, owner.unit, owner.displayFormat)
  return String(level.value)
}

function balanceRow(
  base: Pick<LevelBalanceRow, 'kind' | 'id' | 'name' | 'altId'>,
  owner: Attribute | ContextVariable,
  levels: Level[],
  counts: Map<string, number>,
  totalSlots: number,
): LevelBalanceRow {
  const ideal = totalSlots / levels.length
  const out: LevelCount[] = levels.map((l) => ({
    levelId: l.id,
    label: levelLabel(owner, l),
    count: counts.get(l.id) ?? 0,
  }))
  const maxDeviation =
    ideal === 0 ? 0 : Math.max(...out.map((c) => Math.abs(((c.count - ideal) / ideal) * 100)))
  return { ...base, counts: out, ideal, maxDeviation }
}

// Mirrors checkBalance in validation.ts: a row exceeds balance.maxDeviationPct exactly when a balance finding exists.
export function levelCounts(project: Project): LevelBalanceRow[] {
  const rows = project.design?.rows ?? []
  const out: LevelBalanceRow[] = []
  for (const attr of project.attributes) {
    const applicable = project.alternatives.filter((a) => !a.isOptOut && appliesToAlt(attr, a.id))
    if (applicable.length === 0) continue
    const hasOverrides = !!attr.levelsByAlternative && Object.keys(attr.levelsByAlternative).length > 0
    if (hasOverrides) {
      for (const alt of applicable) {
        const altLevels = attr.levelsByAlternative?.[alt.id] ?? attr.levels
        if (altLevels.length < 2) continue
        const counts = new Map<string, number>(altLevels.map((l) => [l.id, 0]))
        for (const row of rows) {
          const lid = row.cells[cellKey(alt.id, attr.id)]
          if (lid && counts.has(lid)) counts.set(lid, counts.get(lid)! + 1)
        }
        out.push(
          balanceRow(
            { kind: 'attribute', id: attr.id, name: attr.name, altId: alt.id },
            attr,
            altLevels,
            counts,
            rows.length,
          ),
        )
      }
      continue
    }
    if (attr.levels.length < 2) continue
    const counts = new Map<string, number>(attr.levels.map((l) => [l.id, 0]))
    for (const row of rows) {
      for (const alt of applicable) {
        const lid = row.cells[cellKey(alt.id, attr.id)]
        if (lid && counts.has(lid)) counts.set(lid, counts.get(lid)! + 1)
      }
    }
    out.push(
      balanceRow(
        { kind: 'attribute', id: attr.id, name: attr.name },
        attr,
        attr.levels,
        counts,
        rows.length * applicable.length,
      ),
    )
  }
  for (const cv of project.contextVariables ?? []) {
    if (cv.levels.length < 2) continue
    const counts = new Map<string, number>(cv.levels.map((l) => [l.id, 0]))
    for (const row of rows) {
      const lid = row.context?.[cv.id]
      if (lid && counts.has(lid)) counts.set(lid, counts.get(lid)! + 1)
    }
    out.push(balanceRow({ kind: 'context', id: cv.id, name: cv.name }, cv, cv.levels, counts, rows.length))
  }
  return out
}

// ── per choice task ─────────────────────────────────────────────────────────

export type TaskDiagnostics = {
  block: number
  taskId: number
  dominated: { altId: string; by: string[] }[]
  identical: [string, string][]
  findings: Finding[]
}

function taskFindingsFor(findings: Finding[], taskId: number): Finding[] {
  return findings.filter(
    (f) => (f.check === 'dominance' || f.check === 'overlap') && f.details.taskId === taskId,
  )
}

function summarise(row: DesignRow, findings: Finding[]): TaskDiagnostics {
  const dominated = new Map<string, string[]>()
  const identical: [string, string][] = []
  for (const f of findings) {
    if (f.check === 'dominance') {
      const loser = String(f.details.dominatedAltId)
      const winner = String(f.details.dominantAltId)
      const by = dominated.get(loser) ?? []
      if (!by.includes(winner)) by.push(winner)
      dominated.set(loser, by)
    } else if (f.check === 'overlap') {
      identical.push([String(f.details.altA), String(f.details.altB)])
    }
  }
  return {
    block: row.block,
    taskId: row.taskId,
    dominated: Array.from(dominated, ([altId, by]) => ({ altId, by })),
    identical,
    findings,
  }
}

export function diagnosticsByTask(project: Project, report: Report): TaskDiagnostics[] {
  const rows = project.design?.rows ?? []
  const seen = new Map<number, number>()
  for (const row of rows) seen.set(row.taskId, (seen.get(row.taskId) ?? 0) + 1)
  const cfg = resolveValidationConfig(project)
  return rows.map((row) => {
    if (seen.get(row.taskId) === 1) return summarise(row, taskFindingsFor(report.findings, row.taskId))
    // Findings only carry taskId, so a taskId repeated across blocks is re-validated on its own row.
    const single = validate(
      { ...project, design: project.design ? { ...project.design, rows: [row] } : null },
      { balance: { ...cfg.balance, enabled: false }, correlation: { ...cfg.correlation, enabled: false } },
    )
    return summarise(row, taskFindingsFor(single.findings, row.taskId))
  })
}

// ── counts ──────────────────────────────────────────────────────────────────

export function findingCounts(report: Report): Record<string, { warning: number; concern: number }> {
  const out: Record<string, { warning: number; concern: number }> = {
    dominance: { warning: 0, concern: 0 },
    balance: { warning: 0, concern: 0 },
    correlation: { warning: 0, concern: 0 },
    overlap: { warning: 0, concern: 0 },
  }
  for (const f of report.findings) {
    const c = (out[f.check] ??= { warning: 0, concern: 0 })
    c[f.severity]++
  }
  return out
}

// ── design shape ────────────────────────────────────────────────────────────

export type DesignShape = {
  tasks: number
  blocks: number
  perRespondent: { min: number; max: number }
}

export function designShape(project: Project): DesignShape | null {
  const rows = project.design?.rows ?? []
  if (rows.length === 0) return null
  const perBlock = new Map<number, number>()
  for (const row of rows) perBlock.set(row.block, (perBlock.get(row.block) ?? 0) + 1)
  const sizes = Array.from(perBlock.values())
  return {
    tasks: rows.length,
    blocks: perBlock.size,
    perRespondent: { min: Math.min(...sizes), max: Math.max(...sizes) },
  }
}
