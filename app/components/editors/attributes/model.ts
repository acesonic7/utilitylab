import type { Attribute, Level, PreferenceDirection } from '@/lib/schema'
import { formatNumeric, levelDisplayText, pivotDeltaText, resolvePivotValue } from '@/lib/format'

export const MINUS = '−'

export const trueMinus = (s: string) => s.replace(/^-/, MINUS)

function trimNum(n: number, maxDecimals = 3): string {
  const f = 10 ** maxDecimals
  return String(Math.round(n * f) / f)
}

export function fmtNum(n: number): string {
  return trueMinus(trimNum(n))
}

function fmtMultiplier(n: number): string {
  const s = trimNum(n, 2)
  return s.includes('.') ? s : `${s}.0`
}

function fmtSigned(n: number): string {
  if (n === 0) return '0'
  return n > 0 ? `+${trimNum(n)}` : `${MINUS}${trimNum(-n)}`
}

export const PREF_TEXT: Record<PreferenceDirection, string> = {
  lower: 'Lower is better',
  higher: 'Higher is better',
  none: 'No direction',
}

export function prefOf(attr: Attribute): PreferenceDirection {
  return attr.preferenceDirection ?? 'none'
}

export function isOrdered(attr: Attribute): boolean {
  return attr.type === 'categorical' && prefOf(attr) !== 'none'
}

export function typeParts(attr: Attribute): { main: string; rest: string[] } {
  const rest: string[] = []
  if (attr.type === 'numeric') {
    if (attr.unit) rest.push(attr.unit)
    if (attr.pivot && attr.pivot.mode !== 'none') rest.push('pivoted')
    return { main: 'Numeric', rest }
  }
  if (attr.type === 'categorical') {
    if (attr.unit) rest.push(attr.unit)
    rest.push(isOrdered(attr) ? 'ordered' : 'unordered')
    return { main: 'Categorical', rest }
  }
  if (attr.unit) rest.push(attr.unit)
  return { main: 'Boolean', rest }
}

export function unitSuffix(attr: Attribute): string {
  if (attr.unit) return attr.unit
  if (attr.displayFormat === 'percent') return '%'
  if (attr.displayFormat === 'duration') return 'min'
  return ''
}

export function chipText(attr: Attribute, level: Level): string {
  if (level.displayValue) return level.displayValue
  if (level.value === true) return 'True'
  if (level.value === false) return 'False'
  return String(level.value)
}

export type NumberLineModel = {
  values: number[]
  label: (v: number) => string
  ref: number | null
  suffix: string
  description: string
}

// Null when no level has a finite numeric value; callers fall back to chips.
export function numberLineModel(attr: Attribute, levels: Level[]): NumberLineModel | null {
  const values = levels.map((l) => Number(l.value)).filter((v) => Number.isFinite(v))
  if (values.length === 0) return null
  const mode = attr.pivot?.mode ?? 'none'
  const ref = mode === 'relative' ? 1 : mode === 'absolute' ? 0 : null
  const label =
    mode === 'relative' ? (v: number) => `×${fmtMultiplier(v)}` : mode === 'absolute' ? fmtSigned : fmtNum
  const suffix = mode === 'relative' ? '' : unitSuffix(attr)
  const list = values.map((v) => (ref !== null && v === ref ? `${label(v)} (reference)` : label(v))).join(', ')
  const unit = suffix ? ` ${suffix}` : ''
  const description =
    mode === 'relative'
      ? `Levels as multipliers of the respondent's reference value: ${list}`
      : mode === 'absolute'
        ? `Levels as changes from the respondent's reference value: ${list}${unit}`
        : `Levels to scale: ${list}${unit}`
  return { values, label, ref, suffix, description }
}

// What respondents see for a level, split so a pivot change can be shown as its own tag.
export function levelPreview(attr: Attribute, level: Level): { text: string; delta: string | null } {
  const resolved = resolvePivotValue(level, attr.pivot)
  if (resolved !== null) {
    const delta = pivotDeltaText(level, attr.pivot)
    return {
      text: trueMinus(formatNumeric(resolved, attr.unit, attr.displayFormat)),
      delta: delta ? trueMinus(delta) : null,
    }
  }
  return { text: trueMinus(levelDisplayText(attr, level)), delta: null }
}

export function newLevelId(prefix: string): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `lv_${prefix}_${Math.random().toString(36).slice(2, 8)}`
}
