'use client'

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './cx'
import { rovingIndex } from './roving'

export type SegOption<V extends string> = { value: V; label: ReactNode; disabled?: boolean }

export type SegProps<V extends string> = {
  options: SegOption<V>[]
  value: V
  onChange: (v: V) => void
  size?: 'sm' | 'md'
  ariaLabel: string
  className?: string
}

export function Seg<V extends string>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel,
  className,
}: SegProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selected = options.findIndex((o) => o.value === value)
  // The tab stop must land on an enabled radio, or the group is unreachable by keyboard.
  const tabStop =
    selected >= 0 && !options[selected].disabled ? selected : options.findIndex((o) => !o.disabled)

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const enabled = options.flatMap((o, j) => (o.disabled ? [] : [j]))
    const pos = rovingIndex(e, Math.max(0, enabled.indexOf(i)), enabled.length)
    if (pos === null) return
    e.preventDefault()
    const next = enabled[pos]
    refs.current[next]?.focus()
    onChange(options[next].value)
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx('inline-flex gap-0.5 rounded-well bg-surface-3 p-0.5', className)}
    >
      {options.map((o, i) => {
        const on = i === selected
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === tabStop ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              'focus-ring inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-ctl font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              size === 'sm' ? 'h-[22px] px-2 text-12' : 'h-[26px] px-2.5 text-13',
              on ? 'bg-surface text-ink shadow-pressed' : 'text-ink-2 enabled:hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
