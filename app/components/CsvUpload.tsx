'use client'

import { useId, useMemo, useRef, useState } from 'react'
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
import { altIdentity } from '@/lib/altIdentity'
import { formatDay } from '@/lib/formatDate'
import { useLatestProject, type SetProject } from './ProjectStore'
import { Download, Upload, XMark } from './Icons'
import { AltGlyph, Button, ScrollX, Select, Tag, cx } from './ui'
import { inkButtonClass } from './design/controls'

const ROLE_LABELS: Record<ColumnRole, string> = {
  task: 'Choice task #',
  block: 'Block',
  cell: 'Cell',
  context: 'Context variable',
  ignore: 'Ignore',
}

// lib/csvImport words some messages by internal role names and ids; show them in the editor's vocabulary.
function friendlyMessage(msg: string, project: Project): string {
  return msg
    .replace('is set to Cell but missing alternative or attribute', 'is set to Cell but has no alternative or attribute picked')
    .replace('is set to Context but missing variable', 'is set to Context variable but has no context variable picked')
    .replace(/ on context "/, ' on context variable "')
    .replace(/mapped to ([^\s.]+)\.(\S+) —/, (whole, altId: string, attrId: string) => {
      const alt = project.alternatives.find((a) => a.id === altId)
      const attr = project.attributes.find((a) => a.id === attrId)
      return alt && attr ? `mapped to ${alt.label} · ${attr.name} —` : whole
    })
}

const MESSAGE = 'flex items-start gap-2.5 rounded-well bg-surface-2 px-3 py-2.5 text-13 text-ink shadow-hairline'

const TH = 'h-8 whitespace-nowrap px-3 text-left font-mono text-12 font-normal uppercase tracking-caps text-ink-3'

export default function CsvUpload({
  project,
  setProject,
  onApplied,
}: {
  project: Project
  setProject: SetProject
  /** Called after a mapping has been applied to the project. */
  onApplied?: () => void
}) {
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [filename, setFilename] = useState('')
  const [mappings, setMappings] = useState<DraftMapping[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const getProject = useLatestProject()

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
        setMappings(autoDetectMapping(p, getProject()))
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
    const result = buildDesign({ filename, parsed, mappings }, getProject())
    setProject((p) => ({ ...p, design: result.design, updatedAt: new Date().toISOString() }))
    setParsed(null)
    setMappings([])
    setFilename('')
    onApplied?.()
  }

  const cancel = () => {
    setParsed(null)
    setMappings([])
    setFilename('')
    setParseError(null)
  }

  const downloadTemplate = () => {
    const project = getProject()
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

  // ── no upload in progress: drop zone ──
  if (!parsed) {
    const current = project.design
    return (
      <div>
        {current && (
          <p className="mb-3 text-13 text-ink-3">
            Current design:{' '}
            <span className="break-all font-mono text-12 text-ink-2">
              {current.filename ?? (current.source === 'generated' ? 'generated design' : 'Design loaded')}
            </span>{' '}
            · {current.numTasks} choice task{current.numTasks !== 1 ? 's' : ''} · {current.numBlocks} block
            {current.numBlocks !== 1 ? 's' : ''} · {current.source === 'generated' ? 'generated' : 'uploaded'}{' '}
            {formatDay(current.uploadedAt) ?? 'at an unknown date'}. It stays in place until you apply a new mapping.
          </p>
        )}
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          aria-describedby={parseError ? errorId : undefined}
          className={cx(
            'focus-ring bg-dot-grid flex w-full flex-col items-center rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors',
            dragOver ? 'border-ink bg-surface-2' : 'border-line-2 hover:border-ink-4 hover:bg-surface-2',
          )}
        >
          <span
            aria-hidden="true"
            className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-3 text-ink-2"
          >
            <Upload size={18} />
          </span>
          <span className="text-14 font-medium text-ink">Drop a CSV here, or click to select</span>
          <span className="mt-1 text-12 text-ink-3">
            Auto-detects columns like <code className="font-mono">task</code>,{' '}
            <code className="font-mono">block</code>, <code className="font-mono">car_travel_time</code>.
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            // Let the same file be picked again after a cancel.
            e.target.value = ''
          }}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-12 text-ink-3">
          <span>{current ? 'Upload a CSV to replace the current design.' : 'No design CSV uploaded yet.'}</span>
          <Button variant="ghost" size="sm" icon={<Download />} onClick={downloadTemplate}>
            Download template from current structure
          </Button>
        </div>
        {parseError && (
          <p id={errorId} role="alert" className={cx('mt-3', MESSAGE)}>
            <Tag tone="risk">Error</Tag>
            <span className="min-w-0 break-words pt-0.5">{parseError}</span>
          </p>
        )}
      </div>
    )
  }

  // ── mapping UI ──
  const cellMappingsCount = mappings.filter((m) => m.role === 'cell').length
  const autoDetectedCount = mappings.filter((m) => m.role !== 'ignore' && m.alternativeId !== undefined).length
  const hasErrors = !!validation && validation.errors.length > 0
  const alternatives = project.alternatives.filter((a) => !a.isOptOut)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="break-all font-mono text-13 text-ink">{filename}</p>
          <p className="tnum mt-0.5 text-12 text-ink-3">
            {parsed.rows.length} rows · {parsed.headers.length} columns ·{' '}
            <span className="text-ink-2">{cellMappingsCount}</span> cell mapping
            {cellMappingsCount !== 1 ? 's' : ''} ({autoDetectedCount} auto-detected)
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={<XMark />} onClick={cancel}>
          Cancel
        </Button>
      </div>

      <ScrollX label="Column mapping table, scrolls sideways" className="relative rounded-card shadow-hairline">
        <table className="w-full border-collapse text-13">
          <caption className="sr-only">Column mapping for {filename}</caption>
          <thead className="bg-surface-2">
            <tr className="border-b border-line">
              <th scope="col" className={TH}>Column</th>
              <th scope="col" className={TH}>Sample</th>
              <th scope="col" className={TH}>Role</th>
              <th scope="col" className={TH}>Alternative</th>
              <th scope="col" className={TH}>Attribute or context variable</th>
              <th scope="col" className={TH}>Match</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m, i) => {
              const alt = m.role === 'cell' && m.alternativeId ? altIdentity(project, m.alternativeId) : null
              return (
                <tr key={m.csvColumn} className="border-b border-line last:border-b-0 hover:bg-surface-2">
                  <th scope="row" className="whitespace-nowrap px-3 py-1.5 text-left font-mono text-12 font-normal text-ink">
                    {m.csvColumn}
                  </th>
                  <td className="max-w-[180px] truncate px-3 py-1.5 text-12 text-ink-3" title={m.sampleValues.join(', ')}>
                    {m.sampleValues.slice(0, 4).join(', ')}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="w-40">
                      <Select
                        size="sm"
                        aria-label={`Role of column ${m.csvColumn}`}
                        value={m.role}
                        onChange={(e) => {
                          const newRole = e.target.value as ColumnRole
                          updateMapping(i, {
                            role: newRole,
                            alternativeId: newRole === 'cell' ? m.alternativeId : undefined,
                            attributeId: newRole === 'cell' ? m.attributeId : undefined,
                            contextVariableId: newRole === 'context' ? m.contextVariableId : undefined,
                          })
                        }}
                      >
                        {(Object.keys(ROLE_LABELS) as ColumnRole[]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    {m.role === 'cell' && (
                      <div className="flex w-48 items-center gap-2">
                        {alt ? (
                          <AltGlyph identity={alt} size={10} />
                        ) : (
                          <span aria-hidden="true" className="w-2.5 shrink-0" />
                        )}
                        <Select
                          size="sm"
                          aria-label={`Alternative for column ${m.csvColumn}`}
                          aria-invalid={!m.alternativeId || undefined}
                          value={m.alternativeId ?? ''}
                          onChange={(e) => updateMapping(i, { alternativeId: e.target.value || undefined })}
                        >
                          <option value="">— pick —</option>
                          {alternatives.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {m.role === 'cell' && (
                      <div className="w-48">
                        <Select
                          size="sm"
                          aria-label={`Attribute for column ${m.csvColumn}`}
                          aria-invalid={!m.attributeId || undefined}
                          value={m.attributeId ?? ''}
                          onChange={(e) => updateMapping(i, { attributeId: e.target.value || undefined })}
                        >
                          <option value="">— pick —</option>
                          {project.attributes.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                    {m.role === 'context' && (
                      <div className="w-48">
                        <Select
                          size="sm"
                          aria-label={`Context variable for column ${m.csvColumn}`}
                          aria-invalid={!m.contextVariableId || undefined}
                          value={m.contextVariableId ?? ''}
                          onChange={(e) => updateMapping(i, { contextVariableId: e.target.value || undefined })}
                        >
                          <option value="">— pick —</option>
                          {(project.contextVariables ?? []).map((cv) => (
                            <option key={cv.id} value={cv.id}>
                              {cv.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {(m.role === 'cell' || m.role === 'context') && (
                      <div className="w-36">
                        <Select
                          size="sm"
                          aria-label={`Match mode for column ${m.csvColumn}`}
                          value={m.matchMode ?? 'value'}
                          onChange={(e) => updateMapping(i, { matchMode: e.target.value as MatchMode })}
                          title={
                            m.matchMode === 'index'
                              ? 'CSV value is the level number (1, 2, 3…)'
                              : 'CSV value matches a level value directly'
                          }
                        >
                          <option value="value">Level value</option>
                          <option value="index">Level number</option>
                        </Select>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ScrollX>

      <div aria-live="polite">
        {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
          <ul className="mt-4 space-y-2">
            {validation.errors.map((e, i) => (
              <li key={`e${i}`} className={MESSAGE}>
                <Tag tone="risk">Error</Tag>
                <span className="min-w-0 break-words pt-0.5">{friendlyMessage(e, project)}</span>
              </li>
            ))}
            {validation.warnings.map((w, i) => (
              <li key={`w${i}`} className={MESSAGE}>
                <Tag tone="caution">Warning</Tag>
                <span className="min-w-0 break-words pt-0.5">{friendlyMessage(w, project)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-line pt-4">
        {hasErrors && (
          <p className="mr-auto text-12 text-ink-3">Fix the errors above to apply the mapping.</p>
        )}
        <Button variant="ghost" onClick={cancel}>
          Cancel
        </Button>
        <button type="button" onClick={apply} disabled={hasErrors} className={inkButtonClass('md')}>
          Apply mapping
        </button>
      </div>
    </div>
  )
}
