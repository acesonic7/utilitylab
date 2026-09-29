'use client'

import { useEffect, useId, useMemo, useRef } from 'react'
import type { Project, Constraint } from '@/lib/schema'
import { getLevelsForAlt } from '@/lib/levelLookup'
import { countViolations } from '@/lib/constraints'
import { Button, Checkbox, IconButton, Panel, Select, SeverityPips, Tag, cx } from '../ui'
import { Plus, XMark } from '../Icons'

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `c_${Math.random().toString(36).slice(2, 11)}`
}

// Where focus goes after the next commit: a control inside a constraint card, or an add button.
type PendingFocus =
  | { id: string; role: string }
  | { id: null; role: 'add' }

export default function ConstraintsEditor({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const constraints = project.constraints ?? []
  const rootRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const pendingFocus = useRef<PendingFocus | null>(null)

  useEffect(() => {
    const p = pendingFocus.current
    pendingFocus.current = null
    if (!p) return
    if (p.id === null) {
      addRef.current?.focus()
      return
    }
    const card = rootRef.current?.querySelector<HTMLElement>(
      `[data-constraint="${CSS.escape(p.id)}"]`,
    )
    const target =
      card?.querySelector<HTMLElement>(`[data-role="${p.role}"]:not(:disabled)`) ??
      card?.querySelector<HTMLElement>('[data-role="add-clause"]:not(:disabled)') ??
      card?.querySelector<HTMLElement>('[data-role="enable"]')
    target?.focus()
  })

  const stamp = (next: Constraint[]) =>
    setProject({ ...project, constraints: next, updatedAt: new Date().toISOString() })

  const update = (id: string, changes: Partial<Constraint>, focus?: string) => {
    if (focus) pendingFocus.current = { id, role: focus }
    stamp(constraints.map((c) => (c.id === id ? { ...c, ...changes } : c)))
  }

  const remove = (id: string) => {
    const idx = constraints.findIndex((c) => c.id === id)
    const neighbour = constraints[idx + 1] ?? constraints[idx - 1]
    pendingFocus.current = neighbour
      ? { id: neighbour.id, role: 'enable' }
      : { id: null, role: 'add' }
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
    pendingFocus.current = { id: newC.id, role: 'scope' }
    stamp([...constraints, newC])
  }

  // Memoised so typing elsewhere in Structure doesn't rescan the design. countViolations
  // reads only the rows, the alternatives and the constraint itself.
  const rows = project.design?.rows
  const violations = useMemo(() => {
    const out = new Map<string, number>()
    if (!rows || rows.length === 0) return out
    for (const c of constraints) {
      if (!c.enabled || c.clauses.length === 0) continue
      out.set(c.id, countViolations(rows, project, [c]).length)
    }
    return out
  }, [rows, project.alternatives, project.constraints])

  return (
    <div ref={rootRef}>
      <Panel title="Constraints" count={constraints.length} flush>
        <div className="px-5 pb-4">
          <p className="mb-3.5 text-13 text-ink-3">
            Forbidden combinations within an alternative. They apply during generation; uploaded
            designs are checked but not modified.
          </p>
          {constraints.length === 0 ? (
            <p className="rounded-card border border-dashed border-line-2 bg-surface-2 px-4 py-3.5 text-13 text-ink-3">
              No constraints. Add one to forbid implausible combinations like{' '}
              <code className="break-words font-mono text-12 text-ink-2">
                Bus.headway=5 AND Bus.comfort=Low
              </code>
              .
            </p>
          ) : (
            <ul className="space-y-3">
              {constraints.map((c, i) => (
                <ConstraintCard
                  key={c.id}
                  index={i}
                  project={project}
                  constraint={c}
                  violations={violations.get(c.id)}
                  onUpdate={(changes, focus) => update(c.id, changes, focus)}
                  onRemove={() => remove(c.id)}
                />
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-line px-5 py-3">
          <Button ref={addRef} size="sm" icon={<Plus size={14} />} onClick={add}>
            Add constraint
          </Button>
        </div>
      </Panel>
    </div>
  )
}

function ViolationStatus({ n }: { n: number | undefined }) {
  if (n === undefined) return null
  return n > 0 ? (
    <span className="inline-flex items-center gap-1.5 text-12 font-semibold text-risk">
      <SeverityPips severity="concern" />
      Violated in {n} choice {n === 1 ? 'task' : 'tasks'}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-12 text-ink-3">
      <SeverityPips severity="ok" />
      No violations in the design
    </span>
  )
}

function ConstraintCard({
  index,
  project,
  constraint: c,
  violations,
  onUpdate,
  onRemove,
}: {
  index: number
  project: Project
  constraint: Constraint
  violations: number | undefined
  onUpdate: (changes: Partial<Constraint>, focus?: string) => void
  onRemove: () => void
}) {
  const scopeId = useId()
  const altsActive = project.alternatives.filter((a) => !a.isOptOut)
  const n = index + 1
  const name = `Constraint ${n}`

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
    const next = c.clauses.filter((_, i) => i !== idx)
    onUpdate({ clauses: next }, idx < next.length ? `clause-attr-${idx}` : 'add-clause')
  }

  const addClause = () => {
    const firstAttr = applicableAttrs[0]
    if (!firstAttr) return
    const firstLevel = firstAttr.levels[0]
    if (!firstLevel) return
    onUpdate(
      { clauses: [...c.clauses, { attributeId: firstAttr.id, levelId: firstLevel.id }] },
      `clause-attr-${c.clauses.length}`,
    )
  }

  return (
    <li
      data-constraint={c.id}
      className={cx(
        'rounded-card border p-3',
        c.enabled ? 'border-line bg-surface-2' : 'border-dashed border-line-2 bg-surface',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <Checkbox
          data-role="enable"
          checked={c.enabled}
          onChange={(checked) => onUpdate({ enabled: checked })}
          label={<span className="sr-only">Enforce constraint {n}</span>}
          title="Enable / disable"
        />
        <label htmlFor={scopeId} className="text-13 text-ink-2">
          <span className="sr-only">{name}: </span>Forbid for
        </label>
        <Select
          id={scopeId}
          data-role="scope"
          size="sm"
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
            const filteredClauses = c.clauses.filter((cl) => validAttrIds.has(cl.attributeId))
            onUpdate({ alternativeId: newAltId, clauses: filteredClauses })
          }}
          className="max-w-[14rem]"
        >
          <option value="all">any alternative</option>
          {altsActive.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </Select>
        <span className="text-13 text-ink-2">when</span>
        {!c.enabled && <Tag tone="muted">Off</Tag>}
        <span className="ml-auto flex items-center gap-2">
          <ViolationStatus n={violations} />
          <IconButton
            size="sm"
            label={`Remove constraint ${n}`}
            onClick={onRemove}
            className="enabled:hover:text-risk"
          >
            <XMark size={14} />
          </IconButton>
        </span>
      </div>

      <ul className="mt-2 max-w-3xl space-y-1.5 sm:pl-6">
        {c.clauses.map((cl, i) => {
          const attr = applicableAttrs.find((a) => a.id === cl.attributeId)
          const cond = `${name}, condition ${i + 1}`
          return (
            <li
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_1.75rem] items-center gap-1.5 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto_minmax(0,1fr)_1.75rem]"
            >
              <span
                className={cx(
                  'col-span-full font-mono text-12 text-ink-3 sm:col-span-1',
                  i === 0 && 'hidden sm:block',
                )}
              >
                {i > 0 ? 'AND' : ''}
              </span>
              <Select
                size="sm"
                data-role={`clause-attr-${i}`}
                aria-label={`${cond} attribute`}
                value={cl.attributeId}
                onChange={(e) => {
                  const newAttr = applicableAttrs.find((a) => a.id === e.target.value)
                  const newLid = newAttr?.levels[0]?.id ?? ''
                  updateClause(i, { attributeId: e.target.value, levelId: newLid })
                }}
              >
                {applicableAttrs.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
              <span aria-hidden="true" className="text-13 text-ink-3">
                =
              </span>
              <Select
                size="sm"
                aria-label={`${cond} level`}
                value={cl.levelId}
                onChange={(e) => updateClause(i, { levelId: e.target.value })}
                disabled={!attr}
              >
                {(attr
                  ? c.alternativeId === 'all'
                    ? attr.levels
                    : getLevelsForAlt(attr, c.alternativeId)
                  : []
                ).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.displayValue ?? String(l.value)}
                  </option>
                ))}
              </Select>
              <IconButton
                size="sm"
                label={`Remove ${cond.charAt(0).toLowerCase()}${cond.slice(1)}`}
                onClick={() => removeClause(i)}
                className="enabled:hover:text-risk"
              >
                <XMark size={12} />
              </IconButton>
            </li>
          )
        })}
        <li className="sm:pl-[2.625rem]">
          <Button
            variant="ghost"
            size="sm"
            data-role="add-clause"
            icon={<Plus size={14} />}
            onClick={addClause}
            disabled={applicableAttrs.length === 0}
            title={applicableAttrs.length === 0 ? 'No attributes apply to this alternative' : undefined}
          >
            Add condition<span className="sr-only"> to constraint {n}</span>
          </Button>
        </li>
      </ul>
    </li>
  )
}
