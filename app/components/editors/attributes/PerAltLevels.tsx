'use client'

import { useEffect, useRef } from 'react'
import type { Attribute, Level } from '@/lib/schema'
import { altStyle, type AltIdentity } from '@/lib/altIdentity'
import { attrHasOverrides } from '@/lib/levelLookup'
import { AltLabel, Button, IconButton, Input, NumberInput } from '../../ui'
import { LevelsViz } from './LevelsViz'
import { CloseIcon, PlusIcon } from './icons'
import { newLevelId } from './model'
import { appliesTo } from './AttributeRow'
import { focusAfterRemoval } from './LevelsTable'

function OverrideLevels({
  attribute,
  alt,
  levels,
  onChange,
}: {
  attribute: Attribute
  alt: AltIdentity
  levels: Level[]
  onChange: (next: Level[]) => void
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const pendingFocus = useRef<number | null>(null)

  useEffect(() => {
    const index = pendingFocus.current
    pendingFocus.current = null
    if (index === null) return
    focusAfterRemoval(listRef.current, addRef.current, index)
  }, [levels])

  const update = (id: string, changes: Partial<Level>) =>
    onChange(levels.map((l) => (l.id === id ? { ...l, ...changes } : l)))
  const remove = (id: string, index: number) => {
    pendingFocus.current = index
    onChange(levels.filter((l) => l.id !== id).map((l, i) => ({ ...l, position: i })))
  }
  const add = () => {
    const next = levels.length
    onChange([...levels, { id: newLevelId(String(next)), value: next + 1, position: next }])
  }

  return (
    <div className="mt-2.5 space-y-2">
      <LevelsViz attribute={attribute} levels={levels} />
      <ul ref={listRef} className="space-y-1.5">
        {levels.map((l, i) => {
          const code = `L${i + 1}`
          return (
            <li
              key={l.id}
              className="grid grid-cols-[28px_minmax(0,1fr)_28px] items-center gap-x-2 gap-y-1.5 sm:grid-cols-[28px_minmax(0,1fr)_minmax(0,1.3fr)_28px]"
            >
              <span className="font-mono text-12 text-ink-3">{code}</span>
              <NumberInput
                size="sm"
                aria-label={`${alt.label} ${code} value`}
                value={Number(l.value)}
                onValueChange={(v) => update(l.id, { value: v })}
                placeholder="value"
                className="tnum font-mono"
              />
              <Input
                size="sm"
                aria-label={`${alt.label} ${code} display label`}
                value={l.displayValue ?? ''}
                placeholder={attribute.unit ? `e.g. "${l.value} ${attribute.unit}"` : 'Display label'}
                onChange={(e) => update(l.id, { displayValue: e.target.value || undefined })}
                className="col-start-2 sm:col-start-auto"
              />
              <IconButton
                size="sm"
                label={`Remove level ${code} for ${alt.label}`}
                title={levels.length <= 2 ? 'At least 2 levels required' : `Remove ${code}`}
                disabled={levels.length <= 2}
                onClick={() => remove(l.id, i)}
                data-level-remove=""
                className="col-start-3 row-start-1 sm:col-start-auto sm:row-start-auto"
              >
                <CloseIcon />
              </IconButton>
            </li>
          )
        })}
      </ul>
      <Button
        ref={addRef}
        variant="ghost"
        size="sm"
        icon={<PlusIcon />}
        onClick={add}
        aria-label={`Add level for ${alt.label}`}
      >
        Add level
      </Button>
    </div>
  )
}

export function PerAltLevels({
  attribute,
  active,
  onUpdate,
}: {
  attribute: Attribute
  active: AltIdentity[]
  onUpdate: (changes: Partial<Attribute>) => void
}) {
  const applicable = active.filter((a) => appliesTo(attribute, a.altId))
  const overrides = attribute.levelsByAlternative ?? {}
  const count = Object.keys(overrides).length

  const setOverride = (altId: string, levels: Level[] | null) => {
    const next = { ...overrides }
    if (levels === null) delete next[altId]
    else next[altId] = levels
    onUpdate({ levelsByAlternative: Object.keys(next).length > 0 ? next : undefined })
  }

  // Copies the default levels with fresh ids, so level ids stay unique across the attribute.
  const addOverride = (altId: string) =>
    setOverride(
      altId,
      attribute.levels.map((l, i) => ({ ...l, id: newLevelId(`${altId}_${i}`) })),
    )

  return (
    <div>
      <div className="mb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <h4 className="text-13 font-semibold text-ink">Per-alternative levels</h4>
          <span className="text-12 text-ink-3">
            {attrHasOverrides(attribute)
              ? `${count} ${count === 1 ? 'alternative has' : 'alternatives have'} own levels`
              : 'None: every alternative uses the levels above'}
          </span>
        </div>
        <p className="mt-1 max-w-[72ch] text-12 text-ink-3">
          Optional. Give an alternative its own level set when alternatives operate at different scales, for example
          travel time by plane and by bike.
        </p>
      </div>
      {applicable.length === 0 ? (
        <p className="text-13 text-ink-3">This attribute does not apply to any alternative yet.</p>
      ) : (
        <ul className="grid gap-2 xl:grid-cols-2">
          {applicable.map((alt) => {
            const own = overrides[alt.altId]
            return (
              <li
                key={alt.altId}
                style={altStyle(alt)}
                className="min-w-0 rounded-well border-l-[3px] border-alt bg-surface py-2.5 pl-3 pr-2.5 shadow-hairline"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <AltLabel identity={alt} size="sm" className="mr-auto" />
                  {own ? (
                    <>
                      <span className="text-12 text-ink-3">
                        {own.length} {own.length === 1 ? 'level' : 'levels'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Drop this level set; the alternative uses the default levels again"
                        aria-label={`Reset to default levels for ${alt.label}`}
                        onClick={() => setOverride(alt.altId, null)}
                      >
                        Reset to default
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-12 text-ink-3">Uses the default levels</span>
                      <Button
                        size="sm"
                        icon={<PlusIcon />}
                        disabled={attribute.levels.length === 0}
                        aria-label={`Use own levels for ${alt.label}`}
                        onClick={() => addOverride(alt.altId)}
                      >
                        Own levels
                      </Button>
                    </>
                  )}
                </div>
                {own && (
                  <OverrideLevels
                    attribute={attribute}
                    alt={alt}
                    levels={own}
                    onChange={(next) => setOverride(alt.altId, next)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
