'use client'

import { useState } from 'react'
import type {
  Project,
  ContextVariable,
  Level,
  AttributeType,
} from '@/lib/schema'
import { createContextVariable, createContextLevel } from '@/lib/defaults'
import { ChevronDown, ChevronRight, Pencil, Plus, XMark } from '../Icons'
import Field, { inputClsCompact } from './Field'

export default function ContextVariablesEditor({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const list = project.contextVariables ?? []

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
    stamp(list.filter((c) => c.id !== id))
  }

  const add = () => {
    const c = createContextVariable(project)
    stamp([...list, c])
    setExpanded(new Set([...expanded, c.id]))
  }

  return (
    <div className="rounded-xl bg-white ring-1 ring-neutral-200/60 shadow-sm p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Scenario context ({list.length})
          </h3>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Variables that vary per choice task but are uniform across alternatives
            (e.g. weather, travel purpose). Shown above each choice table.
          </p>
        </div>
        <button
          onClick={add}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md ring-1 ring-neutral-200 hover:ring-neutral-300 hover:bg-neutral-50 transition"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      <ul className="space-y-2">
        {list.map((cv) => (
          <ContextCard
            key={cv.id}
            cv={cv}
            expanded={expanded.has(cv.id)}
            onToggle={() => toggle(cv.id)}
            onUpdate={(changes) => update(cv.id, changes)}
            onRemove={() => remove(cv.id)}
          />
        ))}
        {list.length === 0 && (
          <li className="text-sm text-neutral-500 italic py-3">
            No scenario context yet. Add one to vary something like weather or trip
            purpose across choice tasks.
          </li>
        )}
      </ul>
    </div>
  )
}

function ContextCard({
  cv,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
}: {
  cv: ContextVariable
  expanded: boolean
  onToggle: () => void
  onUpdate: (changes: Partial<ContextVariable>) => void
  onRemove: () => void
}) {
  const types: AttributeType[] = ['categorical', 'numeric', 'boolean']

  const summary = [
    cv.type,
    `${cv.levels.length} level${cv.levels.length !== 1 ? 's' : ''}`,
    cv.unit,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li
      className={`rounded-lg ring-1 ${
        expanded ? 'ring-neutral-300 bg-neutral-50/50' : 'ring-neutral-200'
      } transition`}
    >
      <div className="flex items-center gap-2 p-2">
        <button
          onClick={onToggle}
          className="text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-neutral-100 transition"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="group relative inline-flex items-center">
          <input
            type="text"
            value={cv.name}
            placeholder="Context name"
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="font-medium text-sm bg-transparent border-b border-dotted border-neutral-300 hover:border-neutral-500 focus:outline-none focus:border-solid focus:border-neutral-900 px-1 py-0.5 transition"
            style={{ width: `${Math.max(cv.name.length, 10)}ch` }}
          />
          <Pencil
            size={11}
            className="absolute -right-4 text-neutral-300 group-hover:text-neutral-500 transition pointer-events-none"
          />
        </div>
        <span className="text-xs text-neutral-500 flex-1 truncate ml-3">{summary}</span>
        <span className="text-[11px] text-neutral-400 font-mono">{cv.id}</span>
        <button
          onClick={onRemove}
          className="text-neutral-400 hover:text-red-600 p-1 rounded transition"
          aria-label="Remove context variable"
        >
          <XMark size={14} />
        </button>
      </div>
      {expanded && (
        <div className="p-4 pt-2 border-t border-neutral-200 bg-white rounded-b-lg space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" required>
              <select
                value={cv.type}
                onChange={(e) => onUpdate({ type: e.target.value as AttributeType })}
                className={inputClsCompact}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unit">
              <input
                type="text"
                value={cv.unit ?? ''}
                placeholder="e.g. min, °C"
                onChange={(e) => onUpdate({ unit: e.target.value || undefined })}
                className={inputClsCompact}
              />
            </Field>
          </div>

          <ContextLevelsEditor cv={cv} onUpdate={onUpdate} />
        </div>
      )}
    </li>
  )
}

function ContextLevelsEditor({
  cv,
  onUpdate,
}: {
  cv: ContextVariable
  onUpdate: (changes: Partial<ContextVariable>) => void
}) {
  const updateLevel = (id: string, changes: Partial<Level>) => {
    onUpdate({
      levels: cv.levels.map((l) => (l.id === id ? { ...l, ...changes } : l)),
    })
  }
  const removeLevel = (id: string) => {
    onUpdate({
      levels: cv.levels
        .filter((l) => l.id !== id)
        .map((l, i) => ({ ...l, position: i })),
    })
  }
  const addLevel = () => {
    onUpdate({ levels: [...cv.levels, createContextLevel(cv)] })
  }

  return (
    <Field label={`Levels (${cv.levels.length})`} required>
      <div className="grid grid-cols-12 gap-1.5 mb-1.5 text-[10px] uppercase tracking-wider text-neutral-400">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-5">
          Value <span className="text-rose-500">*</span>
        </div>
        <div className="col-span-5">Display label (optional)</div>
        <div className="col-span-1"></div>
      </div>
      <ul className="space-y-1.5">
        {cv.levels.map((l, i) => (
          <li key={l.id} className="grid grid-cols-12 gap-1.5 items-center">
            <span className="col-span-1 text-[11px] text-neutral-400 font-mono text-center tabular-nums">
              {i + 1}
            </span>
            <div className="col-span-5">
              {cv.type === 'boolean' ? (
                <select
                  value={String(l.value)}
                  onChange={(e) => updateLevel(l.id, { value: e.target.value === 'true' })}
                  className={inputClsCompact}
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : (
                <input
                  type={cv.type === 'numeric' ? 'number' : 'text'}
                  value={String(l.value)}
                  onChange={(e) => {
                    const v =
                      cv.type === 'numeric' ? Number(e.target.value) : e.target.value
                    updateLevel(l.id, { value: v })
                  }}
                  placeholder={cv.type === 'numeric' ? 'e.g. 12' : 'e.g. Sunny'}
                  className={inputClsCompact}
                />
              )}
            </div>
            <div className="col-span-5">
              <input
                type="text"
                value={l.displayValue ?? ''}
                onChange={(e) =>
                  updateLevel(l.id, { displayValue: e.target.value || undefined })
                }
                placeholder="shown to respondents"
                className={inputClsCompact}
              />
            </div>
            <button
              onClick={() => removeLevel(l.id)}
              disabled={cv.levels.length <= 1}
              className="col-span-1 text-neutral-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded transition justify-self-center"
              aria-label="Remove level"
              title={cv.levels.length <= 1 ? 'At least 1 level required' : 'Remove'}
            >
              <XMark size={14} />
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={addLevel}
        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 mt-2 rounded-md ring-1 ring-neutral-200 hover:ring-neutral-300 hover:bg-neutral-50 transition"
      >
        <Plus size={12} />
        Add level
      </button>
    </Field>
  )
}
