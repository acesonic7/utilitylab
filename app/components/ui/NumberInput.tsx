'use client'

import { forwardRef, useEffect, useRef, useState } from 'react'
import { Input, type InputProps } from './Input'

/**
 * What an empty field means.
 * - 'revert' (default): the last value comes back on blur.
 * - 'clear': undefined is committed as soon as the field is cleared.
 * - a number: that number (clamped) is committed on blur.
 */
export type EmptyBehavior = 'revert' | 'clear' | number

type BaseProps = Omit<
  InputProps,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'step' | 'min' | 'max'
> & {
  value: number | undefined
  min?: number
  max?: number
  integer?: boolean
  /** Arrow-key increment. */
  step?: number
}

export type NumberInputProps = BaseProps &
  (
    | { emptyBehavior: 'clear'; onValueChange: (v: number | undefined) => void }
    | { emptyBehavior?: 'revert' | number; onValueChange: (v: number) => void }
  )

const PARTIAL = /^-?\d*[.,]?\d*$/

function parse(s: string): number {
  const t = s.trim()
  return t === '' ? NaN : Number(t.replace(',', '.'))
}

function decimals(n: number): number {
  const s = String(n)
  const i = s.indexOf('.')
  return i < 0 ? 0 : s.length - i - 1
}

// A text field, so decimals always show a '.' whatever the browser locale.
// The typed text is kept while focused and is never overwritten by the value prop, so the field
// also works when its parent renders a deferred (older) copy of the value.
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, onValueChange, emptyBehavior = 'revert', min, max, integer, step = 1, onFocus, onBlur, onKeyDown, ...rest },
  ref,
) {
  const [draft, setDraft] = useState<string | null>(null)
  const focused = useRef(false)
  // What this field last committed while focused; the value prop may not have caught up yet.
  const sent = useRef<{ v: number | undefined } | null>(null)

  useEffect(() => {
    if (!focused.current) setDraft(null)
  }, [value])

  const commit = onValueChange as (v: number | undefined) => void
  const send = (v: number | undefined) => {
    sent.current = { v }
    commit(v)
  }
  const current = () => (sent.current ? sent.current.v : value)
  const clamp = (n: number) => {
    const c = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))
    return integer ? Math.round(c) : c
  }

  const committed = value !== undefined && Number.isFinite(value) ? String(value) : ''
  const shown = draft ?? committed
  const invalid =
    draft !== null && draft.trim() !== '' && !PARTIAL.test(draft.trim()) && !Number.isFinite(parse(draft))

  return (
    <Input
      aria-invalid={invalid || undefined}
      {...rest}
      ref={ref}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      spellCheck={false}
      value={shown}
      onFocus={(e) => {
        focused.current = true
        sent.current = null
        onFocus?.(e)
      }}
      onChange={(e) => {
        const s = e.target.value
        setDraft(s)
        if (s.trim() === '') {
          if (emptyBehavior === 'clear' && current() !== undefined) send(undefined)
          return
        }
        const n = parse(s)
        if (Number.isFinite(n) && clamp(n) === n && n !== current()) send(n)
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e)
        if (e.defaultPrevented || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
        e.preventDefault()
        const parsed = parse(shown)
        const base = Number.isFinite(parsed) ? parsed : (current() ?? 0)
        const raw = base + (e.key === 'ArrowUp' ? step : -step)
        const next = clamp(Number(raw.toFixed(Math.max(decimals(base), decimals(step)))))
        setDraft(String(next))
        if (next !== current()) send(next)
      }}
      onBlur={(e) => {
        focused.current = false
        if (draft !== null) {
          const t = draft.trim()
          const n = parse(t)
          let next = current()
          if (t === '') {
            if (typeof emptyBehavior === 'number') next = clamp(emptyBehavior)
            else if (emptyBehavior === 'clear') next = undefined
          } else if (Number.isFinite(n)) {
            next = clamp(n)
          }
          if (next !== current()) send(next)
          // Show the settled value until the value prop next changes.
          setDraft(next === undefined ? '' : String(next))
        }
        sent.current = null
        onBlur?.(e)
      }}
    />
  )
})
