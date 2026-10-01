'use client'

import { Fragment, useEffect, useId, useState, type ReactNode } from 'react'
import type { Project, ValidationConfig } from '@/lib/schema'
import type { LevelBalanceRow } from '@/lib/diagnostics'
import { altIdentity, type AltIdentity } from '@/lib/altIdentity'
import {
  formatCount,
  formatSigned,
  sharedLevelsText,
  type ConstraintViolations,
} from '@/lib/diagnosticsView'
import { useDesignHealth } from '../DesignHealth'
import { plural } from '@/lib/text'
import { constraintLabel, constraintProblems } from '@/lib/constraints'
import { AltGlyph, SeverityPips, Tag, cx } from '../ui'
import { ArrowIcon, ChevronIcon, FIGURE_IDS, FigureLink, SectionLink } from './bits'
import { CHECK_LABEL, type CheckKey, type CheckTally, type FilterKey } from './model'

const PAGE = 10
const BASE_ORDER: CheckKey[] = ['correlation', 'dominance', 'overlap', 'balance', 'constraints']

type Item = { key: string; node: ReactNode }

type Group = {
  key: CheckKey
  /** Plural noun for the items, used by "Show all". */
  noun: string
  desc: string
  tally: CheckTally
  items: Item[]
  empty: string
  badge?: ReactNode
}

function Glyphed({ id }: { id: AltIdentity }) {
  return (
    <span className="whitespace-nowrap">
      <AltGlyph identity={id} className="mr-1" />
      {id.label}
    </span>
  )
}

function Row({
  sv,
  who,
  what,
  met,
  go,
  wideWho,
  metTone = 'mono',
}: {
  sv: ReactNode
  who: ReactNode
  what?: ReactNode
  met?: ReactNode
  go: ReactNode
  wideWho?: boolean
  metTone?: 'mono' | 'muted'
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-5 py-2.5 text-13 xl:grid xl:min-h-[44px] xl:grid-cols-[84px_minmax(0,180px)_minmax(0,1fr)_minmax(0,180px)_auto] xl:gap-x-4 xl:py-2 xl:pl-[46px]">
      <span className="flex shrink-0 items-center">{sv}</span>
      <span className={cx('min-w-0 font-semibold text-ink', wideWho && 'xl:col-span-2')}>{who}</span>
      {!wideWho && <span className="min-w-0 basis-full text-ink-2 xl:basis-auto">{what}</span>}
      <span
        className={cx(
          'min-w-0 xl:text-right',
          metTone === 'mono' ? 'font-mono text-12 text-ink' : 'text-13 text-ink-3',
        )}
      >
        {met}
      </span>
      <span className="ml-auto xl:ml-0 xl:justify-self-end">{go}</span>
    </li>
  )
}

function SevBadges({ tally, zeroWord = 'Passed' }: { tally: CheckTally; zeroWord?: string }) {
  if (!tally.enabled) return <Tag tone="muted">Off</Tag>
  if (tally.total === 0) return <Tag tone="ok">{zeroWord}</Tag>
  return (
    <>
      {tally.concerns > 0 && (
        <Tag tone="risk">
          <span aria-hidden="true">
            <SeverityPips severity="concern" />
          </span>
          {plural(tally.concerns, 'concern')}
        </Tag>
      )}
      {tally.warnings > 0 && (
        <Tag tone="caution">
          <span aria-hidden="true">
            <SeverityPips severity="warning" />
          </span>
          {plural(tally.warnings, 'warning')}
        </Tag>
      )}
    </>
  )
}

function GroupBlock({
  group,
  open,
  onToggle,
  showAll,
  onShowAll,
}: {
  group: Group
  open: boolean
  onToggle: () => void
  showAll: boolean
  onShowAll: () => void
}) {
  const regionId = useId()
  const { key, tally, items } = group
  const visible = showAll ? items : items.slice(0, PAGE)
  return (
    <div className="border-t border-line first:border-t-0">
      <h4>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={onToggle}
          className="focus-ring flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-panel px-5 py-3.5 text-left"
        >
          <ChevronIcon
            className={cx('text-ink-3 transition-transform motion-reduce:transition-none', open && 'rotate-90')}
          />
          <span className="text-14 font-semibold text-ink">{CHECK_LABEL[key]}</span>
          <span className="tnum text-14 font-medium text-ink-3">{tally.total}</span>
          <span className="order-last basis-full pl-[26px] text-13 font-normal text-ink-3 md:order-none md:basis-auto md:pl-0">
            {group.desc}
          </span>
          <span className="ml-auto flex items-center gap-2">{group.badge ?? <SevBadges tally={tally} />}</span>
        </button>
      </h4>
      <div id={regionId} hidden={!open}>
        {items.length === 0 ? (
          <p className="px-5 pb-3.5 text-13 text-ink-3 xl:pl-[46px]">{group.empty}</p>
        ) : (
          <>
            <ul>
              {visible.map((it) => (
                <Fragment key={it.key}>{it.node}</Fragment>
              ))}
            </ul>
            {items.length > PAGE && (
              <div className="border-t border-line px-5 py-2 xl:pl-[46px]">
                <button
                  type="button"
                  onClick={onShowAll}
                  className="focus-ring rounded-ctl py-1 text-13 font-medium text-ink-2 hover:text-ink"
                >
                  {showAll ? 'Show fewer' : `Show all ${items.length} ${group.noun}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const openLabel = (taskId: number, block: number) => (
  <>
    Open
    <span className="sr-only">
      {' '}
      choice task {taskId}, block {block}
    </span>
    <ArrowIcon />
  </>
)

export function FindingsGroups({
  project,
  cfg,
  filter,
  tallies,
  violations,
  balanceRows,
}: {
  project: Project
  cfg: ValidationConfig
  filter: FilterKey
  tallies: Record<CheckKey, CheckTally>
  violations: ConstraintViolations
  balanceRows: LevelBalanceRow[]
}) {
  const { report, byTask } = useDesignHealth()
  const [open, setOpen] = useState<Partial<Record<CheckKey, boolean>>>({})
  const [showAll, setShowAll] = useState<Partial<Record<CheckKey, boolean>>>({})

  // Picking a filter opens that group, whatever the reader collapsed before.
  useEffect(() => {
    if (filter !== 'all') setOpen((o) => ({ ...o, [filter]: true }))
  }, [filter])

  const id = (altId: string) => altIdentity(project, altId)
  const attrName = (aid: string) => project.attributes.find((a) => a.id === aid)?.name ?? aid
  const pct = cfg.balance.maxDeviationPct

  // Correlation: concerns first, then by |r|.
  const correlation: Item[] = report.findings
    .filter((f) => f.check === 'correlation')
    .map((f) => ({
      f,
      altId: String(f.details.alternativeId),
      a: String(f.details.attrA),
      b: String(f.details.attrB),
      r: Number(f.details.r),
    }))
    .sort(
      (x, y) =>
        (x.f.severity === 'concern' ? 0 : 1) - (y.f.severity === 'concern' ? 0 : 1) ||
        Math.abs(y.r) - Math.abs(x.r),
    )
    .map(({ f, altId, a, b, r }) => ({
      key: `${altId}-${a}-${b}`,
      node: (
        <Row
          sv={<SeverityPips severity={f.severity} label />}
          who={<Glyphed id={id(altId)} />}
          what={`${attrName(a)} × ${attrName(b)}`}
          met={
            <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
              <span
                aria-hidden="true"
                className="relative inline-block h-1.5 w-16 overflow-hidden rounded-bar bg-surface-3"
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-bar bg-ink-2"
                  style={{ width: `${Math.min(1, Math.abs(r)) * 100}%` }}
                />
              </span>
              r = {formatSigned(r, 3)}
            </span>
          }
          go={
            <SectionLink section="design">
              In matrix
              <span className="sr-only">
                : {id(altId).label}, {attrName(a)} × {attrName(b)}
              </span>
              <ArrowIcon />
            </SectionLink>
          }
        />
      ),
    }))

  // Dominance: one row per choice task.
  let dominatedTotal = 0
  const dominance: Item[] = []
  byTask.forEach((t, i) => {
    if (t.dominated.length === 0) return
    dominatedTotal += t.dominated.length
    const pairs = t.findings.filter((f) => f.check === 'dominance')
    const compared = Array.from(
      new Set(pairs.flatMap((f) => (f.details.attributesCompared as string[] | undefined) ?? [])),
    ).map(attrName)
    dominance.push({
      key: `d-${i}`,
      node: (
        <Row
          sv={
            <span className="text-12 font-semibold text-caution">
              <span aria-hidden="true">×{pairs.length}</span>
              <span className="sr-only">{plural(pairs.length, 'dominance pair')}</span>
            </span>
          }
          who={
            <>
              Choice task {t.taskId} <span className="font-normal text-ink-3">· Block {t.block}</span>
            </>
          }
          what={t.dominated.map((d, k) => (
            // Inline blocks, so lines break between clauses before they break inside one.
            <span key={d.altId} className="mr-2 inline-block">
              {k > 0 && (
                <span className="text-ink-3">
                  <span aria-hidden="true">· </span>
                  <span className="sr-only">; </span>
                </span>
              )}
              <Glyphed id={id(d.altId)} /> <span className="text-ink-3">dominated by</span>{' '}
              {d.by.map((b, j) => (
                <Fragment key={b}>
                  {j > 0 && ', '}
                  <Glyphed id={id(b)} />
                </Fragment>
              ))}
            </span>
          ))}
          met={compared.join(', ')}
          metTone="muted"
          go={
            <SectionLink section="choice-tasks" task={{ block: t.block, taskId: t.taskId }}>
              {openLabel(t.taskId, t.block)}
            </SectionLink>
          }
        />
      ),
    })
  })

  // Overlap: one row per identical pair.
  const overlap: Item[] = []
  byTask.forEach((t, i) => {
    for (const f of t.findings) {
      if (f.check !== 'overlap') continue
      const a = String(f.details.altA)
      const b = String(f.details.altB)
      overlap.push({
        key: `o-${i}-${a}-${b}`,
        node: (
          <Row
            sv={
              <span className="font-mono text-12 font-normal text-caution">
                <span aria-hidden="true">=</span>
                <span className="sr-only">Identical</span>
              </span>
            }
            who={
              <>
                Choice task {t.taskId} <span className="font-normal text-ink-3">· Block {t.block}</span>
              </>
            }
            what={
              <>
                <Glyphed id={id(a)} /> <span className="text-ink-3">≡</span> <Glyphed id={id(b)} />
              </>
            }
            met={sharedLevelsText(project, i, a, (f.details.commonAttrs as string[] | undefined) ?? [])}
            metTone="muted"
            go={
              <SectionLink section="choice-tasks" task={{ block: t.block, taskId: t.taskId }}>
                {openLabel(t.taskId, t.block)}
              </SectionLink>
            }
          />
        ),
      })
    }
  })

  // Level balance: one row per imbalanced chart.
  const balance: Item[] = report.findings
    .filter((f) => f.check === 'balance')
    .map((f, n) => {
      const attrId = f.details.attributeId as string | undefined
      const altId = f.details.alternativeId as string | undefined
      const ctxId = f.details.contextVariableId as string | undefined
      const chart = balanceRows.find((r) =>
        ctxId ? r.kind === 'context' && r.id === ctxId : r.kind === 'attribute' && r.id === attrId && r.altId === altId,
      )
      const name = ctxId
        ? (project.contextVariables ?? []).find((c) => c.id === ctxId)?.name ?? ctxId
        : attrName(attrId ?? '')
      const worst =
        chart && chart.counts.length > 0
          ? chart.counts.reduce((w, c) =>
              Math.abs(c.count - chart.ideal) > Math.abs(w.count - chart.ideal) ? c : w,
            )
          : undefined
      const deviations = (f.details.deviations as { deviationPct: number }[] | undefined) ?? []
      const max = chart?.maxDeviation ?? Math.max(0, ...deviations.map((d) => Math.abs(d.deviationPct)))
      return {
        key: `b-${n}`,
        node: (
          <Row
            sv={<SeverityPips severity={f.severity} label />}
            who={name}
            what={
              <>
                {altId ? (
                  <>
                    <Glyphed id={id(altId)} /> ·{' '}
                  </>
                ) : ctxId ? (
                  'Context variable · '
                ) : null}
                max deviation {max.toFixed(1)}% &gt; {pct}%
              </>
            }
            met={
              worst && chart
                ? `${worst.label}: ${worst.count} vs ideal ${formatCount(chart.ideal)}`
                : undefined
            }
            go={
              <FigureLink figure={FIGURE_IDS.balance}>
                In chart
                <span className="sr-only">: level balance of {name}</span>
                <ArrowIcon />
              </FigureLink>
            }
          />
        ),
      }
    })

  // Constraints that can never match come first: they look like passes but forbid nothing.
  const broken: Item[] = constraintProblems(project).map(({ constraint: c, problem }) => ({
    key: `cb-${c.id}`,
    node: (
      <Row
        wideWho
        sv={
          <span className="inline-flex items-center gap-2 text-caution">
            <span aria-hidden="true">
              <SeverityPips severity="warning" />
            </span>
            <span className="text-12 font-semibold leading-none tracking-[0.02em]">Not checked</span>
          </span>
        }
        who={<span className="font-medium">{constraintLabel(c, project)}</span>}
        metTone="muted"
        met={problem}
        go={<SectionLink section="structure">Fix in Structure</SectionLink>}
      />
    ),
  }))

  // Constraints: one row per violated constraint, as before.
  const violated: Item[] = violations.groups.map((g) => {
    const first = g.tasks[0]
    return {
      key: `c-${g.constraint.id}`,
      node: (
        <Row
          wideWho
          sv={
            <span className="inline-flex items-center gap-2 text-risk">
              <span aria-hidden="true">
                <SeverityPips severity="concern" />
              </span>
              <span className="text-12 font-semibold leading-none tracking-[0.02em]">Violated</span>
            </span>
          }
          who={
            <>
              <span className="font-medium">{g.label}</span>{' '}
              <span className="font-normal text-ink-3">· {plural(g.tasks.length, 'choice task')}</span>
            </>
          }
          metTone="muted"
          met={
            <>
              <span className="sr-only">Violated in choice tasks </span>
              {g.tasks.slice(0, 8).map((t, k) => (
                <Fragment key={`${t.block}-${t.taskId}-${k}`}>
                  {k > 0 && ', '}
                  <SectionLink
                    section="choice-tasks"
                    task={t}
                    title={`Open choice task ${t.taskId}, block ${t.block}`}
                    className="focus-ring rounded-bar text-ink underline decoration-line-2 underline-offset-2 hover:decoration-ink"
                  >
                    {t.taskId}
                  </SectionLink>
                </Fragment>
              ))}
              {g.tasks.length > 8 && `, … (+${g.tasks.length - 8} more)`}
            </>
          }
          go={
            <SectionLink section="choice-tasks" task={first}>
              {openLabel(first.taskId, first.block)}
            </SectionLink>
          }
        />
      ),
    }
  })

  const groups: Group[] = [
    {
      key: 'correlation',
      noun: 'pairs',
      desc: 'Attribute pairs that move together within an alternative',
      tally: tallies.correlation,
      items: correlation,
      empty: cfg.correlation.enabled
        ? `No attribute pair has |r| above ${cfg.correlation.warnThreshold} within any alternative.`
        : 'This check is off for this project.',
    },
    {
      key: 'dominance',
      noun: 'choice tasks',
      desc:
        dominance.length > 0
          ? `Grouped by choice task · ${plural(dominatedTotal, 'dominated alternative')}`
          : 'An alternative no better on any attribute and worse on at least one',
      tally: tallies.dominance,
      items: dominance,
      empty: !cfg.dominance.enabled
        ? 'This check is off for this project.'
        : project.experimentType === 'labeled'
          ? 'Not checked in a labeled experiment: each alternative’s label carries its own appeal, so its attributes alone can’t show that it would never be chosen.'
          : project.attributes.some((a) => (a.preferenceDirection ?? 'none') === 'none')
            ? 'No alternative is dominated in any choice task. Attributes without a preference direction count as trade-offs; set their direction in 01 Structure for a complete check.'
            : 'No alternative is dominated in any choice task.',
    },
    {
      key: 'overlap',
      noun: 'pairs',
      desc: 'Two alternatives identical on every common attribute',
      tally: tallies.overlap,
      items: overlap,
      empty: cfg.overlap.enabled
        ? 'No two alternatives are identical in any choice task.'
        : 'This check is off for this project.',
    },
    {
      key: 'balance',
      noun: 'charts',
      desc:
        balance.length > 0
          ? `Levels more than ${pct}% away from their ideal count`
          : `Every level within ±${pct}% of its ideal count`,
      tally: tallies.balance,
      items: balance,
      empty: cfg.balance.enabled
        ? `Every level appears within ±${pct}% of its ideal count.`
        : 'This check is off for this project.',
    },
    {
      key: 'constraints',
      noun: 'constraints',
      desc:
        violations.defined === 0
          ? 'No constraints defined'
          : `Forbidden combinations · ${violations.enabled} of ${violations.defined} enabled`,
      tally: tallies.constraints,
      items: [...broken, ...violated],
      empty:
        violations.defined === 0
          ? 'No constraints defined. Add forbidden combinations in 01 Structure.'
          : 'No choice task contains a forbidden combination.',
      badge: violations.defined === 0 ? <Tag tone="muted">Not set</Tag> : undefined,
    },
  ]

  const rank = (g: Group) => (g.tally.concerns > 0 ? 0 : g.tally.total > 0 ? 1 : 2)
  const shown = groups
    .filter((g) => filter === 'all' || g.key === filter)
    .sort((a, b) => rank(a) - rank(b) || BASE_ORDER.indexOf(a.key) - BASE_ORDER.indexOf(b.key))

  return (
    <div className="rounded-panel bg-surface shadow-hairline">
      {shown.map((g) => (
        <GroupBlock
          key={g.key}
          group={g}
          open={open[g.key] ?? g.tally.total > 0}
          onToggle={() => setOpen((o) => ({ ...o, [g.key]: !(o[g.key] ?? g.tally.total > 0) }))}
          showAll={!!showAll[g.key]}
          onShowAll={() => setShowAll((s) => ({ ...s, [g.key]: !s[g.key] }))}
        />
      ))}
    </div>
  )
}
