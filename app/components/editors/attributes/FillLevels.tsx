'use client'

import { useId, useMemo, useState } from 'react'
import type { Attribute, Level } from '@/lib/schema'
import type { AltIdentity } from '@/lib/altIdentity'
import {
  buildLevels,
  defaultFillInput,
  fillNotes,
  fillValues,
  mergeValues,
  roundingKind,
  roundingOptions,
  type FillInput,
  type FillMethod,
} from '@/lib/levelFill'
import { Button, Field, NumberInput, Seg, Select, cx } from '../../ui'
import { LevelsViz } from './LevelsViz'
import { newLevelId, fmtNum } from './model'
import { appliesTo } from './AttributeRow'

const METHODS: { value: FillMethod; label: string }[] = [
  { value: 'step', label: 'Range + step' },
  { value: 'count', label: 'Range + count' },
  { value: 'reference', label: 'Around a reference' },
  { value: 'geometric', label: 'Geometric' },
]

type NumKey = Exclude<keyof FillInput, 'method' | 'round'>
type FieldSpec = { key: NumKey; label: string; integer?: boolean; min?: number; unit?: boolean }

const FIELDS: Record<FillMethod, FieldSpec[]> = {
  step: [
    { key: 'from', label: 'From', unit: true },
    { key: 'to', label: 'To', unit: true },
    { key: 'step', label: 'Every', unit: true },
  ],
  count: [
    { key: 'from', label: 'From', unit: true },
    { key: 'to', label: 'To', unit: true },
    { key: 'count', label: 'Levels', integer: true, min: 2 },
  ],
  reference: [
    { key: 'reference', label: 'Reference', unit: true },
    { key: 'percent', label: 'Step (%)' },
    { key: 'stepsEachSide', label: 'Steps each side', integer: true, min: 1 },
  ],
  geometric: [
    { key: 'start', label: 'Start', unit: true },
    { key: 'ratio', label: '× each level' },
    { key: 'count', label: 'Levels', integer: true, min: 2 },
  ],
}

const SHARED = '__shared'

export function FillLevels({
  attribute,
  active,
  onUpdate,
  onClose,
}: {
  attribute: Attribute
  active: AltIdentity[]
  onUpdate: (changes: Partial<Attribute>) => void
  onClose: () => void
}) {
  const uid = useId()
  const [target, setTarget] = useState<string>(SHARED)
  const overrides = attribute.levelsByAlternative ?? {}
  const targetLevels: Level[] = target === SHARED ? attribute.levels : overrides[target] ?? attribute.levels
  const [input, setInput] = useState<FillInput>(() => defaultFillInput(attribute, attribute.levels))
  const kind = roundingKind(attribute)
  const rounding = roundingOptions(kind, attribute.unit)
  const unit = kind === 'multiplier' ? '×' : attribute.unit
  const applicable = active.filter((a) => appliesTo(attribute, a.altId))

  const result = useMemo(() => fillValues(input), [input])
  const notes = fillNotes(attribute, input, result)
  const preview = useMemo(
    () => result.values.map((v, i) => ({ id: `preview-${i}`, value: v, position: i })),
    [result.values],
  )
  const set = (key: keyof FillInput, value: FillInput[keyof FillInput]) => setInput((cur) => ({ ...cur, [key]: value }))

  const apply = (mode: 'replace' | 'add') => {
    const values = mode === 'replace' ? result.values : mergeValues(targetLevels, result.values)
    const levels = buildLevels(values, () => newLevelId('fill'), targetLevels)
    if (target === SHARED) onUpdate({ levels })
    else onUpdate({ levelsByAlternative: { ...overrides, [target]: levels } })
    onClose()
  }

  const targetName = target === SHARED ? 'shared' : `${active.find((a) => a.altId === target)?.label ?? ''}’s`
  const current = targetLevels.map((l) => fmtNum(Number(l.value))).join(', ')
  const canApply = !result.error && result.values.length >= 2

  return (
    <section
      aria-labelledby={`${uid}-title`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
      className="mt-3 rounded-well border border-line-2 bg-surface p-4 shadow-raised"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h5 id={`${uid}-title`} className="text-14 font-semibold text-ink">
          Fill levels
        </h5>
        <span className="text-12 text-ink-3">
          {attribute.name}
          {unit ? ` · ${unit}` : ''}
          {attribute.pivot?.mode === 'relative' ? ' · multipliers of the reference' : ''}
          {attribute.pivot?.mode === 'absolute' ? ' · offsets from the reference' : ''}
        </span>
      </div>

      <Seg
        ariaLabel="Fill method"
        size="sm"
        options={METHODS}
        value={input.method}
        onChange={(m) => set('method', m)}
        className="mt-3 max-w-full flex-wrap"
      />

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {FIELDS[input.method].map((f) => (
          <Field key={f.key} label={f.unit && unit ? `${f.label} (${unit})` : f.label}>
            {(fid) => (
              <NumberInput
                id={fid}
                size="sm"
                value={input[f.key]}
                integer={f.integer}
                min={f.min}
                emptyBehavior="revert"
                onValueChange={(v) => set(f.key, v)}
                className="tnum font-mono"
              />
            )}
          </Field>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Round to">
          {(fid) => (
            <Select id={fid} size="sm" value={String(input.round)} onChange={(e) => set('round', Number(e.target.value))}>
              {rounding.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {applicable.length > 0 && (
          <Field label="Apply to" className="sm:col-span-2">
            {(fid) => (
              <Select id={fid} size="sm" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value={SHARED}>Shared levels (every alternative without its own)</option>
                {applicable.map((a) => (
                  <option key={a.altId} value={a.altId}>
                    {a.label} only ({overrides[a.altId] ? 'replaces its own levels' : 'gives it its own levels'})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>

      <div className="mt-4" aria-live="polite">
        <p className="text-12 font-medium text-ink-2">Preview</p>
        {result.error ? (
          <p className="mt-1.5 text-13 text-risk">{result.error}</p>
        ) : (
          <>
            <LevelsViz attribute={attribute} levels={preview} className="mt-1.5" />
            <p className="tnum mt-1 font-mono text-12 text-ink-2">
              {result.values.map((v) => fmtNum(v)).join(' · ')}
              {unit ? ` ${unit}` : ''}
            </p>
          </>
        )}
        {notes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {notes.map((n) => (
              <li key={n.text} className={cx('text-12', n.tone === 'warning' ? 'text-caution' : 'text-ink-3')}>
                {n.text}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-12 text-ink-3">
          Replaces the {targetName} levels ({current}). Levels whose value stays keep their label and image. A
          design built on the old levels is marked out of date, and constraints that used a removed level are flagged.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={!canApply} onClick={() => apply('add')}>
          Add to existing
        </Button>
        <Button size="sm" disabled={!canApply} onClick={() => apply('replace')} className="enabled:border-ink">
          Replace with {result.values.length} {result.values.length === 1 ? 'level' : 'levels'}
        </Button>
      </div>
    </section>
  )
}
