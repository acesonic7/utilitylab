'use client'

import type { ValidationConfig } from '@/lib/schema'
import { cx } from '../ui'
import { CHECK_LABEL, CHECK_ORDER, type CheckKey, type CheckTally, type FilterKey } from './model'

function Chip({
  label,
  count,
  on,
  off,
  onClick,
}: {
  label: string
  count: number
  on: boolean
  off?: boolean
  onClick: () => void
}) {
  const quiet = !on && (off || count === 0)
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'focus-ring inline-flex h-[30px] items-center gap-2 whitespace-nowrap rounded-pill border px-3 text-13 font-medium leading-none transition-colors',
        on
          ? 'border-ink bg-ink text-surface'
          : cx('border-line-2 bg-surface hover:border-ink-4', quiet ? 'text-ink-3' : 'text-ink-2'),
      )}
    >
      {label}
      {off ? (
        <span className={cx('text-12 font-medium', on ? 'text-surface' : 'text-ink-3')}>off</span>
      ) : (
        <b className={cx('tnum', on ? 'font-semibold text-surface' : quiet ? 'font-medium text-ink-3' : 'font-semibold text-ink')}>
          {count}
        </b>
      )}
    </button>
  )
}

export function FilterChips({
  value,
  onChange,
  tallies,
  total,
  cfg,
}: {
  value: FilterKey
  onChange: (f: FilterKey) => void
  tallies: Record<CheckKey, CheckTally>
  total: number
  cfg: ValidationConfig
}) {
  const code = (s: string) => <code className="font-mono text-12 text-ink-2">{s}</code>
  return (
    <div className="mb-[18px] flex flex-wrap items-center gap-x-1.5 gap-y-2">
      <div role="group" aria-label="Filter findings" className="flex flex-wrap items-center gap-1.5">
        <Chip label="All" count={total} on={value === 'all'} onClick={() => onChange('all')} />
        {CHECK_ORDER.map((k) => (
          <Chip
            key={k}
            label={CHECK_LABEL[k]}
            count={tallies[k].total}
            off={!tallies[k].enabled}
            on={value === k}
            onClick={() => onChange(value === k ? 'all' : k)}
          />
        ))}
      </div>
      <p className="basis-full text-12 text-ink-3 xl:ml-auto xl:basis-auto">
        Thresholds:{' '}
        {cfg.correlation.enabled ? (
          <>
            {code(`|r| > ${cfg.correlation.warnThreshold}`)} warning · {code(`|r| > ${cfg.correlation.concernThreshold}`)}{' '}
            concern
          </>
        ) : (
          'correlation off'
        )}{' '}
        · balance {cfg.balance.enabled ? code(`±${cfg.balance.maxDeviationPct}%`) : 'off'}
      </p>
    </div>
  )
}
