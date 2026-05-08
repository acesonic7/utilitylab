'use client'

import { useState } from 'react'
import type {
  Project,
  Attribute,
  Level,
  AttributeType,
  PivotMode,
  PreferenceDirection,
} from '@/lib/schema'
import { createAttribute, createLevel } from '@/lib/defaults'
import { getLevelsForAlt, attrHasOverrides } from '@/lib/levelLookup'
import { ChevronDown, ChevronRight, Pencil, Plus, XMark } from '../Icons'
import Field, { inputCls, inputClsCompact } from './Field'

export default function AttributesEditor({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const stamp = (changes: Partial<Project>) =>
    setProject({ ...project, ...changes, updatedAt: new Date().toISOString() })

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const update = (id: string, changes: Partial<Attribute>) => {
    stamp({
      attributes: project.attributes.map((a) => (a.id === id ? { ...a, ...changes } : a)),
    })
  }

  const remove = (id: string) => {
    stamp({
      attributes: project.attributes.filter((a) => a.id !== id),
      builder: {
        ...project.builder,
        attributeOrder: project.builder.attributeOrder.filter((aid) => aid !== id),
      },
    })
  }

  const add = () => {
    const a = createAttribute(project)
    stamp({
      attributes: [...project.attributes, a],
      builder: {
        ...project.builder,
        attributeOrder: [...project.builder.attributeOrder, a.id],
      },
    })
    setExpanded(new Set([...expanded, a.id]))
  }

  return (
    <div className="rounded-xl bg-white ring-1 ring-neutral-200/60 shadow-sm p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Attributes ({project.attributes.length})
            <span className="text-rose-500 ml-1 normal-case font-normal" title="Required">
              *
            </span>
          </h3>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Variables describing the alternatives. Click any row to expand and edit
            type, unit, levels, etc.
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
        {project.attributes.map((attr) => (
          <AttributeCard
            key={attr.id}
            project={project}
            attribute={attr}
            expanded={expanded.has(attr.id)}
            onToggle={() => toggle(attr.id)}
            onUpdate={(changes) => update(attr.id, changes)}
            onRemove={() => remove(attr.id)}
          />
        ))}
        {project.attributes.length === 0 && (
          <li className="text-sm text-neutral-500 italic py-3">
            No attributes yet. Add one to start describing your alternatives.
          </li>
        )}
      </ul>
    </div>
  )
}

function AttributeCard({
  project,
  attribute,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
}: {
  project: Project
  attribute: Attribute
  expanded: boolean
  onToggle: () => void
  onUpdate: (changes: Partial<Attribute>) => void
  onRemove: () => void
}) {
  const types: AttributeType[] = ['numeric', 'categorical', 'boolean']
  const directions: { value: PreferenceDirection; label: string }[] = [
    { value: 'none', label: 'No preference / N/A' },
    { value: 'higher', label: 'Higher is better' },
    { value: 'lower', label: 'Lower is better' },
  ]

  const summary = [
    attribute.type,
    `${attribute.levels.length} level${attribute.levels.length !== 1 ? 's' : ''}`,
    attribute.unit,
    attribute.preferenceDirection && attribute.preferenceDirection !== 'none'
      ? `${attribute.preferenceDirection} better`
      : null,
    attribute.appliesTo === 'all' ? null : `${attribute.appliesTo.length} alts`,
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
            value={attribute.name}
            placeholder="Attribute name"
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="font-medium text-sm bg-transparent border-b border-dotted border-neutral-300 hover:border-neutral-500 focus:outline-none focus:border-solid focus:border-neutral-900 px-1 py-0.5 transition"
            style={{ width: `${Math.max(attribute.name.length, 10)}ch` }}
          />
          <Pencil
            size={11}
            className="absolute -right-4 text-neutral-300 group-hover:text-neutral-500 transition pointer-events-none"
          />
        </div>
        <span className="text-xs text-neutral-500 flex-1 truncate ml-3">{summary}</span>
        <span className="text-[11px] text-neutral-400 font-mono">{attribute.id}</span>
        <button
          onClick={onRemove}
          className="text-neutral-400 hover:text-red-600 p-1 rounded transition"
          aria-label="Remove attribute"
        >
          <XMark size={14} />
        </button>
      </div>
      {expanded && (
        <div className="p-4 pt-2 border-t border-neutral-200 bg-white rounded-b-lg space-y-4 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Type" required>
              <select
                value={attribute.type}
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
                value={attribute.unit ?? ''}
                placeholder="e.g. min, USD, %"
                onChange={(e) => onUpdate({ unit: e.target.value || undefined })}
                className={inputClsCompact}
              />
            </Field>
            <Field
              label="Preference direction"
              hint="Used in dominance check; leave neutral if not applicable."
            >
              <select
                value={attribute.preferenceDirection ?? 'none'}
                onChange={(e) =>
                  onUpdate({ preferenceDirection: e.target.value as PreferenceDirection })
                }
                className={inputClsCompact}
              >
                {directions.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {project.experimentType === 'labeled' && (
            <Field label="Applies to" required>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm select-none cursor-pointer">
                  <input
                    type="radio"
                    name={`appliesTo-${attribute.id}`}
                    checked={attribute.appliesTo === 'all'}
                    onChange={() => onUpdate({ appliesTo: 'all' })}
                    className="accent-neutral-900"
                  />
                  All alternatives
                </label>
                <label className="flex items-center gap-1.5 text-sm select-none cursor-pointer">
                  <input
                    type="radio"
                    name={`appliesTo-${attribute.id}`}
                    checked={attribute.appliesTo !== 'all'}
                    onChange={() =>
                      onUpdate({
                        appliesTo: project.alternatives
                          .filter((a) => !a.isOptOut)
                          .map((a) => a.id),
                      })
                    }
                    className="accent-neutral-900"
                  />
                  Specific:
                </label>
                {attribute.appliesTo !== 'all' && (
                  <div className="flex gap-1.5 flex-wrap">
                    {project.alternatives
                      .filter((a) => !a.isOptOut)
                      .map((a) => {
                        const list = attribute.appliesTo as string[]
                        const checked = list.includes(a.id)
                        return (
                          <label
                            key={a.id}
                            className={`text-xs px-2 py-0.5 rounded-md ring-1 cursor-pointer transition ${
                              checked
                                ? 'bg-neutral-900 text-white ring-neutral-900'
                                : 'bg-white ring-neutral-200 text-neutral-700 hover:ring-neutral-300 hover:bg-neutral-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={(e) => {
                                onUpdate({
                                  appliesTo: e.target.checked
                                    ? [...list, a.id]
                                    : list.filter((id) => id !== a.id),
                                })
                              }}
                            />
                            {a.label}
                          </label>
                        )
                      })}
                  </div>
                )}
              </div>
            </Field>
          )}

          {attribute.type === 'numeric' && (
            <PivotEditor attribute={attribute} onUpdate={onUpdate} />
          )}

          <LevelsEditor attribute={attribute} onUpdate={onUpdate} />

          {attribute.type === 'numeric' && (
            <PerAltOverridesEditor
              project={project}
              attribute={attribute}
              onUpdate={onUpdate}
            />
          )}
        </div>
      )}
    </li>
  )
}

function PerAltOverridesEditor({
  project,
  attribute,
  onUpdate,
}: {
  project: Project
  attribute: Attribute
  onUpdate: (changes: Partial<Attribute>) => void
}) {
  const applicableAlts = project.alternatives.filter(
    (a) =>
      !a.isOptOut &&
      (attribute.appliesTo === 'all' || attribute.appliesTo.includes(a.id)),
  )
  const overrides = attribute.levelsByAlternative ?? {}

  const setOverride = (altId: string, levels: Level[] | null) => {
    const next = { ...overrides }
    if (levels === null) {
      delete next[altId]
    } else {
      next[altId] = levels
    }
    onUpdate({
      levelsByAlternative: Object.keys(next).length > 0 ? next : undefined,
    })
  }

  const addOverride = (altId: string) => {
    // Copy default levels with FRESH IDs so they're unique within the attribute
    const copy: Level[] = attribute.levels.map((l, i) => ({
      ...l,
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `lv_${altId}_${i}_${Math.random().toString(36).slice(2, 8)}`,
    }))
    setOverride(altId, copy)
  }

  return (
    <div className="rounded-lg ring-1 ring-neutral-200 bg-neutral-50/40 p-3 mt-3">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Per-alternative ranges
        </h4>
        <span className="text-[11px] text-neutral-500">
          {attrHasOverrides(attribute)
            ? `${Object.keys(overrides).length} override${Object.keys(overrides).length !== 1 ? 's' : ''}`
            : 'None — all alts share the default levels above'}
        </span>
      </div>
      <p className="text-[11px] text-neutral-500 mb-3 leading-relaxed">
        Optional. Override the level set for specific alternatives — useful when
        modes operate at different scales (e.g. travel time for plane vs bike).
      </p>
      <ul className="space-y-2">
        {applicableAlts.map((alt) => {
          const override = overrides[alt.id]
          const isOverridden = !!override
          return (
            <li
              key={alt.id}
              className={`rounded-md ring-1 p-2 ${isOverridden ? 'bg-white ring-neutral-300' : 'bg-white/60 ring-neutral-200/60'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-700 flex-1">
                  {alt.label}
                </span>
                {isOverridden ? (
                  <>
                    <span className="text-[11px] text-neutral-500">
                      {override.length} level{override.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => setOverride(alt.id, null)}
                      className="text-xs px-2 py-0.5 rounded ring-1 ring-neutral-200 hover:ring-red-300 hover:bg-red-50/40 hover:text-red-700 transition"
                      title="Drop this override; alt reverts to default levels"
                    >
                      Reset
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] text-neutral-400 italic">
                      uses default
                    </span>
                    <button
                      onClick={() => addOverride(alt.id)}
                      disabled={attribute.levels.length === 0}
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ring-1 ring-neutral-200 hover:ring-neutral-300 hover:bg-neutral-50 transition disabled:opacity-50"
                    >
                      <Plus size={10} />
                      Add override
                    </button>
                  </>
                )}
              </div>
              {isOverridden && (
                <div className="mt-2">
                  <PerAltLevelsEditor
                    attribute={attribute}
                    levels={override}
                    onChange={(next) => setOverride(alt.id, next)}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PerAltLevelsEditor({
  attribute,
  levels,
  onChange,
}: {
  attribute: Attribute
  levels: Level[]
  onChange: (next: Level[]) => void
}) {
  const updateLevel = (id: string, changes: Partial<Level>) => {
    onChange(levels.map((l) => (l.id === id ? { ...l, ...changes } : l)))
  }
  const removeLevel = (id: string) => {
    onChange(
      levels.filter((l) => l.id !== id).map((l, i) => ({ ...l, position: i })),
    )
  }
  const addLevel = () => {
    const next = levels.length
    const newId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `lv_${next}_${Math.random().toString(36).slice(2, 8)}`
    onChange([...levels, { id: newId, value: next + 1, position: next }])
  }

  return (
    <div className="space-y-1.5">
      {levels.map((l, i) => (
        <div key={l.id} className="grid grid-cols-12 gap-1.5 items-center">
          <span className="col-span-1 text-[11px] text-neutral-400 font-mono text-center tabular-nums">
            {i + 1}
          </span>
          <input
            type="number"
            value={String(l.value)}
            onChange={(e) =>
              updateLevel(l.id, { value: Number(e.target.value) })
            }
            placeholder="value"
            className={`${inputClsCompact} col-span-5`}
          />
          <input
            type="text"
            value={l.displayValue ?? ''}
            onChange={(e) =>
              updateLevel(l.id, {
                displayValue: e.target.value || undefined,
              })
            }
            placeholder={attribute.unit ? `e.g. "${l.value} ${attribute.unit}"` : 'display label'}
            className={`${inputClsCompact} col-span-5`}
          />
          <button
            onClick={() => removeLevel(l.id)}
            disabled={levels.length <= 2}
            className="col-span-1 text-neutral-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded transition justify-self-center"
            aria-label="Remove level"
          >
            <XMark size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={addLevel}
        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 mt-1 rounded ring-1 ring-neutral-200 hover:ring-neutral-300 hover:bg-neutral-50 transition"
      >
        <Plus size={10} />
        Add level
      </button>
    </div>
  )
}

function PivotEditor({
  attribute,
  onUpdate,
}: {
  attribute: Attribute
  onUpdate: (changes: Partial<Attribute>) => void
}) {
  const pivot = attribute.pivot
  const mode: PivotMode = pivot?.mode ?? 'none'
  const isPivoted = mode !== 'none'

  const setMode = (newMode: PivotMode) => {
    if (newMode === 'none') {
      onUpdate({ pivot: { mode: 'none' } })
    } else {
      onUpdate({
        pivot: {
          mode: newMode,
          previewReference: pivot?.previewReference ?? 1,
          referenceToken: pivot?.referenceToken ?? `REF_${attribute.id.toUpperCase()}`,
        },
      })
    }
  }

  return (
    <Field
      label="Pivot mode"
      hint="Treat levels as deltas/multipliers of a per-respondent reference value (numeric attributes only)."
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as PivotMode)}
          className={inputClsCompact}
          style={{ width: 'auto' }}
        >
          <option value="none">None — levels are absolute values</option>
          <option value="absolute">Delta from reference (levels are deltas)</option>
          <option value="relative">Multiplier of reference (levels are multipliers)</option>
        </select>
      </div>
      {isPivoted && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field
            label="Preview reference"
            hint="Used to render resolved values in preview & export."
          >
            <input
              type="number"
              step="any"
              value={pivot?.previewReference ?? ''}
              onChange={(e) =>
                onUpdate({
                  pivot: {
                    ...(pivot ?? { mode }),
                    mode,
                    previewReference: e.target.value === '' ? undefined : Number(e.target.value),
                  },
                })
              }
              placeholder={mode === 'relative' ? 'e.g. 5.0' : 'e.g. 30'}
              className={inputClsCompact}
            />
          </Field>
          <Field
            label="Reference token"
            hint="Placeholder name used in the wiring guide."
          >
            <input
              type="text"
              value={pivot?.referenceToken ?? ''}
              onChange={(e) =>
                onUpdate({
                  pivot: {
                    ...(pivot ?? { mode }),
                    mode,
                    referenceToken: e.target.value || undefined,
                  },
                })
              }
              placeholder={`REF_${attribute.id.toUpperCase()}`}
              className={`${inputClsCompact} font-mono`}
            />
          </Field>
        </div>
      )}
    </Field>
  )
}

function LevelsEditor({
  attribute,
  onUpdate,
}: {
  attribute: Attribute
  onUpdate: (changes: Partial<Attribute>) => void
}) {
  const updateLevel = (id: string, changes: Partial<Level>) => {
    onUpdate({
      levels: attribute.levels.map((l) => (l.id === id ? { ...l, ...changes } : l)),
    })
  }
  const removeLevel = (id: string) => {
    onUpdate({
      levels: attribute.levels
        .filter((l) => l.id !== id)
        .map((l, i) => ({ ...l, position: i })),
    })
  }
  const addLevel = () => {
    onUpdate({ levels: [...attribute.levels, createLevel(attribute)] })
  }

  return (
    <Field label={`Levels (${attribute.levels.length})`} required>
      <div className="grid grid-cols-12 gap-1.5 mb-1.5 text-[10px] uppercase tracking-wider text-neutral-400">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-5">
          Value <span className="text-rose-500">*</span>
        </div>
        <div className="col-span-5">Display label (optional)</div>
        <div className="col-span-1"></div>
      </div>
      <ul className="space-y-1.5">
        {attribute.levels.map((l, i) => (
          <li key={l.id} className="grid grid-cols-12 gap-1.5 items-center">
            <span className="col-span-1 text-[11px] text-neutral-400 font-mono text-center tabular-nums">
              {i + 1}
            </span>
            <div className="col-span-5">
              {attribute.type === 'boolean' ? (
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
                  type={attribute.type === 'numeric' ? 'number' : 'text'}
                  value={String(l.value)}
                  onChange={(e) => {
                    const v =
                      attribute.type === 'numeric' ? Number(e.target.value) : e.target.value
                    updateLevel(l.id, { value: v })
                  }}
                  placeholder={
                    attribute.type === 'numeric' ? 'e.g. 30' : 'e.g. Medium'
                  }
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
                placeholder={
                  attribute.type === 'numeric' && attribute.unit
                    ? `e.g. "${l.value} ${attribute.unit}"`
                    : 'shown to respondents'
                }
                className={inputClsCompact}
              />
            </div>
            <button
              onClick={() => removeLevel(l.id)}
              disabled={attribute.levels.length <= 2}
              className="col-span-1 text-neutral-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded transition justify-self-center"
              aria-label="Remove level"
              title={attribute.levels.length <= 2 ? 'At least 2 levels required' : 'Remove'}
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
