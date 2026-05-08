'use client'

import type { Project } from '@/lib/schema'
import { exportTxt, exportQsf } from '@/lib/qualtricsExport'
import { buildWiringGuide, hasPivotedAttributes } from '@/lib/wiringGuide'
import { Download } from './Icons'

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ExportButtons({ project }: { project: Project }) {
  const hasDesign = !!project.design && project.design.rows.length > 0
  const showWiringGuide = hasPivotedAttributes(project)

  return (
    <div className="rounded-xl bg-white ring-1 ring-neutral-200/60 shadow-sm p-5">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() =>
            downloadBlob(exportTxt(project), `${project.slug}.txt`, 'text/plain')
          }
          disabled={!hasDesign}
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <Download size={14} />
          Export TXT
          <span className="text-[11px] text-white/60 font-normal">Advanced Format</span>
        </button>
        <button
          onClick={() =>
            downloadBlob(exportQsf(project), `${project.slug}.qsf`, 'application/json')
          }
          disabled={!hasDesign}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-neutral-900 rounded-lg text-sm font-medium ring-1 ring-neutral-200 hover:ring-neutral-300 hover:bg-neutral-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={14} />
          Export QSF
          <span className="text-[11px] text-neutral-500 font-normal">Qualtrics native</span>
        </button>
        {showWiringGuide && (
          <button
            onClick={() =>
              downloadBlob(
                buildWiringGuide(project),
                `${project.slug}-wiring-guide.md`,
                'text/markdown',
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-neutral-900 rounded-lg text-sm font-medium ring-1 ring-indigo-200 hover:ring-indigo-300 hover:bg-indigo-50/40 transition"
            title="Markdown guide explaining how to wire pivoted attributes into Qualtrics or LimeSurvey"
          >
            <Download size={14} />
            Pivot wiring guide
            <span className="text-[11px] text-neutral-500 font-normal">Markdown</span>
          </button>
        )}
      </div>
      <p className="text-xs text-neutral-500 mt-3 leading-relaxed">
        {hasDesign ? (
          <>
            Files generate from your current state. Import via{' '}
            <span className="font-medium text-neutral-700">
              Qualtrics → Library → Survey Templates → New → Import
            </span>
            .
            {showWiringGuide && (
              <>
                {' '}
                <span className="text-neutral-700">
                  This design has pivoted attributes — download the wiring guide for
                  per-platform substitution steps.
                </span>
              </>
            )}
          </>
        ) : (
          'Upload a design CSV to enable export. (Editor-only changes do not produce choice tasks.)'
        )}
      </p>
    </div>
  )
}
