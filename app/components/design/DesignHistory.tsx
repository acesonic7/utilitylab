'use client'

import { useMemo, useState } from 'react'
import type { Design, Project } from '@/lib/schema'
import { buildPriorVector, computeDError, paramLayout } from '@/lib/dOptimal'
import { formatDay } from '@/lib/formatDate'
import { DESIGN_HISTORY_LIMIT, type ArchivedDesign } from '@/lib/library'
import { Button, Panel } from '../ui'
import { ChevronDown, ChevronRight, Refresh, Trash } from '../Icons'
import { useLibrary } from '../library/LibraryContext'

const METHOD: Record<string, string> = { 'd-optimal': 'D-optimal', balanced: 'Balanced search', random: 'Random' }

function describe(d: Design): string {
  if (d.source === 'generated') {
    const g = d.generationParams
    const parts = ['Generated', g ? METHOD[g.method] ?? g.method : null, g?.seed != null ? `seed ${g.seed}` : null]
    return parts.filter(Boolean).join(' · ')
  }
  return d.filename ? `Uploaded · ${d.filename}` : 'Uploaded CSV'
}

function dError(project: Project, d: Design): string {
  if (!d.rows.length) return '—'
  try {
    const layout = paramLayout(project)
    const v = computeDError(project, d.rows, buildPriorVector(project, layout), layout)
    return Number.isFinite(v) ? v.toFixed(3) : '—'
  } catch {
    return '—'
  }
}

export function DesignHistory({ project }: { project: Project }) {
  const { history, restoreDesign, forgetDesign } = useLibrary()
  const [open, setOpen] = useState(false)
  const errors = useMemo(
    () => (open ? history.map((h) => dError(project, h.design)) : []),
    [open, history, project],
  )

  if (!history.length) return null

  const restore = (h: ArchivedDesign) => {
    const msg = project.design
      ? 'Restore this design? The current design moves to Earlier designs.'
      : 'Restore this design?'
    if (window.confirm(msg)) restoreDesign(h)
  }

  return (
    <Panel className="mt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="design-history"
        onClick={() => setOpen((o) => !o)}
        className="focus-ring flex w-full items-center gap-2 rounded-well px-5 py-3.5 text-left"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-16 font-semibold text-ink">Earlier designs</span>
        <span className="tnum text-14 text-ink-3">{history.length}</span>
        <span className="ml-auto text-12 text-ink-3">
          The last {DESIGN_HISTORY_LIMIT} designs you replaced or cleared
        </span>
      </button>
      {open && (
        <div id="design-history" className="border-t border-line">
          <ul>
            {history.map((h, i) => (
              <li
                key={h.design.uploadedAt}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-14 font-medium text-ink">{describe(h.design)}</p>
                  <p className="tnum mt-0.5 text-12 text-ink-3">
                    {formatDay(h.design.uploadedAt)} · {h.design.numTasks} choice tasks · {h.design.numBlocks}{' '}
                    {h.design.numBlocks === 1 ? 'block' : 'blocks'} · D-error {errors[i]} under the current structure
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" icon={<Refresh />} onClick={() => restore(h)}>
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash />}
                    aria-label={`Remove ${describe(h.design)} from ${formatDay(h.design.uploadedAt)}`}
                    className="text-risk"
                    onClick={() => forgetDesign(h)}
                  >
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-12 text-ink-3">
            A design made before you changed alternatives, attributes or levels may no longer match them.
            Check Diagnostics after restoring.
          </p>
        </div>
      )}
    </Panel>
  )
}
