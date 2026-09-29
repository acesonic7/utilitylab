'use client'

import { useId } from 'react'
import type { Project, ValidationConfig } from '@/lib/schema'
import type { CorrelationPair } from '@/lib/diagnostics'
import { altIdentity, altStyle } from '@/lib/altIdentity'
import { formatSigned, type AltCorrelation } from '@/lib/diagnosticsView'
import { useDesignHealth } from '../DesignHealth'
import { plural } from '@/lib/text'
import { AltGlyph, Panel, ScrollX, Tag, cx } from '../ui'

// Fixed |r| buckets for the tint; class names written out so Tailwind keeps them.
function tintFor(r: number | null): string {
  if (r === null) return 'bg-surface-2'
  const a = Math.abs(r)
  if (a >= 0.75) return 'bg-alt-tint-50'
  if (a >= 0.5) return 'bg-alt-tint-34'
  if (a >= 0.3) return 'bg-alt-tint-22'
  if (a >= 0.15) return 'bg-alt-tint-14'
  if (a >= 0.05) return 'bg-alt-tint-8'
  return 'bg-surface-2'
}

const SCALE = ['bg-surface-2', 'bg-alt-tint-8', 'bg-alt-tint-14', 'bg-alt-tint-22', 'bg-alt-tint-34', 'bg-alt-tint-50']

function HeatCell({ pair, headers }: { pair: CorrelationPair | undefined; headers: string }) {
  const r = pair?.r ?? null
  const sev = pair?.severity ?? 'ok'
  return (
    <td
      headers={headers}
      className={cx(
        'h-[34px] rounded-[5px] text-center font-mono text-12 text-ink',
        tintFor(r),
        sev === 'warning' &&
          'shadow-[inset_0_0_0_1.5px_rgb(var(--caution))] outline-dashed outline-1 outline-offset-1 outline-caution',
        sev === 'concern' && 'shadow-[inset_0_0_0_2px_rgb(var(--risk))]',
      )}
    >
      {r === null ? (
        <span className="text-ink-3" title="No variation: one of these attributes never changes for this alternative">
          n/a
        </span>
      ) : (
        formatSigned(r, 2)
      )}
      {sev !== 'ok' && <span className="sr-only"> ({sev})</span>}
    </td>
  )
}

function AltHeatmap({ project, data, beside }: { project: Project; data: AltCorrelation; beside: boolean }) {
  const base = useId()
  const id = altIdentity(project, data.altId)
  const attrs = data.attrIds.map((aid) => ({
    id: aid,
    name: project.attributes.find((a) => a.id === aid)?.name ?? aid,
  }))
  const n = attrs.length
  const concerns = data.pairs.filter((p) => p.severity === 'concern').length
  const warnings = data.pairs.filter((p) => p.severity === 'warning').length
  const pairOf = (i: number, j: number) => data.pairs.find((p) => p.a === attrs[j].id && p.b === attrs[i].id)
  const cols = attrs.slice(0, n - 1)
  // Narrower row labels in the 400px column beside the map, so two small triangles fit side by side.
  const labelW = beside ? 68 : 88

  return (
    <div style={altStyle(id)} className={cx('min-w-0', n >= 4 && 'sm:col-span-2')}>
      <h4 className="mb-2 flex flex-wrap items-center gap-x-[7px] gap-y-1 text-13 font-semibold text-ink">
        <AltGlyph identity={id} />
        <span className="min-w-0 truncate">{id.label}</span>
        {(concerns > 0 || warnings > 0) && (
          <span className="ml-auto flex gap-1.5">
            {concerns > 0 && <Tag tone="risk">{plural(concerns, 'concern')}</Tag>}
            {warnings > 0 && <Tag tone="caution">{plural(warnings, 'warning')}</Tag>}
          </span>
        )}
      </h4>
      {n < 2 ? (
        <p className="text-12 text-ink-3">
          {n === 0 ? 'No attributes apply' : 'Only one attribute applies'} to this alternative, so there is nothing
          to correlate.
        </p>
      ) : (
        <ScrollX label={`${id.label} correlation table, scrolls sideways`} className="relative rounded-bar">
          <table
            className="w-full table-fixed border-separate border-spacing-[3px]"
            style={{ minWidth: labelW + (cols.length + 2) * 3 + cols.length * 44, maxWidth: 104 + cols.length * 96 }}
          >
            <caption className="sr-only">
              Correlation between the attributes of {id.label}, lower triangle
            </caption>
            <colgroup>
              <col className={beside ? 'w-[88px] min-[1360px]:w-[68px]' : 'w-[88px]'} />
              {cols.map((c) => (
                <col key={c.id} />
              ))}
            </colgroup>
            <tbody>
              {attrs.slice(1).map((rowAttr, ri) => {
                const i = ri + 1
                return (
                  <tr key={rowAttr.id}>
                    <th
                      scope="row"
                      id={`${base}r${i}`}
                      title={rowAttr.name}
                      className="hyphens-auto break-words pr-1.5 text-right text-12 font-normal leading-[14px] text-ink-2"
                    >
                      {rowAttr.name}
                    </th>
                    {cols.map((c, j) =>
                      j < i ? (
                        <HeatCell key={c.id} pair={pairOf(i, j)} headers={`${base}r${i} ${base}c${j}`} />
                      ) : (
                        <td key={c.id} />
                      ),
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td />
                {cols.map((c, j) => (
                  <th
                    key={c.id}
                    id={`${base}c${j}`}
                    title={c.name}
                    className="hyphens-auto break-words px-0.5 pt-0.5 align-top text-center text-12 font-normal leading-[14px] text-ink-3"
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </tfoot>
          </table>
        </ScrollX>
      )}
    </div>
  )
}

export function CorrelationMultiples({
  project,
  cfg,
  correlations,
  beside,
}: {
  project: Project
  cfg: ValidationConfig
  correlations: AltCorrelation[]
  /** Sits in the 400px column beside the choice task map from 1360px up: two heatmaps per row there. */
  beside: boolean
}) {
  const { counts } = useDesignHealth()
  const total = counts.correlation.warning + counts.correlation.concern
  const anyUndefined = correlations.some((c) => c.pairs.some((p) => p.r === null))
  const { warnThreshold, concernThreshold } = cfg.correlation

  return (
    <Panel
      title="Attribute correlation"
      count={total}
      actions={
        <span className="hidden sm:inline">
          {cfg.correlation.enabled ? 'Within each alternative' : 'Check off'}
        </span>
      }
    >
      {correlations.length === 0 ? (
        <p className="text-13 text-ink-3">No alternatives to correlate: every alternative is an opt-out.</p>
      ) : (
        <div
          className={cx(
            'grid grid-flow-row-dense grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-6 gap-y-[18px]',
            beside && 'min-[1360px]:grid-cols-2 min-[1360px]:gap-x-5',
          )}
        >
          {correlations.map((c) => (
            <AltHeatmap key={c.altId} project={project} data={c} beside={beside} />
          ))}
        </div>
      )}
      <ul className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-line pt-3 text-12 text-ink-3">
        <li className="inline-flex items-center gap-1.5">
          |r| 0
          <span aria-hidden="true" className="inline-flex overflow-hidden rounded-bar">
            {SCALE.map((c) => (
              <span key={c} className={cx('h-2 w-4', c)} />
            ))}
          </span>
          1
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block size-3 rounded-bar shadow-[inset_0_0_0_1.5px_rgb(var(--caution))] outline-dashed outline-1 outline-offset-1 outline-caution"
          />
          &gt; {warnThreshold} warning
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-3 rounded-bar shadow-[inset_0_0_0_2px_rgb(var(--risk))]" />
          &gt; {concernThreshold} concern
        </li>
        {anyUndefined && (
          <li className="inline-flex items-center gap-1.5">
            <span className="font-mono text-ink-3">n/a</span> no variation
          </li>
        )}
      </ul>
    </Panel>
  )
}
