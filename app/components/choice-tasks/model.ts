import type { Alternative, Attribute, DesignRow, Level, Project } from '@/lib/schema'
import { appliesToAlt, cellKey } from '@/lib/validation'
import { formatNumeric, levelDisplayText, pivotDeltaText, resolvePivotValue } from '@/lib/format'
import { findLevelInAttr, getLevelsForAlt } from '@/lib/levelLookup'

export { questionStem } from '@/lib/surveyText'

export function orderedAlternatives(project: Project): Alternative[] {
  return project.builder.alternativeOrder
    .map((id) => project.alternatives.find((a) => a.id === id))
    .filter((a): a is Alternative => !!a)
}

export function orderedAttributes(project: Project): Attribute[] {
  return project.builder.attributeOrder
    .map((id) => project.attributes.find((a) => a.id === id))
    .filter((a): a is Attribute => !!a)
}

export function choiceColumnLabel(project: Project): string {
  return project.builder.labels?.choiceColumn?.trim() || 'Choice'
}

export type ContextEntry = { id: string; name: string; text: string }

// Same text as the exports: displayValue, else the raw value.
export function contextEntries(project: Project, row: DesignRow): ContextEntry[] {
  const out: ContextEntry[] = []
  for (const cv of project.contextVariables ?? []) {
    const lid = row.context?.[cv.id]
    const level = cv.levels.find((l) => l.id === lid)
    if (!level) continue
    out.push({ id: cv.id, name: cv.name, text: level.displayValue ?? String(level.value) })
  }
  return out
}

// ── navigation order ────────────────────────────────────────────────────────

export type TaskEntry = {
  row: DesignRow
  /** Index into project.design.rows (and useDesignHealth().byTask). */
  rowIndex: number
  /** 1-based position within its block, in design order. */
  inBlock: number
  blockSize: number
}

export type BlockGroup = { block: number; tasks: TaskEntry[] }

// Grouped by block (ascending), design order within a block: the order a respondent in that block sees.
export function groupByBlock(rows: DesignRow[]): { groups: BlockGroup[]; order: TaskEntry[] } {
  const byBlock = new Map<number, number[]>()
  rows.forEach((row, i) => {
    const list = byBlock.get(row.block) ?? []
    list.push(i)
    byBlock.set(row.block, list)
  })
  const groups: BlockGroup[] = Array.from(byBlock.keys())
    .sort((a, b) => a - b)
    .map((block) => {
      const idx = byBlock.get(block)!
      return {
        block,
        tasks: idx.map((rowIndex, k) => ({
          row: rows[rowIndex],
          rowIndex,
          inBlock: k + 1,
          blockSize: idx.length,
        })),
      }
    })
  return { groups, order: groups.flatMap((g) => g.tasks) }
}

// ── cells ───────────────────────────────────────────────────────────────────

export type ValueCell = {
  kind: 'value'
  level: Level
  /** Full respondent-facing text, identical to the exports (pivot delta in brackets). */
  text: string
  /** Large numeral with an optional trailing unit, for numeric attributes. */
  figure: { num: string; unit?: string } | null
  /** Plain text when the value is not a figure. */
  word: string
  delta: string | null
  meter: { steps: number; filled: number } | null
  /** Short value for the analyst lens grid. */
  short: string
  /** 0-based position within this alternative's level set. */
  index: number
  count: number
}

export type Cell = { kind: 'optout' } | { kind: 'na' } | { kind: 'missing' } | ValueCell

const minus = (s: string) => s.replace(/(^|[\s(€$£])-(?=\d)/g, '$1−')

// "30 min" → 30 + min, "€4.00" → €4.00, "Every 10 min" → not a figure.
const FIGURE = /^([€$£]?[−+]?\d[\d.,]*%?)(?:\s+(\S.{0,11}))?$/

function splitFigure(text: string): { num: string; unit?: string } | null {
  const m = FIGURE.exec(text.trim())
  if (!m) return null
  return m[2] ? { num: m[1], unit: m[2] } : { num: m[1] }
}

function sortedLevels(levels: Level[]): Level[] {
  return [...levels].sort((a, b) => a.position - b.position)
}

function shortValue(attr: Attribute, level: Level): string {
  const v = Number(level.value)
  const pivot = attr.pivot
  if (attr.type === 'numeric' && pivot && pivot.mode !== 'none' && Number.isFinite(v)) {
    if (pivot.mode === 'relative') return `×${Number.isInteger(v) ? v.toFixed(1) : String(v)}`
    return v === 0 ? '±0' : v > 0 ? `+${v}` : `−${Math.abs(v)}`
  }
  if (attr.type === 'numeric' && Number.isFinite(v)) return minus(String(v))
  return level.displayValue ?? String(level.value)
}

export function cellFor(attr: Attribute, alt: Alternative, row: DesignRow): Cell {
  if (alt.isOptOut) return { kind: 'optout' }
  if (!appliesToAlt(attr, alt.id)) return { kind: 'na' }
  const lid = row.cells[cellKey(alt.id, attr.id)]
  const level = lid ? findLevelInAttr(attr, lid) : undefined
  if (!level) return { kind: 'missing' }

  const set = sortedLevels(getLevelsForAlt(attr, alt.id))
  const found = set.findIndex((l) => l.id === level.id)
  const index = found >= 0 ? found : Math.max(0, level.position)
  const count = Math.max(set.length, index + 1)

  const text = minus(levelDisplayText(attr, level))
  let main = text
  let delta: string | null = null
  const resolved = resolvePivotValue(level, attr.pivot)
  if (resolved !== null) {
    main = minus(formatNumeric(resolved, attr.unit, attr.displayFormat))
    const d = pivotDeltaText(level, attr.pivot)
    delta = d && d !== 'no change' ? minus(d) : null
  }

  const figure = attr.type === 'numeric' ? splitFigure(main) : null
  const ordered =
    attr.type === 'categorical' &&
    !!attr.preferenceDirection &&
    attr.preferenceDirection !== 'none' &&
    count >= 2 &&
    count <= 7

  return {
    kind: 'value',
    level,
    text,
    figure,
    word: main,
    delta,
    meter: ordered ? { steps: count, filled: index + 1 } : null,
    short: shortValue(attr, level),
    index,
    count,
  }
}


