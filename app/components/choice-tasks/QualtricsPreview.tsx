'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Alternative, Attribute, Project } from '@/lib/schema'
import { renderTaskAsHtml } from '@/lib/qualtricsExport'
import { getLevel, cellKey } from '@/lib/validation'
import type { TaskEntry } from './model'

// System colours only: the frame shows the neutral export, never the app theme or identity marks.
// The export table scrolls sideways inside .task, so a narrow frame never clips a column.
const BASE_STYLE = `
:root{color-scheme:light}
html,body{height:auto}
body{margin:0;padding:20px 24px;background:Canvas;color:CanvasText;font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
@media (max-width:420px){body{padding:14px 14px}}
.task{overflow-x:auto;margin:0 0 18px;padding-bottom:2px;background:
linear-gradient(to right,Canvas,Canvas) left/14px 100% no-repeat local,
linear-gradient(to left,Canvas,Canvas) right/14px 100% no-repeat local,
linear-gradient(to right,color-mix(in srgb,CanvasText 22%,transparent),transparent) left center/10px calc(100% - 6px) no-repeat scroll,
linear-gradient(to left,color-mix(in srgb,CanvasText 22%,transparent),transparent) right center/10px calc(100% - 6px) no-repeat scroll;
background-color:Canvas}
table{border-collapse:collapse;margin:0}
th,td{text-align:center;vertical-align:middle}
tbody th{text-align:left;font-weight:600}
img{max-width:none}
.choices{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.choices label{display:flex;align-items:center;gap:8px;cursor:pointer}
`

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// First-paint guess only; the frame is measured once its document has laid out.
function estimateHeight(project: Project, entry: TaskEntry, alts: Alternative[], attrs: Attribute[]): number {
  const { row } = entry
  const hasContext = (project.contextVariables ?? []).some((cv) => row.context?.[cv.id])
  const headerImg = alts.some((a) => a.imageUrl) ? 52 : 0
  let body = 0
  for (const attr of attrs) {
    const img = alts.some((alt) => getLevel(attr, row.cells[cellKey(alt.id, attr.id)])?.imageUrl)
    body += img ? 80 : 36
  }
  return 40 + (hasContext ? 30 : 0) + 36 + headerImg + body + 18 + alts.length * 27 + 16
}

export function QualtricsPreview({
  project,
  entry,
  alternatives,
  attributes,
}: {
  project: Project
  entry: TaskEntry
  alternatives: Alternative[]
  attributes: Attribute[]
}) {
  const { row } = entry
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [measured, setMeasured] = useState<number | null>(null)

  const srcDoc = useMemo(() => {
    const choices = alternatives
      .map((a) => `<li><label><input type="radio" name="q"> ${escapeHtml(a.label)}</label></li>`)
      .join('')
    // Only the table scrolls sideways; the context preamble above it wraps.
    const html = renderTaskAsHtml(project, row)
    const at = Math.max(0, html.indexOf('<table'))
    const task = `${html.slice(0, at)}<div class="task">${html.slice(at)}</div>`
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE_STYLE}</style></head><body>${task}<ul class="choices">${choices}</ul></body></html>`
  }, [project, row, alternatives])

  // allow-same-origin (without allow-scripts) lets this component read the frame's layout;
  // nothing inside the frame can run.
  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument
    // A partly parsed document would under-measure; onLoad measures once parsing is done.
    if (!doc?.documentElement || doc.readyState !== 'complete' || !doc.querySelector('.task')) return
    const h = Math.ceil(doc.documentElement.getBoundingClientRect().height)
    if (h > 0) setMeasured((prev) => (prev === h ? prev : h))
  }, [])

  const onLoad = useCallback(() => {
    measure()
    const doc = frameRef.current?.contentDocument
    // Images arrive after load; each one can change the height.
    doc?.querySelectorAll('img').forEach((img) => {
      if (!img.complete) {
        img.addEventListener('load', measure, { once: true })
        img.addEventListener('error', measure, { once: true })
      }
    })
  }, [measure])

  // In case the frame finished loading before the handler was attached.
  useEffect(() => {
    measure()
  }, [srcDoc, measure])

  // Width changes reflow the table and the answer list.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame || typeof ResizeObserver === 'undefined') return
    let lastWidth = frame.clientWidth
    const ro = new ResizeObserver(() => {
      if (frame.clientWidth === lastWidth) return
      lastWidth = frame.clientWidth
      measure()
    })
    ro.observe(frame)
    return () => ro.disconnect()
  }, [measure])

  const height = measured ?? Math.max(220, estimateHeight(project, entry, alternatives, attributes))

  return (
    <figure className="rounded-hero bg-surface-2 p-3 shadow-hairline sm:p-5">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-13 text-ink-3">
        <span>As exported to Qualtrics (neutral, no identity marks)</span>
        <span className="font-mono text-12">
          Q_{row.block}_{row.taskId}
        </span>
      </figcaption>
      <iframe
        ref={frameRef}
        sandbox="allow-same-origin"
        srcDoc={srcDoc}
        onLoad={onLoad}
        title={`Qualtrics export of choice task ${row.taskId}, block ${row.block}`}
        className="block w-full rounded-card border border-line bg-surface"
        style={{ height: height + 2 }}
      />
    </figure>
  )
}
