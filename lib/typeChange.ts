import type { Attribute, AttributeType, ContextVariable, Level } from './schema'
import { formatNumeric } from './format'

// Changing an attribute's type used to swap only the `type` field, so a boolean kept levels
// 1/2/3 (shown as three "True" rows, and to respondents as "1"), and a categorical kept hidden
// per-alternative levels and an active pivot. These rebuild the levels for the new type.
// Level ids are kept where a level carries over, so a design that used them still reads;
// any design the change invalidates is flagged by designFit.

type Typed = { type: AttributeType; levels: Level[]; unit?: string; displayFormat?: Attribute['displayFormat'] }

/** The text a respondent saw for the level under its old type. */
function shownText(t: Typed, l: Level): string {
  if (l.displayValue) return l.displayValue
  if (t.type === 'boolean') return isTrue(l.value) ? 'Yes' : 'No'
  if (t.type === 'numeric') return formatNumeric(Number(l.value), t.unit, t.displayFormat)
  return String(l.value)
}

function isTrue(v: Level['value']): boolean {
  return v === true || v === 1 || (typeof v === 'string' && /^(true|yes|y|1)$/i.test(v.trim()))
}

// "5 GB", "€2.00", "2,5" → a number; null when the text holds none or several.
function numberIn(text: string): number | null {
  const s = text.trim().replace(/−/g, '-').replace(/^([-+]?\d+),(\d+)$/, '$1.$2')
  if (s !== '' && Number.isFinite(Number(s))) return Number(s)
  const m = s.match(/^[^\d+\-.]*([-+]?(?:\d+\.?\d*|\.\d+))\s*[^\d]*$/)
  return m ? Number(m[1]) : null
}

function convertLevels(t: Typed, to: AttributeType): Level[] {
  const from = t.levels
  if (to === 'boolean') {
    // Exactly two levels, Yes and No, reusing the ids of the first two levels.
    const ids = [from[0]?.id ?? 'true', from[1]?.id ?? 'false']
    return [
      { id: ids[0], value: true, displayValue: 'Yes', position: 0 },
      { id: ids[1], value: false, displayValue: 'No', position: 1 },
    ]
  }
  if (to === 'categorical') {
    return from.map((l, i) => ({ id: l.id, value: shownText(t, l), position: i, imageUrl: l.imageUrl }))
  }
  // numeric
  if (t.type === 'boolean') {
    return from.map((l, i) => ({ id: l.id, value: isTrue(l.value) ? 1 : 0, displayValue: shownText(t, l), position: i, imageUrl: l.imageUrl }))
  }
  const nums = from.map((l) => numberIn(String(l.value)))
  const usable = nums.every((n) => n !== null) && new Set(nums).size === nums.length
  return from.map((l, i) =>
    usable
      ? { id: l.id, value: nums[i]!, position: i, imageUrl: l.imageUrl }
      : // No distinct numbers in the labels: number the levels 1…n and keep the label for respondents.
        { id: l.id, value: i + 1, displayValue: shownText(t, l), position: i, imageUrl: l.imageUrl },
  )
}

export function changeAttributeType(attr: Attribute, to: AttributeType): Attribute {
  if (attr.type === to) return attr
  return {
    ...attr,
    type: to,
    levels: convertLevels(attr, to),
    // Per-alternative levels and pivots exist only for numeric attributes; the old type's display
    // format and priors (one per parameter, which the type decides) no longer apply.
    levelsByAlternative: to === 'numeric' && attr.type === 'numeric' ? attr.levelsByAlternative : undefined,
    pivot: undefined,
    displayFormat: undefined,
    priors: undefined,
  }
}

export function changeContextType(cv: ContextVariable, to: AttributeType): ContextVariable {
  if (cv.type === to) return cv
  return { ...cv, type: to, levels: convertLevels(cv, to), displayFormat: undefined }
}
