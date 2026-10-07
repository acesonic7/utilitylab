'use client'

import { useMemo, useState } from 'react'
import type { Design, Project } from '@/lib/schema'
import { buildPriorVector, computeDError, paramLayout } from '@/lib/dOptimal'
import { formatDay } from '@/lib/formatDate'
import { DESIGN_HISTORY_LIMIT, type ArchivedDesign } from '@/lib/library'
import { Button, Panel } from '../ui'
import { ChevronDown, ChevronRight, Download, Refresh, Trash } from '../Icons'
import { useLibrary } from '../library/LibraryContext'

const METHOD: Record<string, string> = { 'd-optimal': 'D-efficient', balanced: 'Balanced search', random: 'Random' }

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
  const { history, restoreDesign, forgetDesign, unsavedHistory, historyNote, download, activeId } = useLibrary()
  const [open, setOpen] = useState(false)
  const errors = useMemo(
    () => (open ? history.map((h) => dError(project, h.design)) : []),
    [open, history, project],
  )

  const notice =
    unsavedHistory > 0 ? (
      <div role="alert" className="mt-4 flex flex-col gap-3 rounded-card border border-risk/30 bg-risk-bg px-4 py-3 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-13 text-ink-2">
          <span className="font-semibold text-risk">Browser storage is full.</span>{' '}
          {unsavedHistory === 1 ? '1 earlier design is' : `${unsavedHistory} earlier designs are`} kept only until you
          close this tab. Download the project to keep {unsavedHistory === 1 ? 'it' : 'them'}, then delete studies you no
          longer need to free space.
        </p>
        <Button size="sm" icon={<Download />} className="shrink-0 self-start sm:self-center" onClick={() => download(activeId)}>
          Download project
        </Button>
      </div>
    ) : historyNote ? (
      <p role="status" className="mt-4 rounded-card bg-surface-2 px-4 py-3 text-13 text-ink-2 shadow-hairline">
        {historyNote}
      </p>
    ) : null

  if (!history.length) return notice

  const restore = (h: ArchivedDesign) => {
    const msg = project.design
      ? 'Restore this design? The current design moves to Earlier designs.'
      : 'Restore this design?'
    if (window.confirm(msg)) restoreDesign(h)
  }

  return (
    <>
    {notice}
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
    </>
  )
}
