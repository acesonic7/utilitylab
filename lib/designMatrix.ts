import type { Alternative, Attribute, ContextVariable, DesignRow, Level, Project } from './schema'
import { appliesToAlt, cellKey, resolveValidationConfig } from './validation'
import { findLevelInAttr, getLevelsForAlt } from './levelLookup'
import { levelDisplayText } from './format'
import { correlationMatrix } from './diagnostics'

export type MatrixColumn = { attr: Attribute; levels: Level[] }
export type MatrixGroup = { alt: Alternative; columns: MatrixColumn[] }

export type MatrixCell = {
  text: string
  // 0-based position within the levels that apply to this alternative; null when missing.
  levelIndex: number | null
  levelCount: number
}

export type MatrixRow = {
  // Index into project.design.rows (and DesignHealth.byTask).
  index: number
  row: DesignRow
  cells: MatrixCell[][]
  context: MatrixCell[]
  firstInBlock: boolean
}

export type DesignMatrixModel = {
  groups: MatrixGroup[]
  contextVariables: ContextVariable[]
  rows: MatrixRow[]
  attributeColumns: number
}

function byPosition(levels: Level[]): Level[] {
  return [...levels].sort((a, b) => a.position - b.position)
}

function ordered<T extends { id: string }>(items: T[], order: string[] | undefined): T[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  const out: T[] = []
  for (const id of order ?? []) {
    const item = byId.get(id)
    if (item && !out.includes(item)) out.push(item)
  }
  for (const item of items) if (!out.includes(item)) out.push(item)
  return out
}

function contextAsAttribute(cv: ContextVariable): Attribute {
  return { ...cv, appliesTo: 'all' }
}

export function matrixGroups(project: Project): MatrixGroup[] {
  const alts = ordered(project.alternatives, project.builder?.alternativeOrder).filter((a) => !a.isOptOut)
  const attrs = ordered(project.attributes, project.builder?.attributeOrder)
  return alts
    .map((alt) => ({
      alt,
      columns: attrs
        .filter((attr) => appliesToAlt(attr, alt.id))
        .map((attr) => ({ attr, levels: byPosition(getLevelsForAlt(attr, alt.id)) })),
    }))
    .filter((g) => g.columns.length > 0)
}

export function buildDesignMatrix(project: Project): DesignMatrixModel {
  const groups = matrixGroups(project)
  const contextVariables = [...(project.contextVariables ?? [])].sort((a, b) => a.position - b.position)
  const source = project.design?.rows ?? []
  // Stable sort by block so each block reads as one run of rows.
  const sorted = source
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.block - b.row.block || a.index - b.index)

  const rows: MatrixRow[] = sorted.map(({ row, index }, i) => {
    const cells = groups.map((g) =>
      g.columns.map(({ attr, levels }) => {
        const level = findLevelInAttr(attr, row.cells[cellKey(g.alt.id, attr.id)] ?? '')
        const pos = level ? levels.findIndex((l) => l.id === level.id) : -1
        return {
          text: levelDisplayText(attr, level),
          levelIndex: pos >= 0 ? pos : null,
          levelCount: levels.length,
        }
      }),
    )
    const context = contextVariables.map((cv) => {
      const levels = byPosition(cv.levels)
      const id = row.context?.[cv.id]
      const pos = id ? levels.findIndex((l) => l.id === id) : -1
      return {
        text: levelDisplayText(contextAsAttribute(cv), pos >= 0 ? levels[pos] : undefined),
        levelIndex: pos >= 0 ? pos : null,
        levelCount: levels.length,
      }
    })
    return {
      index,
      row,
      cells,
      context,
      firstInBlock: i > 0 && sorted[i - 1].row.block !== row.block,
    }
  })

  return {
    groups,
    contextVariables,
    rows,
    attributeColumns: groups.reduce((s, g) => s + g.columns.length, 0),
  }
}

// One class per tint step, written out in full so Tailwind keeps them (see .bg-alt-tint-* in globals.css).
export const TINT_CLASSES = ['bg-alt-tint-8', 'bg-alt-tint-14', 'bg-alt-tint-22', 'bg-alt-tint-34'] as const

// Four tint steps spread across however many levels the alternative has.
export function tintStep(levelIndex: number, levelCount: number): 0 | 1 | 2 | 3 {
  if (levelCount <= 1) return 0
  return Math.round((levelIndex / (levelCount - 1)) * 3) as 0 | 1 | 2 | 3
}

// ── correlation brackets ────────────────────────────────────────────────────

export type CorrelationBracket = {
  altId: string
  a: Attribute
  b: Attribute
  r: number
  severity: 'warning' | 'concern'
  // Inclusive column range, counted across all attribute columns of the matrix.
  from: number
  to: number
  lane: number
}

export function correlationBrackets(project: Project, groups: MatrixGroup[]): CorrelationBracket[] {
  if (!resolveValidationConfig(project).correlation.enabled) return []
  const out: Omit<CorrelationBracket, 'lane'>[] = []
  let offset = 0
  for (const g of groups) {
    const col = new Map(g.columns.map((c, i) => [c.attr.id, i]))
    for (const p of correlationMatrix(project, g.alt.id).pairs) {
      if (p.severity === 'ok' || p.r === null) continue
      const ia = col.get(p.a)
      const ib = col.get(p.b)
      if (ia === undefined || ib === undefined) continue
      const [lo, hi] = ia < ib ? [ia, ib] : [ib, ia]
      out.push({
        altId: g.alt.id,
        a: g.columns[lo].attr,
        b: g.columns[hi].attr,
        r: p.r,
        severity: p.severity,
        from: offset + lo,
        to: offset + hi,
      })
    }
    offset += g.columns.length
  }
  // Shortest spans sit nearest the columns; overlapping spans move up a lane.
  out.sort((x, y) => x.to - x.from - (y.to - y.from) || x.from - y.from)
  const lanes: { from: number; to: number }[][] = []
  return out.map((b) => {
    let lane = lanes.findIndex((l) => l.every((o) => b.to < o.from || b.from > o.to))
    if (lane < 0) {
      lane = lanes.length
      lanes.push([])
    }
    lanes[lane].push(b)
    return { ...b, lane }
  })
}

export function formatR(r: number): string {
  return `${r < 0 ? '−' : '+'}${Math.abs(r).toFixed(2)}`
}

// On-screen only: a true minus for negative figures. The CSV keeps the export text.
export function withTrueMinus(text: string): string {
  return text.replace(/(^|[\s(×])-(?=\d)/g, '$1−')
}

// ── plain CSV of displayed values ───────────────────────────────────────────

function csvField(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function designMatrixCsv(model: DesignMatrixModel): string {
  const header = [
    'Choice task',
    'Block',
    ...model.groups.flatMap((g) => g.columns.map((c) => `${g.alt.label}: ${c.attr.name}`)),
    ...model.contextVariables.map((cv) => cv.name),
  ]
  const lines = [header]
  for (const r of model.rows) {
    lines.push([
      String(r.row.taskId),
      String(r.row.block),
      ...r.cells.flatMap((g) => g.map((c) => c.text)),
      ...r.context.map((c) => c.text),
    ])
  }
  return lines.map((l) => l.map(csvField).join(',')).join('\n') + '\n'
}
