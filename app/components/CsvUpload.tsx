'use client'

import { useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import type { Project } from '@/lib/schema'
import {
  autoDetectMapping,
  buildDesign,
  generateTemplateCsv,
  validateMappings,
  type ColumnRole,
  type DraftMapping,
  type MatchMode,
  type ParsedCsv,
} from '@/lib/csvImport'
import { Download, FileText, Trash, Upload, XMark } from './Icons'

const ROLE_LABELS: Record<ColumnRole, string> = {
  task: 'Task #',
  block: 'Block',
  cell: 'Cell',
  ignore: 'Ignore',
}

export default function CsvUpload({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [filename, setFilename] = useState('')
  const [mappings, setMappings] = useState<DraftMapping[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const validation = useMemo(() => {
    if (!parsed) return null
    return validateMappings(parsed, mappings, project)
  }, [parsed, mappings, project])

  const handleFile = (file: File) => {
    setParseError(null)
    setFilename(file.name)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.errors.length > 0) {
          setParseError(res.errors[0].message)
          return
        }
        const headers = res.meta.fields ?? []
        if (headers.length === 0) {
          setParseError('CSV has no header row.')
          return
        }
        const rows = res.data.map((r) => headers.map((h) => String(r[h] ?? '')))
        const p: ParsedCsv = { headers, rows }
        setParsed(p)
        setMappings(autoDetectMapping(p, project))
      },
      error: (err) => setParseError(err.message),
    })
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const updateMapping = (i: number, changes: Partial<DraftMapping>) => {
    setMappings((cur) => cur.map((m, idx) => (idx === i ? { ...m, ...changes } : m)))
  }

  const apply = () => {
    if (!parsed) return
    const result = buildDesign({ filename, parsed, mappings }, project)
    setProject({ ...project, design: result.design, updatedAt: new Date().toISOString() })
    setParsed(null)
    setMappings([])
    setFilename('')
  }

  const cancel = () => {
    setParsed(null)
    setMappings([])
    setFilename('')
    setParseError(null)
  }

  const downloadTemplate = () => {
    const csv = generateTemplateCsv(project)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.slug}-template.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── empty state: no upload in progress ──
  if (!parsed) {
    return (
      <div className="rounded-xl bg-white ring-1 ring-neutral-200/60 shadow-sm p-5">
        {project.design ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">
                  {project.design.filename ?? 'Design loaded'}
                </div>
                <div className="text-neutral-500 text-xs mt-0.5">
                  {project.design.numTasks} tasks · {project.design.numBlocks} block
                  {project.design.numBlocks !== 1 ? 's' : ''} · uploaded{' '}
                  {new Date(project.design.uploadedAt).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md ring-1 ring-neutral-200 hover:ring-neutral-300 hover:bg-neutral-50 transition"
              >
                <Upload size={13} />
                Replace
              </button>
              <button
                onClick={() => setProject({ ...project, design: null })}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md ring-1 ring-neutral-200 text-neutral-600 hover:bg-red-50 hover:text-red-700 hover:ring-red-300 transition"
              >
                <Trash size={13} />
                Clear
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </div>
        ) : (
          <>
            <div
              onDrop={onDrop}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              className={`rounded-lg p-10 text-center cursor-pointer transition bg-dot-grid border-2 border-dashed ${
                dragOver
                  ? 'border-neutral-900 bg-neutral-50'
                  : 'border-neutral-300 hover:border-neutral-500 hover:bg-neutral-50'
              }`}
              onClick={() => fileInput.current?.click()}
            >
              <div className="w-12 h-12 rounded-full bg-neutral-100 mx-auto flex items-center justify-center text-neutral-600 mb-3">
                <Upload size={20} />
              </div>
              <div className="text-sm font-medium text-neutral-900">
                Drop a CSV here, or click to select
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                Auto-detects columns like <code className="font-mono">task</code>,{' '}
                <code className="font-mono">block</code>,{' '}
                <code className="font-mono">car_travel_time</code>.
              </div>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
            </div>
            <div className="mt-3 text-xs text-neutral-500 flex items-center justify-between">
              <span>No design CSV uploaded yet.</span>
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1 underline hover:text-neutral-900 transition"
              >
                <Download size={12} />
                Download template from current structure
              </button>
            </div>
            {parseError && (
              <div className="mt-3 bg-red-50 ring-1 ring-red-200 text-red-900 rounded-md p-3 text-sm">
                {parseError}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ── mapping UI ──
  const cellMappingsCount = mappings.filter((m) => m.role === 'cell').length
  const autoDetectedCount = mappings.filter(
    (m) => m.role !== 'ignore' && m.alternativeId !== undefined,
  ).length

  return (
    <div className="rounded-xl bg-white ring-1 ring-neutral-200/60 shadow-sm p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="font-medium text-sm">{filename}</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {parsed.rows.length} rows · {parsed.headers.length} columns ·{' '}
            <span className="text-neutral-700">{cellMappingsCount}</span> cell mapping
            {cellMappingsCount !== 1 ? 's' : ''} ({autoDetectedCount} auto-detected)
          </div>
        </div>
        <button
          onClick={cancel}
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 transition"
        >
          <XMark size={12} />
          Cancel
        </button>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
              <th className="py-2 pr-3 font-medium">Column</th>
              <th className="py-2 pr-3 font-medium">Sample</th>
              <th className="py-2 pr-3 font-medium">Role</th>
              <th className="py-2 pr-3 font-medium">Alternative</th>
              <th className="py-2 pr-3 font-medium">Attribute</th>
              <th className="py-2 font-medium">Match</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m, i) => (
              <tr
                key={m.csvColumn}
                className="border-b border-neutral-100 hover:bg-neutral-50/60 transition"
              >
                <td className="py-2 pr-3 font-mono text-[11px]">{m.csvColumn}</td>
                <td className="py-2 pr-3 text-neutral-500 max-w-[180px] truncate">
                  {m.sampleValues.slice(0, 4).join(', ')}
                </td>
                <td className="py-2 pr-3">
                  <select
                    value={m.role}
                    onChange={(e) =>
                      updateMapping(i, {
                        role: e.target.value as ColumnRole,
                        alternativeId:
                          e.target.value === 'cell' ? m.alternativeId : undefined,
                        attributeId:
                          e.target.value === 'cell' ? m.attributeId : undefined,
                      })
                    }
                    className={miniSelect}
                  >
                    {(Object.keys(ROLE_LABELS) as ColumnRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  {m.role === 'cell' && (
                    <select
                      value={m.alternativeId ?? ''}
                      onChange={(e) =>
                        updateMapping(i, { alternativeId: e.target.value || undefined })
                      }
                      className={miniSelect}
                    >
                      <option value="">— pick —</option>
                      {project.alternatives
                        .filter((a) => !a.isOptOut)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                    </select>
                  )}
                </td>
                <td className="py-2 pr-3">
                  {m.role === 'cell' && (
                    <select
                      value={m.attributeId ?? ''}
                      onChange={(e) =>
                        updateMapping(i, { attributeId: e.target.value || undefined })
                      }
                      className={miniSelect}
                    >
                      <option value="">— pick —</option>
                      {project.attributes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="py-2">
                  {m.role === 'cell' && (
                    <select
                      value={m.matchMode ?? 'value'}
                      onChange={(e) =>
                        updateMapping(i, { matchMode: e.target.value as MatchMode })
                      }
                      className={miniSelect}
                      title={
                        m.matchMode === 'index'
                          ? 'Cell value is the level number (1, 2, 3…)'
                          : 'Cell value matches a level value directly'
                      }
                    >
                      <option value="value">value</option>
                      <option value="index">level #</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="mt-4 space-y-2 text-sm">
          {validation.errors.map((e, i) => (
            <div
              key={`e${i}`}
              className="bg-red-50 ring-1 ring-red-200 text-red-900 rounded-md p-2.5 border-l-4 border-red-400"
            >
              {e}
            </div>
          ))}
          {validation.warnings.map((w, i) => (
            <div
              key={`w${i}`}
              className="bg-amber-50 ring-1 ring-amber-200 text-amber-900 rounded-md p-2.5 border-l-4 border-amber-400"
            >
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2 pt-4 border-t border-neutral-100">
        <button
          onClick={cancel}
          className="px-4 py-2 text-sm text-neutral-700 hover:text-neutral-900 transition"
        >
          Cancel
        </button>
        <button
          onClick={apply}
          disabled={!!validation && validation.errors.length > 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white rounded-md text-sm font-medium hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          Apply mapping
        </button>
      </div>
    </div>
  )
}

const miniSelect =
  'bg-white rounded-md px-2 py-1 text-xs ring-1 ring-neutral-200 hover:ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition'
