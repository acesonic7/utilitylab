'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { Project, ContextVariable, Level, AttributeType } from '@/lib/schema'
import { createContextVariable, createContextLevel } from '@/lib/defaults'
import { Button, Field, IconButton, Input, Select, cx } from '../ui'
import { ChevronRight, Plus, XMark } from '../Icons'

const TYPES: { value: AttributeType; label: string }[] = [
  { value: 'categorical', label: 'Categorical' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'boolean', label: 'Boolean' },
]

const levelText = (l: Level) => l.displayValue ?? String(l.value)

export default function ContextVariablesEditor({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const headingId = useId()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [focusName, setFocusName] = useState<string | null>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const refocusAdd = useRef(false)
  const list = project.contextVariables ?? []

  useEffect(() => {
    if (!refocusAdd.current) return
    refocusAdd.current = false
    addRef.current?.focus()
  })

  const stamp = (next: ContextVariable[]) =>
    setProject({
      ...project,
      contextVariables: next,
      updatedAt: new Date().toISOString(),
    })

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const update = (id: string, changes: Partial<ContextVariable>) => {
    stamp(list.map((c) => (c.id === id ? { ...c, ...changes } : c)))
  }

  const remove = (id: string) => {
    refocusAdd.current = true
    stamp(list.filter((c) => c.id !== id))
  }

  const add = () => {
    const c = createContextVariable(project)
    stamp([...list, c])
    setExpanded(new Set([...Array.from(expanded), c.id]))
    setFocusName(c.id)
  }

  return (
    <div role="group" aria-labelledby={headingId} className="min-w-0">
      <div className="mb-3 flex items-baseline gap-2.5">
        <h3 id={headingId} className="text-16 font-semibold tracking-[-0.005em] text-ink">
          Context variables
        </h3>
        <span className="tnum text-16 font-medium text-ink-3">{list.length}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((cv) => (
          <ContextCard
            key={cv.id}
            cv={cv}
            expanded={expanded.has(cv.id)}
            focusName={focusName === cv.id}
            onFocused={() => setFocusName(null)}
            onToggle={() => toggle(cv.id)}
            onUpdate={(changes) => update(cv.id, changes)}
            onRemove={() => remove(cv.id)}
          />
        ))}
        {list.length === 0 && (
          <p className="rounded-panel bg-surface-2 px-4 py-3.5 text-13 text-ink-3 lg:col-span-2">
            No context variables yet. Add one to vary something like weather or travel purpose
            from one choice task to the next.
          </p>
        )}
        <button
          ref={addRef}
          type="button"
          onClick={add}
          className="focus-ring flex min-h-[4.25rem] items-center justify-center gap-1.5 rounded-panel border border-dashed border-line-2 px-4 py-3 text-13 font-medium text-ink-2 transition-colors hover:border-ink-4 hover:text-ink"
        >
          <Plus size={14} />
          Add context variable
        </button>
      </div>
      <p className="mt-3 max-w-[90ch] text-13 text-ink-3">
        Context variables are uniform across alternatives within a choice task and appear above
        the alternatives.
      </p>
    </div>
  )
}

function ContextCard({
  cv,
  expanded,
  focusName,
  onFocused,
  onToggle,
  onUpdate,
  onRemove,
}: {
  cv: ContextVariable
  expanded: boolean
  focusName: boolean
  onFocused: () => void
  onToggle: () => void
  onUpdate: (changes: Partial<ContextVariable>) => void
  onRemove: () => void
}) {
  const panelId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const title = cv.name.trim() || 'Untitled context variable'

  useEffect(() => {
    if (!focusName || !expanded) return
    nameRef.current?.focus()
    nameRef.current?.select()
    onFocused()
  }, [focusName, expanded, onFocused])

  return (
    <div
      className={cx(
        'min-w-0 rounded-panel bg-surface shadow-hairline',
        expanded && 'sm:col-span-2 lg:col-span-3',
      )}
    >
      <h4>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={expanded ? panelId : undefined}
          onClick={onToggle}
          className={cx(
            'focus-ring flex w-full items-start gap-2 px-3.5 pb-3 pt-3.5 text-left transition-colors hover:bg-surface-2',
            expanded ? 'rounded-t-panel' : 'rounded-panel',
          )}
        >
          <ChevronRight
            size={14}
            className={cx(
              'mt-0.5 shrink-0 text-ink-3 transition-transform motion-reduce:transition-none',
              expanded && 'rotate-90',
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-13 font-semibold text-ink">{title}</span>
              <span className="shrink-0 text-12 font-normal text-ink-3">context variable</span>
            </span>
            <span className="mt-1.5 block break-words font-mono text-12 font-normal leading-5 text-ink-2">
              <span className="text-ink-3">{'{ '}</span>
              {cv.levels.length > 0 ? cv.levels.map(levelText).join(', ') : 'no levels'}
              <span className="text-ink-3">{' }'}</span>
              {cv.unit && <span className="text-ink-3"> {cv.unit}</span>}
            </span>
          </span>
        </button>
      </h4>

      {expanded && (
        <div id={panelId} className="space-y-4 border-t border-line px-3.5 pb-4 pt-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Name">
              {(id) => (
                <Input
                  ref={nameRef}
                  id={id}
                  value={cv.name}
                  placeholder="e.g. Weather"
                  onChange={(e) => onUpdate({ name: e.target.value })}
                />
              )}
            </Field>
            <Field label="Type">
              {(id) => (
                <Select
                  id={id}
                  value={cv.type}
                  onChange={(e) => onUpdate({ type: e.target.value as AttributeType })}
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Unit" optional>
              {(id) => (
                <Input
                  id={id}
                  value={cv.unit ?? ''}
                  placeholder="e.g. min, °C"
                  onChange={(e) => onUpdate({ unit: e.target.value || undefined })}
                />
              )}
            </Field>
          </div>

          <ContextLevelsEditor cv={cv} onUpdate={onUpdate} />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
            <span className="min-w-0 truncate text-12 text-ink-3">
              ID <code className="font-mono">{cv.id}</code>
            </span>
            <Button
              variant="danger"
              size="sm"
              icon={<XMark size={14} />}
              onClick={onRemove}
              className="ml-auto"
            >
              Remove context variable
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ContextLevelsEditor({
  cv,
  onUpdate,
}: {
  cv: ContextVariable
  onUpdate: (changes: Partial<ContextVariable>) => void
}) {
  const headingId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const pendingFocus = useRef<number | 'add' | null>(null)

  // Removing or adding a level would otherwise leave focus on <body>.
  useEffect(() => {
    const p = pendingFocus.current
    pendingFocus.current = null
    if (p === null) return
    const target =
      p === 'add'
        ? null
        : rootRef.current?.querySelector<HTMLElement>(`[data-level-value="${p}"]`)
    ;(target ?? addRef.current)?.focus()
  })

  const updateLevel = (id: string, changes: Partial<Level>) => {
    onUpdate({
      levels: cv.levels.map((l) => (l.id === id ? { ...l, ...changes } : l)),
    })
  }
  const removeLevel = (id: string) => {
    const idx = cv.levels.findIndex((l) => l.id === id)
    pendingFocus.current = idx < cv.levels.length - 1 ? idx : 'add'
    onUpdate({
      levels: cv.levels
        .filter((l) => l.id !== id)
        .map((l, i) => ({ ...l, position: i })),
    })
  }
  const addLevel = () => {
    pendingFocus.current = cv.levels.length
    onUpdate({ levels: [...cv.levels, createContextLevel(cv)] })
  }

  const row = 'grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem] items-center gap-2'

  return (
    <div ref={rootRef} role="group" aria-labelledby={headingId} className="max-w-3xl">
      <h5 id={headingId} className="mb-2 text-13 font-semibold text-ink">
        Levels <span className="tnum font-normal text-ink-3">· {cv.levels.length}</span>
      </h5>
      <div
        aria-hidden="true"
        className={cx(row, 'mb-1.5 font-mono text-12 uppercase tracking-caps text-ink-3')}
      >
        <span className="text-center">#</span>
        <span>Value</span>
        <span className="truncate">Display label</span>
        <span />
      </div>
      <ul className="space-y-1.5">
        {cv.levels.map((l, i) => (
          <li key={l.id} className={row}>
            <span className="tnum text-center font-mono text-12 text-ink-3">{i + 1}</span>
            {cv.type === 'boolean' ? (
              <Select
                size="sm"
                data-level-value={i}
                aria-label={`Level ${i + 1} value`}
                value={String(l.value)}
                onChange={(e) => updateLevel(l.id, { value: e.target.value === 'true' })}
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </Select>
            ) : (
              <Input
                size="sm"
                data-level-value={i}
                type={cv.type === 'numeric' ? 'number' : 'text'}
                aria-label={`Level ${i + 1} value`}
                value={String(l.value)}
                onChange={(e) => {
                  const v = cv.type === 'numeric' ? Number(e.target.value) : e.target.value
                  updateLevel(l.id, { value: v })
                }}
                placeholder={cv.type === 'numeric' ? 'e.g. 12' : 'e.g. Sunny'}
                className={cv.type === 'numeric' ? 'tnum' : undefined}
              />
            )}
            <Input
              size="sm"
              aria-label={`Level ${i + 1} display label (optional)`}
              value={l.displayValue ?? ''}
              onChange={(e) => updateLevel(l.id, { displayValue: e.target.value || undefined })}
              placeholder="shown to respondents"
            />
            <IconButton
              size="sm"
              label={`Remove level ${i + 1}`}
              title={cv.levels.length <= 1 ? 'At least 1 level is required' : `Remove level ${i + 1}`}
              disabled={cv.levels.length <= 1}
              onClick={() => removeLevel(l.id)}
              className="enabled:hover:text-risk"
            >
              <XMark size={14} />
            </IconButton>
          </li>
        ))}
      </ul>
      <Button
        ref={addRef}
        variant="ghost"
        size="sm"
        icon={<Plus size={14} />}
        onClick={addLevel}
        className="mt-2"
      >
        Add level
      </Button>
    </div>
  )
}
