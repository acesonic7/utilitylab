'use client'

import type { Project } from '@/lib/schema'
import { altIdentity, altStyle, type AltIdentity } from '@/lib/altIdentity'
import { dominatedCounts, formatSigned, type DiagnosticsInsight } from '@/lib/diagnosticsView'
import { useDesignHealth } from '../DesignHealth'
import { useWorkspace, useWorkspaceActions } from '../Workspace'
import { plural } from '@/lib/text'
import { onSectionLinkClick } from '../shell/sections'
import { AltGlyph, Button, Panel, ScrollX, cx } from '../ui'
import { ArrowIcon, InfoIcon } from './bits'

function names(ids: AltIdentity[]): string {
  return ids.map((i) => i.label).join(', ')
}

function MapCell({
  id,
  by,
  identicalWith,
}: {
  id: AltIdentity
  by: AltIdentity[] | null
  identicalWith: AltIdentity[]
}) {
  const dominated = by !== null
  return (
    <td className="p-0.5 align-top">
      <div
        className={cx(
          'relative flex h-[58px] min-w-[56px] flex-col items-center rounded-well pt-5',
          dominated ? 'hatch shadow-[inset_0_0_0_1px_rgb(var(--alt)/0.45)]' : 'bg-alt-tint-8',
        )}
      >
        <AltGlyph identity={id} size={13} hollow={dominated} />
        {identicalWith.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-[3px] top-[3px] inline-flex items-center gap-px rounded-tick bg-caution-bg px-[3px] font-mono text-12 leading-[13px] text-caution"
          >
            =
            {identicalWith.map((o) => (
              <AltGlyph key={o.altId} identity={o} size={7} />
            ))}
          </span>
        )}
        {dominated && (
          <span
            aria-hidden="true"
            className="mt-[5px] inline-flex items-center gap-[3px] whitespace-nowrap rounded-bar bg-surface px-1 py-px text-12 font-medium leading-none text-ink-2"
          >
            by
            {by.map((b) => (
              <AltGlyph key={b.altId} identity={b} size={8} />
            ))}
          </span>
        )}
        <span className="sr-only">
          {dominated ? `Dominated by ${names(by)}` : 'Not dominated'}
          {identicalWith.length > 0 && `. Identical to ${names(identicalWith)} on common attributes`}
        </span>
      </div>
    </td>
  )
}

function Insight({ project, insight }: { project: Project; insight: DiagnosticsInsight }) {
  const { goTo } = useWorkspaceActions()
  const id = altIdentity(project, insight.altId)
  const attrName = (aid: string) => project.attributes.find((a) => a.id === aid)?.name ?? aid
  const p = insight.pair
  const pairText = p
    ? `${attrName(p.a)} × ${attrName(p.b)} correlation (r = ${formatSigned(p.r, 2)}) pairs higher ${attrName(p.a)} with ${p.r < 0 ? 'lower' : 'higher'} ${attrName(p.b)}, which makes their separate effects hard to tell apart.`
    : null
  return (
    <div className="mx-5 mb-5 mt-[18px] grid grid-cols-[22px_minmax(0,1fr)] items-start gap-x-2.5 gap-y-3 rounded-card bg-surface-2 px-3.5 py-3 text-13 text-ink-2 shadow-[inset_0_0_0_1px_rgb(var(--line))] sm:grid-cols-[22px_minmax(0,1fr)_auto]">
      <InfoIcon className="mt-px text-ink" />
      <p>
        {insight.dominatedIn > 0 ? (
          <>
            <b className="font-semibold text-ink">
              <AltGlyph identity={id} className="mr-1.5" />
              {id.label} is dominated in {insight.dominatedIn} of {plural(insight.tasks, 'choice task')}.
            </b>{' '}
            Respondents can rule it out there without weighing a trade-off.
            {pairText && ` Its ${pairText}`}
          </>
        ) : (
          <>
            <b className="font-semibold text-ink">
              <AltGlyph identity={id} className="mr-1.5" />
              {id.label} is never dominated, but its attributes move together.
            </b>{' '}
            {pairText && `Its ${pairText}`}
          </>
        )}
      </p>
      <Button size="sm" className="col-start-2 justify-self-start sm:col-start-3" onClick={() => goTo('design')}>
        Show in design matrix
      </Button>
    </div>
  )
}

export function ChoiceTaskMap({
  project,
  violationsByRow,
  insight,
}: {
  project: Project
  violationsByRow: number[]
  insight: DiagnosticsInsight | null
}) {
  const { byTask, counts } = useDesignHealth()
  const { activeTask, goTo } = useWorkspace()
  const rows = project.design?.rows ?? []
  const S = rows.length
  const alts = project.alternatives.filter((a) => !a.isOptOut).map((a) => altIdentity(project, a.id))

  // Columns grouped by block, keeping design order within a block.
  const order = rows.map((_, i) => i).sort((a, b) => rows[a].block - rows[b].block || a - b)
  const blocks: { block: number; cols: number[] }[] = []
  for (const i of order) {
    const last = blocks[blocks.length - 1]
    if (last && last.block === rows[i].block) last.cols.push(i)
    else blocks.push({ block: rows[i].block, cols: [i] })
  }

  const dominated = dominatedCounts(byTask)
  const worst = Math.max(0, ...alts.map((a) => dominated.get(a.altId) ?? 0))
  const mapCount =
    counts.dominance.warning + counts.dominance.concern + counts.overlap.warning + counts.overlap.concern
  const designLevel =
    counts.correlation.warning + counts.correlation.concern + counts.balance.warning + counts.balance.concern
  // The panel gutter lives on the sticky cells, not the scroller, so nothing shows through beside them.
  const stickyCell = 'sticky left-0 z-[1] bg-surface pl-5'
  // The summary column stays in view while a long design scrolls underneath it; on phones it
  // scrolls with the map so the choice task columns keep the width.
  const stickyEnd = 'z-[1] bg-surface pr-5 sm:sticky sm:right-0'

  return (
    <Panel
      title="Choice task map"
      count={mapCount}
      actions={<span className="hidden text-right sm:inline">Dominance and overlap, drawn where they happen</span>}
      flush
    >
      <ScrollX label="Choice task map, scrolls sideways" className="relative rounded-bar pb-2 pt-1">
        <table className="w-full border-collapse">
          <caption className="sr-only">
            Dominated and identical alternatives in each choice task. Columns are choice tasks, rows are
            alternatives.
          </caption>
          <thead>
            <tr>
              <td className={stickyCell} />
              {blocks.map((b) => (
                <th
                  key={b.block}
                  scope="colgroup"
                  colSpan={b.cols.length}
                  className="h-[22px] px-0.5 text-left align-bottom font-mono text-12 font-normal text-ink-3"
                >
                  <span className="block border-b border-line-2 pb-0.5 pl-1">Block {b.block}</span>
                </th>
              ))}
              <td className={stickyEnd} />
            </tr>
            <tr>
              <th scope="col" className={cx(stickyCell, 'h-[34px] pr-2 text-left text-12 font-medium text-ink-3')}>
                Choice task
              </th>
              {order.map((i) => {
                const row = rows[i]
                const cur = activeTask?.block === row.block && activeTask?.taskId === row.taskId
                return (
                  <th key={i} scope="col" className="px-0.5 text-center font-normal">
                    <a
                      href="#choice-tasks"
                      aria-current={cur ? 'true' : undefined}
                      title={`Open choice task ${row.taskId}${blocks.length > 1 ? `, block ${row.block}` : ''}`}
                      onClick={(e) =>
                        onSectionLinkClick(e, () =>
                          goTo('choice-tasks', { task: { block: row.block, taskId: row.taskId } }),
                        )
                      }
                      className={cx(
                        'focus-ring inline-flex items-center gap-1 rounded-ctl px-2 py-[5px] text-13 font-semibold leading-none',
                        cur ? 'bg-ink text-surface' : 'text-ink hover:bg-surface-3',
                      )}
                    >
                      <span className="sr-only">Choice task </span>
                      <span className={cx('tnum', cur ? 'text-surface' : 'text-ink')}>{row.taskId}</span>
                      {blocks.length > 1 && <span className="sr-only">, block {row.block}</span>}
                      <ArrowIcon className={cur ? 'text-surface' : 'text-ink-3'} />
                    </a>
                  </th>
                )
              })}
              <th scope="col" className={cx(stickyEnd, 'whitespace-nowrap pl-2.5 text-left text-12 font-medium text-ink-3')}>
                Dominated in
              </th>
            </tr>
          </thead>
          <tbody>
            {alts.map((id) => {
              const k = dominated.get(id.altId) ?? 0
              return (
                <tr key={id.altId} style={altStyle(id)}>
                  <th
                    scope="row"
                    className={cx(stickyCell, 'whitespace-nowrap pr-2 text-left text-13 font-medium text-ink')}
                  >
                    <AltGlyph identity={id} className="mr-2" />
                    {id.label}
                  </th>
                  {order.map((i) => {
                    const t = byTask[i]
                    const d = t?.dominated.find((x) => x.altId === id.altId)
                    const identical = (t?.identical ?? [])
                      .filter(([a, b]) => a === id.altId || b === id.altId)
                      .map(([a, b]) => altIdentity(project, a === id.altId ? b : a))
                    return (
                      <MapCell
                        key={i}
                        id={id}
                        by={d ? d.by.map((b) => altIdentity(project, b)) : null}
                        identicalWith={identical}
                      />
                    )
                  })}
                  <td className={cx(stickyEnd, 'whitespace-nowrap pl-2.5 text-13 font-medium text-ink-2')}>
                    <span
                      aria-hidden="true"
                      className="relative mr-2 inline-block h-1.5 w-[34px] overflow-hidden rounded-bar bg-surface-3 align-middle"
                    >
                      <span
                        className="absolute inset-y-0 left-0 rounded-bar bg-alt"
                        style={{ width: `${S > 0 ? (k / S) * 100 : 0}%` }}
                      />
                    </span>
                    <span className={cx('tnum', k > 0 && k === worst && 'font-semibold text-ink')}>
                      {k} of {S}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className={cx(stickyCell, 'h-[30px] pr-2 text-left text-12 font-medium text-ink-3')}>
                Findings
              </th>
              {order.map((i) => {
                const n = (byTask[i]?.findings.length ?? 0) + (violationsByRow[i] ?? 0)
                return (
                  <td
                    key={i}
                    className={cx('tnum text-center text-13', n > 0 ? 'font-semibold text-ink' : 'text-ink-3')}
                  >
                    {n}
                  </td>
                )
              })}
              <td className={cx(stickyEnd, 'whitespace-nowrap pl-2.5 text-13 text-ink-3')}>
                + {designLevel} design-level
              </td>
            </tr>
          </tfoot>
        </table>
      </ScrollX>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 px-5 pb-4 pt-2 text-12 text-ink-3">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-[18px] rounded-bar bg-ink/[0.08]" />
          Not dominated
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="hatch inline-block h-3 w-[18px] rounded-bar shadow-[inset_0_0_0_1px_rgb(var(--line-2))]"
          />
          Dominated, with the dominating alternatives
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-flex h-4 items-center rounded-tick bg-caution-bg px-1 font-mono text-12 leading-none text-caution"
          >
            =
          </span>
          Identical on common attributes
        </li>
        <li className="basis-full">
          Dominance is tested only on attributes both alternatives share that have a preference direction.
        </li>
      </ul>
      {insight && <Insight project={project} insight={insight} />}
    </Panel>
  )
}
