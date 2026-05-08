'use client'

import type { Project, Constraint } from '@/lib/schema'
import { Plus, XMark } from '../Icons'

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `c_${Math.random().toString(36).slice(2, 11)}`
}

export default function ConstraintsEditor({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const constraints = project.constraints ?? []

  const stamp = (next: Constraint[]) =>
    setProject({ ...project, constraints: next, updatedAt: new Date().toISOString() })

  const update = (id: string, changes: Partial<Constraint>) => {
    stamp(constraints.map((c) => (c.id === id ? { ...c, ...changes } : c)))
  }

  const remove = (id: string) => {
    stamp(constraints.filter((c) => c.id !== id))
  }

  const add = () => {
    const firstAlt = project.alternatives.find((a) => !a.isOptOut)
    const newC: Constraint = {
      id: genId(),
      type: 'forbidden_combination',
      alternativeId: firstAlt?.id ?? 'all',
      clauses: [],
      enabled: true,
    }
    stamp([...constraints, newC])
  }

  return (
    <div className="rounded-xl bg-white ring-1 ring-neutral-200/60 shadow-sm p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Constraints ({constraints.length})
          </h3>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Forbidden combinations within an alternative. Apply during generation;
            uploaded designs are checked but not modified.
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
      {constraints.length === 0 ? (
        <p className="text-sm text-neutral-500 italic py-3">
          No constraints. Add one to forbid implausible combinations like{' '}
          <code className="font-mono text-xs">Bus.headway=5 AND Bus.comfort=Low</code>.
        </p>
      ) : (
        <ul className="space-y-3">
          {constraints.map((c) => (
            <ConstraintCard
              key={c.id}
              project={project}
              constraint={c}
              onUpdate={(changes) => update(c.id, changes)}
              onRemove={() => remove(c.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ConstraintCard({
  project,
  constraint: c,
  onUpdate,
  onRemove,
}: {
  project: Project
  constraint: Constraint
  onUpdate: (changes: Partial<Constraint>) => void
  onRemove: () => void
}) {
  const altsActive = project.alternatives.filter((a) => !a.isOptOut)

  // Attributes available given the chosen alternative scope
  const applicableAttrs =
    c.alternativeId === 'all'
      ? project.attributes
      : project.attributes.filter(
          (a) => a.appliesTo === 'all' || a.appliesTo.includes(c.alternativeId),
        )

  const updateClause = (
    idx: number,
    changes: Partial<{ attributeId: string; levelId: string }>,
  ) => {
    const next = c.clauses.map((cl, i) => (i === idx ? { ...cl, ...changes } : cl))
    onUpdate({ clauses: next })
  }

  const removeClause = (idx: number) => {
    onUpdate({ clauses: c.clauses.filter((_, i) => i !== idx) })
  }

  const addClause = () => {
    const firstAttr = applicableAttrs[0]
    if (!firstAttr) return
    const firstLevel = firstAttr.levels[0]
    if (!firstLevel) return
    onUpdate({
      clauses: [
        ...c.clauses,
        { attributeId: firstAttr.id, levelId: firstLevel.id },
      ],
    })
  }

  return (
    <li
      className={`rounded-lg ring-1 p-3 ${
        c.enabled ? 'ring-neutral-200 bg-neutral-50/40' : 'ring-neutral-200 bg-neutral-50/30 opacity-60'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <input
          type="checkbox"
          checked={c.enabled}
          onChange={(e) => onUpdate({ enabled: e.target.checked })}
          className="accent-neutral-900"
          title="Enable / disable"
        />
        <span className="text-xs text-neutral-600">Forbid for</span>
        <select
          value={c.alternativeId}
          onChange={(e) => {
            // When alt scope changes, drop clauses referencing now-inapplicable attrs
            const newAltId = e.target.value
            const newApplicable =
              newAltId === 'all'
                ? project.attributes
                : project.attributes.filter(
                    (a) => a.appliesTo === 'all' || a.appliesTo.includes(newAltId),
                  )
            const validAttrIds = new Set(newApplicable.map((a) => a.id))
            const filteredClauses = c.clauses.filter((cl) =>
              validAttrIds.has(cl.attributeId),
            )
            onUpdate({ alternativeId: newAltId, clauses: filteredClauses })
          }}
          className="bg-white rounded px-2 py-1 text-xs ring-1 ring-neutral-200 hover:ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition"
        >
          <option value="all">any alternative</option>
          {altsActive.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-600">when:</span>
        <button
          onClick={onRemove}
          className="ml-auto text-neutral-400 hover:text-red-600 p-1 rounded transition"
          aria-label="Remove constraint"
          title="Remove"
        >
          <XMark size={14} />
        </button>
      </div>
      <ul className="space-y-1.5 ml-6">
        {c.clauses.map((cl, i) => {
          const attr = applicableAttrs.find((a) => a.id === cl.attributeId)
          return (
            <li key={i} className="flex items-center gap-2 text-xs">
              {i > 0 && (
                <span className="text-[10px] uppercase tracking-wider text-neutral-400 w-7">
                  AND
                </span>
              )}
              {i === 0 && <span className="w-7" />}
              <select
                value={cl.attributeId}
                onChange={(e) => {
                  const newAttr = applicableAttrs.find((a) => a.id === e.target.value)
                  const newLid = newAttr?.levels[0]?.id ?? ''
                  updateClause(i, { attributeId: e.target.value, levelId: newLid })
                }}
                className="bg-white rounded px-2 py-1 ring-1 ring-neutral-200 hover:ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition"
              >
                {applicableAttrs.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <span className="text-neutral-500">=</span>
              <select
                value={cl.levelId}
                onChange={(e) => updateClause(i, { levelId: e.target.value })}
                className="bg-white rounded px-2 py-1 ring-1 ring-neutral-200 hover:ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition flex-1 min-w-0"
                disabled={!attr}
              >
                {attr?.levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.displayValue ?? String(l.value)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeClause(i)}
                className="text-neutral-400 hover:text-red-600 p-1 rounded transition"
                aria-label="Remove clause"
              >
                <XMark size={12} />
              </button>
            </li>
          )
        })}
        <li className="flex items-center gap-2 ml-7">
          <button
            onClick={addClause}
            disabled={applicableAttrs.length === 0}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ring-1 ring-neutral-200 hover:ring-neutral-300 hover:bg-neutral-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={11} />
            Add condition
          </button>
        </li>
      </ul>
    </li>
  )
}
