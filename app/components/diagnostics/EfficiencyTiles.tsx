'use client'

import { Fragment, type ReactNode } from 'react'
import type { Project, ValidationConfig } from '@/lib/schema'
import type { SampleStatus } from '@/lib/sampleSize'
import { paramLayout } from '@/lib/dOptimal'
import { altIdentity } from '@/lib/altIdentity'
import type { LevelBalanceRow } from '@/lib/diagnostics'
import {
  balanceSummary,
  formatCount,
  formatSigned,
  strongestPairs,
  type AltCorrelation,
} from '@/lib/diagnosticsView'
import { useDesignHealth } from '../DesignHealth'
import { joinNames, plural } from '@/lib/text'
import { AltGlyph, Gauge, SeverityPips, Tag, type GaugeBand, type TagTone } from '../ui'
import { SectionLink } from './bits'

// Same thresholds as analyzeSample in lib/sampleSize.ts: low < 25, borderline < 50, good.
const OBS_BANDS: GaugeBand[] = [
  { to: 25, tone: 'risk' },
  { to: 50, tone: 'caution' },
  { to: 200, tone: 'ok' },
]

const SAMPLE_TAG: Record<SampleStatus, { tone: TagTone; word: string }> = {
  good: { tone: 'ok', word: 'Enough' },
  borderline: { tone: 'caution', word: 'Borderline' },
  low: { tone: 'risk', word: 'Low' },
  unset: { tone: 'muted', word: 'Not set' },
}

function Tile({
  title,
  value,
  unit,
  tag,
  caption,
  children,
}: {
  title: string
  value: ReactNode
  unit?: string
  tag: ReactNode
  caption: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-panel bg-surface px-[18px] py-4 shadow-hairline">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="text-13 font-medium text-ink-2">{title}</h3>
        {tag}
      </div>
      <p className="tnum mt-1.5 font-display text-34 font-medium tracking-[-0.025em] text-ink [font-variation-settings:'opsz'_40]">
        {value}
        {unit != null && (
          <span className="ml-1 font-sans text-14 font-normal tracking-normal text-ink-3 [font-variation-settings:normal]">
            {unit}
          </span>
        )}
      </p>
      {children}
      <p className="mt-2 text-12 text-ink-3">{caption}</p>
    </div>
  )
}

function SeverityTag({ severity }: { severity: 'ok' | 'warning' | 'concern' }) {
  if (severity === 'ok') return <Tag tone="ok">OK</Tag>
  return (
    <Tag tone={severity === 'concern' ? 'risk' : 'caution'}>
      <SeverityPips severity={severity} label />
    </Tag>
  )
}

export function EfficiencyTiles({
  project,
  cfg,
  balanceRows,
  correlations,
}: {
  project: Project
  cfg: ValidationConfig
  balanceRows: LevelBalanceRow[]
  correlations: AltCorrelation[]
}) {
  const health = useDesignHealth()
  const layout = paramLayout(project)
  const K = health.K
  const asc = layout.ascCount

  // D-error
  const priors = health.priorsNonZero ? 'non-zero' : 'zero'
  const kParts =
    asc > 0 ? `${plural(asc, 'constant')} + ${plural(K - asc, 'attribute term')}` : 'all attribute terms'
  const dCaption =
    K === 0
      ? 'No parameters to estimate yet. Add attributes in 01 Structure.'
      : health.dError !== null
        ? `${health.priorsNonZero ? 'Dp-error: MNL at your fixed, non-zero priors' : 'Dz-error: MNL with every prior at zero'}, ${plural(K, 'parameter')} (${kParts}). Lower is better, but only for the same model and priors; ${health.priorsNonZero ? 'if the true values differ from your priors, the design can lose much of its efficiency' : 'it says nothing about how the design does if the true coefficients are not zero'}.`
        : `Not computable: this design does not identify all ${plural(K, 'parameter')} (${kParts}). Add choice tasks or vary more levels.`

  // Observations per parameter
  const sample = health.sample
  const status: SampleStatus = sample?.status ?? 'unset'
  const obs = sample && status !== 'unset' ? Math.round(sample.observationsPerParameter) : null
  const N = project.targetSampleSize ?? 0
  const perResp = sample ? formatCount(sample.tasksPerRespondent) : '0'

  // Level balance
  const pct = cfg.balance.maxDeviationPct
  const bal = balanceSummary(balanceRows, pct)
  const owners = [
    bal.attributes > 0 ? plural(bal.attributes, 'attribute') : null,
    bal.contexts > 0 ? plural(bal.contexts, 'context variable') : null,
  ].filter(Boolean) as string[]
  const outsideNames = Array.from(
    new Set(
      bal.outside.map((r) =>
        r.altId ? `${r.name} (${altIdentity(project, r.altId).label})` : r.name,
      ),
    ),
  )
  const balCaption =
    bal.maxDeviation === null
      ? 'No attribute or context variable has two or more levels to balance.'
      : outsideNames.length === 0
        ? `Every level of ${joinNames(owners)} is within ±${pct}% of its ideal count.`
        : `Outside ±${pct}% of the ideal count: ${joinNames(outsideNames)}.`
  const balTag = !cfg.balance.enabled ? (
    <Tag tone="muted">Check off</Tag>
  ) : bal.maxDeviation === null ? (
    <Tag tone="muted">No levels</Tag>
  ) : bal.outside.length > 0 ? (
    <Tag tone="caution">Imbalanced</Tag>
  ) : (
    <Tag tone="ok">Balanced</Tag>
  )

  // Largest |r|
  const strongest = strongestPairs(correlations)
  const top = strongest?.pairs ?? []
  const topSeverity = top.some((p) => p.severity === 'concern')
    ? 'concern'
    : top.some((p) => p.severity === 'warning')
      ? 'warning'
      : 'ok'
  const attrName = (id: string) => project.attributes.find((a) => a.id === id)?.name ?? id
  const shown = top.slice(0, 2)
  const perfect = strongest !== null && strongest.abs >= 0.9995
  const rCaption: ReactNode =
    strongest === null ? (
      'No attribute pair varies enough within an alternative to correlate.'
    ) : (
      <>
        {shown.map((p, i) => {
          const id = altIdentity(project, p.altId)
          return (
            <Fragment key={`${p.altId}-${p.a}-${p.b}`}>
              {i > 0 && (i === shown.length - 1 && top.length <= 2 ? ' and ' : ', ')}
              <AltGlyph identity={id} size={10} className="mr-1" />
              {id.label} {attrName(p.a)} × {attrName(p.b)}
              {!perfect && ` (r = ${formatSigned(p.r, 3)})`}
            </Fragment>
          )
        })}
        {top.length > 2 && ` and ${plural(top.length - 2, 'more pair')}`}
        {perfect ? (top.length > 1 ? ' are perfectly collinear.' : ' is perfectly collinear.') : '.'}
      </>
    )

  const obsCaption: ReactNode =
    obs === null && N > 0 ? (
      'No parameters to estimate yet.'
    ) : obs !== null ? (
      `${plural(N, 'respondent')} × ${perResp} ${Number(perResp) === 1 ? 'choice task' : 'choice tasks'} ÷ ${plural(K, 'parameter')}`
    ) : (
      <>
        Set the target number of respondents in{' '}
        <SectionLink
          section="design"
          className="focus-ring rounded-bar font-medium text-ink underline decoration-line-2 underline-offset-2 hover:decoration-ink"
        >
          02 Design
        </SectionLink>{' '}
        to estimate this.
      </>
    )

  const rTag = !strongest ? (
    <Tag tone="muted">n/a</Tag>
  ) : cfg.correlation.enabled ? (
    <SeverityTag severity={topSeverity} />
  ) : (
    <Tag tone="muted">Check off</Tag>
  )

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[1360px]:grid-cols-4">
      <Tile
        title="D-error"
        value={health.dError !== null ? health.dError.toFixed(3) : '—'}
        tag={<Tag tone="muted">priors: {priors}</Tag>}
        caption={dCaption}
      />

      <Tile
        title="Observations per parameter"
        value={obs ?? '—'}
        tag={<Tag tone={SAMPLE_TAG[status].tone}>{SAMPLE_TAG[status].word}</Tag>}
        caption={obsCaption}
      >
        {obs !== null && (
          <Gauge
            value={obs}
            min={0}
            max={200}
            bands={OBS_BANDS}
            ticks
            className="mt-2.5"
            ariaLabel={`Observations per parameter: ${obs}, ${SAMPLE_TAG[status].word.toLowerCase()}. Low below 25, borderline 25 to 50, good from 50.`}
          />
        )}
      </Tile>

      <Tile
        title="Level balance"
        value={bal.maxDeviation !== null ? bal.maxDeviation.toFixed(1) : '—'}
        unit={bal.maxDeviation !== null ? '% max deviation' : undefined}
        tag={balTag}
        caption={balCaption}
      />

      <Tile
        title="Largest |r|"
        value={strongest ? strongest.abs.toFixed(3) : '—'}
        tag={rTag}
        caption={rCaption}
      />
    </div>
  )
}
