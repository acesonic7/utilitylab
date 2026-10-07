import type { Attribute, Level } from './schema'

export type FillMethod = 'step' | 'count' | 'reference' | 'geometric'

export type FillInput = {
  method: FillMethod
  from: number
  to: number
  step: number
  count: number
  reference: number
  percent: number
  stepsEachSide: number
  start: number
  ratio: number
  // Round every value to a multiple of this; 0 = no rounding.
  round: number
}

export type FillResult = {
  values: number[]
  // Levels lost because rounding made them equal to a neighbour.
  merged: number
  error?: string
}

export const MAX_FILL_LEVELS = 12

export type RoundingKind = 'minutes' | 'hours' | 'currency' | 'multiplier' | 'plain'

const CURRENCY_UNITS = /^(eur|euro|euros|€|usd|\$|gbp|£|chf|sek|nok|dkk|pln|czk|huf|ron)$/i

export function roundingKind(attr: Attribute): RoundingKind {
  if (attr.pivot?.mode === 'relative') return 'multiplier'
  const unit = (attr.unit ?? '').trim()
  if (attr.displayFormat === 'currency' || CURRENCY_UNITS.test(unit)) return 'currency'
  if (/^(h|hr|hrs|hour|hours)$/i.test(unit)) return 'hours'
  if (attr.displayFormat === 'duration' || /^(min|mins|minute|minutes)$/i.test(unit)) return 'minutes'
  return 'plain'
}

export type RoundingOption = { value: number; label: string }

export function roundingOptions(kind: RoundingKind, unit?: string): { options: RoundingOption[]; fallback: number } {
  const u = unit?.trim() || ''
  const money = (v: number) => (CURRENCY_UNITS.test(u) && u.length > 1 ? `${v.toFixed(2)} ${u}` : v.toFixed(2))
  switch (kind) {
    case 'minutes':
      return { options: [0, 1, 5, 10, 15].map((v) => ({ value: v, label: v ? `${v} min` : 'No rounding' })), fallback: 5 }
    case 'hours':
      return { options: [0, 0.25, 0.5, 1].map((v) => ({ value: v, label: v ? `${v} h` : 'No rounding' })), fallback: 0.5 }
    case 'currency':
      return { options: [0, 0.01, 0.1, 0.5, 1].map((v) => ({ value: v, label: v ? money(v) : 'No rounding' })), fallback: 0.5 }
    case 'multiplier':
      return { options: [0, 0.01, 0.05, 0.1].map((v) => ({ value: v, label: v ? `×${v}` : 'No rounding' })), fallback: 0.05 }
    default:
      return { options: [0, 0.1, 1, 5, 10].map((v) => ({ value: v, label: v ? String(v) : 'No rounding' })), fallback: 1 }
  }
}

function decimals(step: number): number {
  const s = String(step)
  return s.includes('.') ? s.split('.')[1].length : 0
}

export function roundTo(x: number, step: number): number {
  if (!step) return Number(x.toFixed(6))
  return Number((Math.round(x / step) * step).toFixed(Math.max(decimals(step), 0)))
}

function raw(input: FillInput): number[] | string {
  const { method } = input
  const finite = (...xs: number[]) => xs.every(Number.isFinite)
  if (method === 'step') {
    const { from, to, step } = input
    if (!finite(from, to, step)) return 'Enter a start, an end and a step.'
    if (step <= 0) return 'The step must be more than 0.'
    if (to < from) return 'The end must not be below the start.'
    const n = Math.floor((to - from) / step + 1e-9) + 1
    if (n > MAX_FILL_LEVELS) return `That makes ${n} levels; use a bigger step (at most ${MAX_FILL_LEVELS} levels).`
    return Array.from({ length: n }, (_, i) => from + i * step)
  }
  if (method === 'count') {
    const { from, to } = input
    const n = Math.round(input.count)
    if (!finite(from, to, n)) return 'Enter a start, an end and a number of levels.'
    if (n < 2) return 'Use at least 2 levels.'
    if (n > MAX_FILL_LEVELS) return `Use at most ${MAX_FILL_LEVELS} levels.`
    return Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1))
  }
  if (method === 'reference') {
    const { reference, percent } = input
    const k = Math.round(input.stepsEachSide)
    if (!finite(reference, percent, k)) return 'Enter a reference, a step and how many steps each side.'
    if (k < 1) return 'Use at least 1 step each side.'
    if (2 * k + 1 > MAX_FILL_LEVELS) return `That makes ${2 * k + 1} levels; use at most ${(MAX_FILL_LEVELS - 1) / 2 | 0} steps each side.`
    return Array.from({ length: 2 * k + 1 }, (_, i) => reference * (1 + ((i - k) * percent) / 100))
  }
  const { start, ratio } = input
  const n = Math.round(input.count)
  if (!finite(start, ratio, n)) return 'Enter a start, a ratio and a number of levels.'
  if (start === 0) return 'A geometric series needs a non-zero start.'
  if (ratio <= 0 || ratio === 1) return 'The ratio must be above 0 and not 1.'
  if (n < 2) return 'Use at least 2 levels.'
  if (n > MAX_FILL_LEVELS) return `Use at most ${MAX_FILL_LEVELS} levels.`
  return Array.from({ length: n }, (_, i) => start * ratio ** i)
}

export function fillValues(input: FillInput): FillResult {
  const r = raw(input)
  if (typeof r === 'string') return { values: [], merged: 0, error: r }
  const rounded = r.map((x) => roundTo(x, input.round))
  const values = [...new Set(rounded)].sort((a, b) => a - b)
  return { values, merged: rounded.length - values.length }
}

// Starting inputs that reproduce the attribute's current levels where possible.
export function defaultFillInput(attr: Attribute, levels: Level[]): FillInput {
  const xs = levels.map((l) => Number(l.value)).filter(Number.isFinite).sort((a, b) => a - b)
  const kind = roundingKind(attr)
  const multiplier = kind === 'multiplier'
  const lo = xs.length ? xs[0] : multiplier ? 0.6 : 10
  const hi = xs.length ? xs[xs.length - 1] : multiplier ? 1.4 : 50
  const n = Math.max(3, Math.min(5, xs.length || 3))
  const span = hi - lo
  const mid = xs.length ? xs[Math.floor(xs.length / 2)] : (lo + hi) / 2
  return {
    method: 'count',
    from: lo,
    to: hi > lo ? hi : lo + 1,
    step: span > 0 ? roundTo(span / (n - 1), 0) : 1,
    count: n,
    reference: multiplier ? 1 : mid || 1,
    percent: 20,
    stepsEachSide: 2,
    start: lo > 0 ? lo : 1,
    ratio: 2,
    round: roundingOptions(kind, attr.unit).fallback,
  }
}

export type FillNote = { tone: 'warning' | 'note'; text: string }

export function fillNotes(attr: Attribute, input: FillInput, result: FillResult): FillNote[] {
  const notes: FillNote[] = []
  if (result.merged > 0) {
    notes.push({
      tone: 'warning',
      text: `Rounding merged ${result.merged} ${result.merged === 1 ? 'level' : 'levels'} into a neighbour; use finer rounding to keep ${result.merged === 1 ? 'it' : 'them'}.`,
    })
  }
  const pivot = attr.pivot?.mode
  if (pivot !== 'absolute' && result.values.some((v) => v < 0)) {
    notes.push({ tone: 'warning', text: 'Some levels are negative; check the start, reference or step.' })
  }
  if (pivot === 'relative' && result.values.some((v) => v <= 0)) {
    notes.push({ tone: 'warning', text: 'Multipliers must be above 0.' })
  }
  if (result.values.length > 5) {
    notes.push({
      tone: 'warning',
      text: `${result.values.length} levels: with few choice tasks each level appears rarely, so balance and precision suffer. 3–5 levels is typical.`,
    })
  }
  if (input.method === 'geometric') {
    notes.push({ tone: 'note', text: 'Geometric spacing follows how people perceive differences: 5→10 min feels bigger than 50→55 min.' })
  }
  if (input.method === 'reference' && !pivot) {
    notes.push({
      tone: 'note',
      text: 'To vary levels around each respondent’s own trip instead of one fixed value, set Pivot to Multiplier and fill multipliers around 1.0.',
    })
  }
  return notes
}

// New levels for `values`; with `keep`, existing levels whose value is among them are reused,
// so their ids, labels and images survive.
export function buildLevels(values: number[], newId: (i: number) => string, keep: Level[] = []): Level[] {
  return values.map((v, i) => {
    const existing = keep.find((l) => Number(l.value) === v)
    return existing ? { ...existing, position: i } : { id: newId(i), value: v, position: i }
  })
}

export function mergeValues(existing: Level[], values: number[]): number[] {
  const current = existing.map((l) => Number(l.value)).filter(Number.isFinite)
  return [...new Set([...current, ...values])].sort((a, b) => a - b)
}
