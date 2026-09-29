import type { Attribute, AttributePivot, Level } from './schema'

// Numeric formatter that respects displayFormat. Used by both the React
// preview (choice-tasks/RespondentCard) and the HTML-table renderer (renderTaskAsHtml).
export function formatNumeric(
  value: number,
  unit: string | undefined,
  displayFormat: string | undefined,
): string {
  const finite = Number.isFinite(value) ? value : 0
  if (displayFormat === 'currency') {
    if (unit === 'EUR') return `€${finite.toFixed(2)}`
    if (unit === 'USD') return `$${finite.toFixed(2)}`
    if (unit === 'GBP') return `£${finite.toFixed(2)}`
    return unit ? `${finite.toFixed(2)} ${unit}` : finite.toFixed(2)
  }
  if (displayFormat === 'percent') return `${finite}%`
  if (displayFormat === 'duration') return unit ? `${finite} ${unit}` : `${finite} min`
  if (Number.isInteger(finite)) {
    return unit ? `${finite} ${unit}` : String(finite)
  }
  return unit ? `${finite} ${unit}` : String(finite)
}

// Resolve a pivoted level to its concrete numeric value using the preview
// reference. Returns null when not pivoted (caller should fall back to the
// raw level value in that case).
export function resolvePivotValue(
  level: Level,
  pivot: AttributePivot | undefined,
): number | null {
  if (!pivot || pivot.mode === 'none' || pivot.previewReference === undefined) {
    return null
  }
  const v = Number(level.value)
  if (!Number.isFinite(v)) return null
  if (pivot.mode === 'absolute') return pivot.previewReference + v
  if (pivot.mode === 'relative') return pivot.previewReference * v
  return null
}

// Human-readable delta for a pivoted level (e.g. "−50%", "+5").
export function pivotDeltaText(
  level: Level,
  pivot: AttributePivot | undefined,
): string | null {
  if (!pivot || pivot.mode === 'none') return null
  const v = Number(level.value)
  if (!Number.isFinite(v)) return null
  if (pivot.mode === 'absolute') {
    if (v === 0) return 'no change'
    return v > 0 ? `+${v}` : String(v)
  }
  if (pivot.mode === 'relative') {
    const pct = (v - 1) * 100
    if (pct === 0) return 'no change'
    return pct > 0 ? `+${pct.toFixed(0)}%` : `${pct.toFixed(0)}%`
  }
  return null
}

// Single source of truth for level → display string. Handles pivoted and
// non-pivoted attributes uniformly.
export function levelDisplayText(
  attr: Attribute,
  level: Level | undefined,
): string {
  if (!level) return '—'

  // Pivoted: compute the resolved value, format, append delta
  const resolved = resolvePivotValue(level, attr.pivot)
  if (resolved !== null) {
    const formatted = formatNumeric(resolved, attr.unit, attr.displayFormat)
    const delta = pivotDeltaText(level, attr.pivot)
    return delta && delta !== 'no change' ? `${formatted} (${delta})` : formatted
  }

  // Non-pivoted
  if (level.displayValue) return level.displayValue
  if (attr.type === 'numeric') {
    return formatNumeric(Number(level.value), attr.unit, attr.displayFormat)
  }
  return String(level.value)
}
