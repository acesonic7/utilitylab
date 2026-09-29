'use client'

import { Fragment, useMemo, type ReactNode } from 'react'
import type { Alternative, Attribute, Project } from '@/lib/schema'
import type { TaskDiagnostics } from '@/lib/diagnostics'
import { altIdentity, altStyle, type AltIdentity } from '@/lib/altIdentity'
import { appliesToAlt } from '@/lib/validation'
import { choiceProbabilities } from '@/lib/choiceProbabilities'
import { AltGlyph, Panel, ScrollX, SeverityPips, Tag, cx } from '../ui'
import { joinNames, plural } from '@/lib/text'
import { TINT_CLASSES, tintStep } from '@/lib/designMatrix'
import { cellFor, type TaskEntry, type ValueCell } from './model'

const LABEL_COL = 64
const MIN_COL = 58
const GAP = 4

function Named({ id }: { id: AltIdentity }) {
  return (
    <span className="whitespace-nowrap">
      <AltGlyph identity={id} size={11} className="mr-1" />
      {id.label}
    </span>
  )
}

function namedList(ids: AltIdentity[]): ReactNode {
  return ids.map((id, i) => (
    <Fragment key={id.altId}>
      {i > 0 && (i === ids.length - 1 ? ' and ' : ', ')}
      <Named id={id} />
    </Fragment>
  ))
}

export function AnalystLens({
  project,
  entry,
  diag,
  violated,
  alternatives,
  attributes,
  priorsNonZero,
  className,
}: {
  project: Project
  entry: TaskEntry
  diag: TaskDiagnostics | undefined
  /** Labels of the enabled constraints this choice task violates. */
  violated: string[]
  /** Non-opt-out alternatives in display order. */
  alternatives: Alternative[]
  attributes: Attribute[]
  priorsNonZero: boolean
  className?: string
}) {
  const { row } = entry
  const ids = alternatives.map((a) => altIdentity(project, a.id))
  const col = new Map(alternatives.map((a, i) => [a.id, i]))
  const J = alternatives.length

  const dominatedBy = new Map((diag?.dominated ?? []).map((d) => [d.altId, d.by]))
  const pairs = (diag?.identical ?? [])
    .filter(([a, b]) => col.has(a) && col.has(b))
    .map(([a, b]) => {
      const [x, y] = [col.get(a)!, col.get(b)!].sort((m, n) => m - n)
      return { a, b, from: x, to: y }
    })
  const findings = diag?.findings ?? []
  const nDominance = findings.filter((f) => f.check === 'dominance').length
  const nOverlap = findings.filter((f) => f.check === 'overlap').length
  const violations = violated.length

  // Every modelled alternative, the opt-out included; under zero priors each gets 1/J.
  const probs = useMemo(
    () => new Map(choiceProbabilities(project, row).map((p) => [p.altId, p.p])),
    [project, row],
  )
  const optOutP = project.alternatives
    .filter((a) => a.isOptOut)
    .reduce((sum, a) => sum + (probs.get(a.id) ?? 0), 0)
  const modelJ = probs.size

  const cells = attributes.map((attr) => alternatives.map((alt) => cellFor(attr, alt, row)))
  const valueOf = (attrId: string, altId: string): ValueCell | null => {
    const r = attributes.findIndex((a) => a.id === attrId)
    const c = col.get(altId)
    if (r < 0 || c === undefined) return null
    const cell = cells[r][c]
    return cell.kind === 'value' ? cell : null
  }

  const minWidth = LABEL_COL + J * (MIN_COL + GAP) + GAP * 2

  return (
    <Panel
      flush
      title="Analyst lens"
      actions={
        <span>
          Choice task {row.taskId} · Block {row.block}
        </span>
      }
      className={className}
    >
      <div className="flex flex-wrap gap-1.5 px-5 pb-3">
        {violations > 0 && (
          <Tag>
            <SeverityPips severity="concern" />
            {plural(violations, 'constraint violation')}
          </Tag>
        )}
        {nDominance > 0 && (
          <Tag>
            <SeverityPips severity="warning" />
            {nDominance} dominance
          </Tag>
        )}
        {nOverlap > 0 && (
          <Tag>
            <SeverityPips severity="warning" />
            {nOverlap} overlap
          </Tag>
        )}
        {findings.length === 0 && violations === 0 && (
          <Tag tone="ok">
            <SeverityPips severity="ok" />
            No findings
          </Tag>
        )}
      </div>

      {J === 0 ? (
        <p className="px-5 pb-4 text-13 text-ink-3">No alternatives with attributes to compare.</p>
      ) : (
        <ScrollX label="Analyst lens table, scrolls sideways" className="relative rounded-bar px-4">
          <table
            className="w-full table-fixed border-separate border-spacing-1"
            style={{ minWidth }}
          >
            <caption className="sr-only">
              Levels of choice task {row.taskId} by attribute and alternative, with level codes
            </caption>
            <colgroup>
              <col style={{ width: LABEL_COL }} />
              {alternatives.map((a) => (
                <col key={a.id} />
              ))}
            </colgroup>
            <thead>
              {pairs.map((p) => {
                const span = p.to - p.from + 1
                const inset = `calc((100% - ${(span - 1) * GAP}px) / ${2 * span})`
                return (
                  <tr key={`${p.a}-${p.b}`} aria-hidden="true">
                    <td className="p-0" />
                    {p.from > 0 && <td colSpan={p.from} className="p-0" />}
                    <td colSpan={span} className="relative h-[26px] p-0">
                      <span
                        className="absolute bottom-0 h-[7px] rounded-t-[2px] border-[1.5px] border-b-0 border-caution"
                        style={{ left: inset, right: inset }}
                      />
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-surface px-1.5 text-12 font-semibold leading-[14px] text-caution">
                        ≡ identical
                      </span>
                    </td>
                    {J - 1 - p.to > 0 && <td colSpan={J - 1 - p.to} className="p-0" />}
                  </tr>
                )
              })}
              <tr>
                <td className="p-0" />
                {ids.map((id) => (
                  <th
                    key={id.altId}
                    scope="col"
                    className="px-0.5 py-1.5 text-center align-top text-12 font-semibold leading-4 text-ink"
                  >
                    <span className="mb-1 flex h-[11px] justify-center">
                      <AltGlyph identity={id} size={11} />
                    </span>
                    <span className="block">
                      {id.label}
                      {dominatedBy.has(id.altId) && <span className="sr-only"> (dominated)</span>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attributes.map((attr, r) => (
                <tr key={attr.id}>
                  <th
                    scope="row"
                    className="pr-1 text-left align-middle text-12 font-normal leading-[15px] text-ink-2"
                  >
                    {attr.name}
                  </th>
                  {alternatives.map((alt, c) => {
                    const cell = cells[r][c]
                    const id = ids[c]
                    const dominated = dominatedBy.has(alt.id)
                    if (cell.kind !== 'value') {
                      return (
                        <td key={alt.id} className="p-0">
                          <div
                            className={cx(
                              'flex h-11 items-center justify-center rounded-ctl text-ink-3',
                              cell.kind === 'na' ? 'hatch' : 'bg-surface-2',
                            )}
                          >
                            {cell.kind === 'missing' && <span aria-hidden="true">—</span>}
                            <span className="sr-only">
                              {cell.kind === 'missing' ? 'No level set' : 'Not applicable'}
                            </span>
                          </div>
                        </td>
                      )
                    }
                    return (
                      <td key={alt.id} className="p-0">
                        <div
                          style={altStyle(id)}
                          title={`${id.label} · ${attr.name}: ${cell.text} (level ${cell.index + 1} of ${cell.count})`}
                          className={cx(
                            'flex h-11 flex-col items-center justify-center rounded-ctl px-0.5',
                            TINT_CLASSES[tintStep(cell.index, cell.count)],
                            dominated && 'hatch-dense',
                          )}
                        >
                          <span
                            className={cx(
                              'tnum max-w-full truncate font-semibold text-ink',
                              cell.short.length > 5 ? 'text-12 leading-4' : 'text-13 leading-4',
                            )}
                          >
                            {cell.short}
                          </span>
                          <span className="font-mono text-12 font-normal leading-3 text-ink-2">
                            L{cell.index + 1}
                          </span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
              {dominatedBy.size > 0 && (
                <tr>
                  <th scope="row" className="p-0">
                    <span className="sr-only">Dominated by</span>
                  </th>
                  {alternatives.map((alt) => {
                    const by = (dominatedBy.get(alt.id) ?? []).map((b) => altIdentity(project, b))
                    return (
                      <td key={alt.id} className="px-0 pt-1 text-center align-top">
                        {by.length > 0 && (
                          <>
                            <span
                              aria-hidden="true"
                              className="block text-[11px] font-semibold leading-[14px] tracking-[-0.01em] text-caution"
                            >
                              dominated
                              <span className="mt-[3px] flex flex-wrap items-center justify-center gap-[3px]">
                                by
                                {by.map((b) => (
                                  <AltGlyph key={b.altId} identity={b} size={10} />
                                ))}
                              </span>
                            </span>
                            <span className="sr-only">{joinNames(by.map((b) => b.label))}</span>
                          </>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )}
            </tbody>
            <tbody>
              <tr>
                <td colSpan={J + 1} className="px-0 pb-1 pt-3">
                  <div className="flex items-baseline justify-between gap-2 border-t border-line pt-3.5 text-12">
                    <span className="font-semibold text-ink">Choice probabilities</span>
                    <span
                      className="text-ink-3"
                      title={priorsNonZero ? undefined : `Equal (1/J) under zero priors, J = ${modelJ}`}
                    >
                      MNL · priors: {priorsNonZero ? 'set' : 'zero'}
                      {!priorsNonZero && <span className="sr-only">, so each alternative is equally likely</span>}
                    </span>
                  </div>
                </td>
              </tr>
              <tr>
                <th scope="row" className="text-left align-bottom text-12 font-normal text-ink-3">
                  P(j)
                </th>
                {alternatives.map((alt, c) => {
                  const p = probs.get(alt.id) ?? 0
                  return (
                    <td key={alt.id} className="p-0 align-bottom">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          aria-hidden="true"
                          style={{ ...altStyle(ids[c]), height: Math.max(2, Math.round(p * 36)) }}
                          className="block w-full rounded-t-bar bg-[rgb(var(--alt)/0.7)]"
                        />
                        <span className="tnum font-mono text-12 text-ink-2">
                          <span className="sr-only">{ids[c].label}: </span>
                          {(p * 100).toFixed(p < 0.1 ? 1 : 0)}%
                        </span>
                      </div>
                    </td>
                  )
                })}
              </tr>
              {optOutP > 0 && (
                <tr>
                  <td colSpan={J + 1} className="pt-1.5 text-right text-12 text-ink-3">
                    Opt-out: <span className="tnum font-mono text-ink-2">{(optOutP * 100).toFixed(optOutP < 0.1 ? 1 : 0)}%</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollX>
      )}

      <ul className="mt-3 px-5 pb-4">
        {violated.map((label, i) => (
          <li
            key={`con-${i}`}
            className="grid grid-cols-[18px_minmax(0,1fr)] gap-x-2 border-t border-line py-2.5 text-13 text-ink"
          >
            <SeverityPips severity="concern" className="mt-[3px] self-start" />
            <div>
              Violates the constraint <b className="font-semibold">{label}</b>.
            </div>
          </li>
        ))}
        {(diag?.dominated ?? []).map((d) => {
          const loser = altIdentity(project, d.altId)
          const winners = d.by.map((b) => altIdentity(project, b))
          return (
            <li
              key={`dom-${d.altId}`}
              className="grid grid-cols-[18px_minmax(0,1fr)] gap-x-2 border-t border-line py-2.5 text-13 text-ink"
            >
              <SeverityPips severity="warning" className="mt-[3px] self-start" />
              <div>
                <b className="font-semibold">
                  <Named id={loser} />
                </b>{' '}
                is dominated by {namedList(winners)}.
                <p className="mt-[3px] text-12 text-ink-3">
                  {dominanceDetail(d.altId, d.by, diag, attributes, valueOf, project)}
                </p>
              </div>
            </li>
          )
        })}
        {pairs.map((p) => {
          const a = altIdentity(project, p.a)
          const b = altIdentity(project, p.b)
          return (
            <li
              key={`ovl-${p.a}-${p.b}`}
              className="grid grid-cols-[18px_minmax(0,1fr)] gap-x-2 border-t border-line py-2.5 text-13 text-ink"
            >
              <SeverityPips severity="warning" className="mt-[3px] self-start" />
              <div>
                <b className="font-semibold">
                  <Named id={a} />
                </b>{' '}
                and{' '}
                <b className="font-semibold">
                  <Named id={b} />
                </b>{' '}
                are identical on common attributes.
                <p className="mt-[3px] text-12 text-ink-3">
                  {overlapDetail(p.a, p.b, attributes, valueOf, project)}
                </p>
              </div>
            </li>
          )
        })}
        <li className="border-t border-line pt-2.5 text-12 text-ink-3">
          Dominance is tested on attributes common to both alternatives; alternative-specific
          constants can offset apparent dominance.
        </li>
      </ul>
    </Panel>
  )
}

type ValueOf = (attrId: string, altId: string) => ValueCell | null

function valuesOf(attrs: Attribute[], altId: string, valueOf: ValueOf): string[] {
  return attrs
    .map((a) => valueOf(a.id, altId)?.text)
    .filter((s): s is string => !!s)
}

function dominanceDetail(
  loserId: string,
  winnerIds: string[],
  diag: TaskDiagnostics | undefined,
  attributes: Attribute[],
  valueOf: ValueOf,
  project: Project,
): string {
  const loser = altIdentity(project, loserId).label
  // Attributes compared for each dominating alternative, grouped when they match.
  const groups = new Map<string, { attrs: Attribute[]; names: string[] }>()
  for (const w of winnerIds) {
    const f = diag?.findings.find(
      (x) => x.check === 'dominance' && x.details.dominantAltId === w && x.details.dominatedAltId === loserId,
    )
    const compared = new Set((f?.details.attributesCompared as string[] | undefined) ?? [])
    const attrs = attributes.filter((a) => compared.has(a.id))
    const key = attrs.map((a) => a.id).join('|')
    const g = groups.get(key) ?? { attrs, names: [] }
    g.names.push(altIdentity(project, w).label)
    groups.set(key, g)
  }
  const list = Array.from(groups.values())
  if (list.length === 1) {
    const g = list[0]
    const vals = valuesOf(g.attrs, loserId, valueOf)
    const subject = g.names.length === 1 ? `${g.names[0]} is` : 'each of them is'
    return `On ${joinNames(g.attrs.map((a) => a.name))}, ${subject} at least as good as ${loser}${vals.length ? ` (${vals.join(', ')})` : ''} and better on at least one.`
  }
  const parts = list.map((g) => `${joinNames(g.attrs.map((a) => a.name))} for ${joinNames(g.names)}`)
  return `Each of them is at least as good as ${loser} on the attributes compared (${parts.join('; ')}) and better on at least one.`
}

function overlapDetail(
  aId: string,
  bId: string,
  attributes: Attribute[],
  valueOf: ValueOf,
  project: Project,
): string {
  const common = attributes.filter((attr) => appliesToAlt(attr, aId) && appliesToAlt(attr, bId))
  const rest = attributes.filter((attr) => appliesToAlt(attr, aId) !== appliesToAlt(attr, bId))
  const values = joinNames(common.map((a) => {
    const v = valueOf(a.id, aId)
    return v ? `${a.name} ${v.text}` : a.name
  }))
  const drivers = rest.map((a) => a.name)
  if (project.experimentType === 'labeled') drivers.push('the alternative-specific constants')
  const first = values ? `Both have ${values}.` : 'They share every common level.'
  return drivers.length > 0
    ? `${first} The choice between them rests on ${joinNames(drivers)} alone.`
    : `${first} Respondents see two identical alternatives.`
}
