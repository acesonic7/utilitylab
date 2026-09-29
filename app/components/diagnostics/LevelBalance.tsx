'use client'

import type { Project, ValidationConfig } from '@/lib/schema'
import type { LevelBalanceRow } from '@/lib/diagnostics'
import { altIdentity, altStyle } from '@/lib/altIdentity'
import { balanceSummary, formatCount, isOutsideBand } from '@/lib/diagnosticsView'
import { useDesignHealth } from '../DesignHealth'
import { plural } from '@/lib/text'
import { AltGlyph, Panel, cx } from '../ui'

function Multiple({ project, row, pct }: { project: Project; row: LevelBalanceRow; pct: number }) {
  const id = row.altId ? altIdentity(project, row.altId) : null
  const { ideal } = row
  const maxCount = Math.max(0, ...row.counts.map((c) => c.count))
  const scale = Math.max(ideal * 1.5, ideal * (1 + pct / 100), maxCount, 1)
  const at = (v: number) => `${Math.min(100, (v / scale) * 100)}%`
  const lo = Math.max(0, ideal * (1 - pct / 100))
  const hi = ideal * (1 + pct / 100)
  const slots = Math.round(ideal * row.counts.length)
  const out = row.maxDeviation > pct

  return (
    <div className="min-w-0" style={id ? altStyle(id) : undefined}>
      <h4 className="truncate text-13 font-semibold text-ink" title={row.name}>
        {row.name}
      </h4>
      <p className="mb-2.5 text-12 text-ink-3">
        {id && (
          <>
            <AltGlyph identity={id} size={10} className="mr-1" />
            {id.label} ·{' '}
          </>
        )}
        {row.kind === 'context' ? plural(slots, 'choice task') : plural(slots, 'slot')} · ideal{' '}
        {formatCount(ideal)}
        {out && <span className="sr-only">. Outside ±{pct}% of the ideal count.</span>}
      </p>
      <ul>
        {row.counts.map((c) => {
          const off = isOutsideBand(c.count, ideal, pct)
          return (
            <li
              key={c.levelId}
              className="grid min-h-[18px] grid-cols-[minmax(0,84px)_minmax(24px,1fr)_auto] items-center gap-1.5 text-12 leading-[14px] text-ink-2"
            >
              <span className="break-words" title={c.label}>
                {c.label}
              </span>
              <span aria-hidden="true" className="relative h-2">
                <span
                  className="absolute -bottom-[3px] -top-[3px] rounded-[2px] bg-ok/[0.18]"
                  style={{ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }}
                />
                <span
                  className={cx('absolute bottom-px left-0 top-px rounded-r-[2px]', off ? 'bg-caution' : 'bg-ink-3')}
                  style={{ width: at(c.count) }}
                />
                <span className="absolute -bottom-1 -top-1 w-[1.5px] bg-ink" style={{ left: at(ideal) }} />
              </span>
              <span className={cx('tnum min-w-[14px] text-right font-mono', off ? 'text-caution' : 'text-ink')}>
                {c.count}
                {off && <span className="sr-only"> (outside the band)</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function LevelBalance({
  project,
  cfg,
  rows,
}: {
  project: Project
  cfg: ValidationConfig
  rows: LevelBalanceRow[]
}) {
  const { counts } = useDesignHealth()
  const pct = cfg.balance.maxDeviationPct
  const findings = counts.balance.warning + counts.balance.concern
  const summary = balanceSummary(rows, pct)
  const key = `Bar = count · line = ideal · band = ±${pct}%`
  const owners = [
    summary.attributes > 0 ? plural(summary.attributes, 'attribute') : null,
    summary.contexts > 0 ? plural(summary.contexts, 'context variable') : null,
  ]
    .filter(Boolean)
    .join(' and ')

  return (
    <Panel
      title="Level balance"
      count={cfg.balance.enabled ? plural(findings, 'finding') : 'check off'}
      actions={<span className="hidden md:inline">{key}</span>}
    >
      {rows.length === 0 ? (
        <p className="text-13 text-ink-3">No attribute or context variable has two or more levels to balance.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-[18px] gap-y-5">
          {rows.map((r) => (
            <Multiple key={`${r.kind}-${r.id}-${r.altId ?? ''}`} project={project} row={r} pct={pct} />
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <p className="mt-4 border-t border-line pt-3 text-12 text-ink-3">
          <span className="md:hidden">{key}. </span>
          {summary.outside.length === 0
            ? `Every level of ${owners} is within ±${pct}% of its ideal count.`
            : `${summary.outside.length} of ${plural(rows.length, 'chart')} ${summary.outside.length === 1 ? 'has' : 'have'} a level outside ±${pct}% of the ideal count (highlighted).`}{' '}
          Maximum deviation {summary.maxDeviation?.toFixed(1)}%.
        </p>
      )}
    </Panel>
  )
}
