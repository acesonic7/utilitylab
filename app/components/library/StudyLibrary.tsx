'use client'

import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { StudyMeta } from '@/lib/library'
import { Button, Tag, cx } from '../ui'
import { Copy, Download, Plus, Trash, Upload, XMark } from '../Icons'
import { useLibrary } from './LibraryContext'

function edited(iso: string): string {
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  if (ms < 60_000) return 'edited just now'
  if (ms < 3_600_000) return `edited ${Math.floor(ms / 60_000)} min ago`
  if (ms < 86_400_000) return `edited ${Math.floor(ms / 3_600_000)} h ago`
  return `edited ${new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

export function StudyLibrary({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lib = useLibrary()
  const ref = useRef<HTMLDialogElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setMessage(null)
      d.showModal()
    } else if (!open && d.open) d.close()
  }, [open])

  const importFile = async (file: File | undefined) => {
    if (!file) return
    const err = await lib.importFile(file)
    setMessage(err)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void importFile(e.dataTransfer.files[0])
  }

  const remove = (s: StudyMeta) => {
    const ok = window.confirm(
      `Delete “${s.name || 'Untitled study'}”? It is removed from this browser for good. Download it first if you want to keep a copy.`,
    )
    if (ok) lib.remove(s.id)
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="library-title"
      onClose={onClose}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
      className={cx(
        'w-[min(720px,calc(100vw-32px))] rounded-hero border bg-surface p-0 text-ink shadow-raised backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]',
        dragging ? 'border-ink' : 'border-line',
      )}
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-7">
        <div>
          <h2 id="library-title" className="font-display text-26 font-semibold tracking-title">
            Studies
          </h2>
          <p className="mt-1.5 max-w-[52ch] text-13 text-ink-3">
            Studies are saved in this browser. Download a study as a project file to keep a copy, share
            it or move it to another computer.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close studies"
          className="focus-ring -mr-2 -mt-1 rounded-ctl p-2 text-ink-3 hover:bg-surface-3 hover:text-ink"
        >
          <XMark size={16} />
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 px-6 sm:px-8">
        <Button icon={<Plus />} onClick={lib.newBlank}>
          New blank study
        </Button>
        <Button icon={<Plus />} onClick={lib.newFromExample}>
          New from example
        </Button>
        <Button icon={<Upload />} onClick={() => fileRef.current?.click()}>
          Open project file…
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            void importFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      <p role="status" className={cx('px-6 text-13 sm:px-8', message ? 'mt-3 text-risk' : 'sr-only')}>
        {message ?? ''}
      </p>
      {lib.saveError && (
        <p role="alert" className="mx-6 mt-3 rounded-card bg-risk-bg px-3 py-2 text-13 text-risk sm:mx-8">
          {lib.saveError}
        </p>
      )}

      <ul className="mt-5 max-h-[min(52vh,480px)] overflow-y-auto overflow-x-hidden border-t border-line" aria-label="Saved studies">
        {lib.studies.filter((s) => !lib.unreadable.includes(s.id)).map((s) => {
          const active = s.id === lib.activeId
          return (
            <li
              key={s.id}
              className={cx(
                'flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-6 py-3.5 sm:px-8',
                active && 'bg-surface-2',
              )}
            >
              <div className="min-w-0 flex-[1_1_16rem]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-14 font-semibold text-ink">{s.name || 'Untitled study'}</span>
                  {active && <Tag tone="ink">Open</Tag>}
                  {s.fromExample && <Tag tone="muted">Example</Tag>}
                </div>
                <p className="mt-0.5 text-12 text-ink-3">
                  {plural(s.alternatives, 'alternative')} · {plural(s.attributes, 'attribute')} ·{' '}
                  {s.choiceTasks ? plural(s.choiceTasks, 'choice task') : 'no design yet'} · {edited(s.updatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {!active && (
                  <Button size="sm" onClick={() => lib.open(s.id)}>
                    Open
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon={<Copy />} onClick={() => lib.duplicate(s.id)} aria-label={`Duplicate ${s.name}`}>
                  <span aria-hidden="true">Duplicate</span>
                </Button>
                <Button size="sm" variant="ghost" icon={<Download />} onClick={() => lib.download(s.id)} aria-label={`Download ${s.name}`}>
                  <span aria-hidden="true">Download</span>
                </Button>
                <Button size="sm" variant="ghost" icon={<Trash />} onClick={() => remove(s)} aria-label={`Delete ${s.name}`} className="text-risk">
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            </li>
          )
        })}
        {lib.unreadable.map((id) => (
          <li key={id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-6 py-3.5 sm:px-8">
            <div className="min-w-0 flex-[1_1_16rem]">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-13 text-ink">{id}</span>
                <Tag tone="risk">Can’t be read</Tag>
              </div>
              <p className="mt-0.5 text-12 text-ink-3">
                The saved data is damaged. It has been left untouched; download it to try recovering it.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" icon={<Download />} onClick={() => lib.downloadRaw(id)}>
                Download raw
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash />}
                aria-label={`Delete unreadable study ${id}`}
                className="text-risk"
                onClick={() => window.confirm('Delete this unreadable study from this browser?') && lib.remove(id)}
              >
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <p className="px-6 py-4 text-12 text-ink-3 sm:px-8">
        Drop a <span className="font-mono">.utilitylab.json</span> file here to open it as a new study.
      </p>
    </dialog>
  )
}
