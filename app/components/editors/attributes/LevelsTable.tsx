'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type { Attribute, Level } from '@/lib/schema'
import { createLevel } from '@/lib/defaults'
import { Button, IconButton, Input, NumberInput, Select, cx } from '../../ui'
import { CloseIcon, PictureIcon, PlusIcon } from './icons'
import { COL_HEAD } from './grid'
import { levelPreview } from './model'

export const H4 = 'mb-2.5 text-13 font-semibold text-ink'

export type PriorColumn = {
  values: number[]
  labels: string[]
  set: (index: number, value: number) => void
}

// Focus the remove button now at `index` (or the last one); fall back to "Add level" when they are disabled.
export function focusAfterRemoval(list: HTMLElement | null, add: HTMLButtonElement | null, index: number) {
  const buttons = list ? Array.from(list.querySelectorAll<HTMLButtonElement>('[data-level-remove]')) : []
  const target = buttons[Math.min(index, buttons.length - 1)]
  if (target && !target.disabled) target.focus()
  else add?.focus()
}

export function LevelValueInput({
  attribute,
  level,
  label,
  onChange,
  className,
}: {
  attribute: Attribute
  level: Level
  label: string
  onChange: (value: Level['value']) => void
  className?: string
}) {
  if (attribute.type === 'boolean') {
    return (
      <Select
        size="sm"
        aria-label={label}
        value={String(level.value)}
        onChange={(e) => onChange(e.target.value === 'true')}
        className={className}
      >
        <option value="true">True</option>
        <option value="false">False</option>
      </Select>
    )
  }
  if (attribute.type === 'numeric') {
    const mode = attribute.pivot?.mode ?? 'none'
    const adorn = mode === 'relative' ? '×' : mode === 'absolute' ? 'Δ' : null
    return (
      <span className={cx('relative block min-w-0', className)}>
        {adorn && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-12 text-ink-3"
          >
            {adorn}
          </span>
        )}
        <NumberInput
          size="sm"
          aria-label={label}
          value={Number(level.value)}
          onValueChange={(v) => onChange(v)}
          placeholder="e.g. 30"
          className={cx('tnum font-mono', adorn && 'pl-6')}
        />
      </span>
    )
  }
  return (
    <Input
      size="sm"
      aria-label={label}
      value={String(level.value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder="e.g. Medium"
      className={className}
    />
  )
}

function displayPlaceholder(attribute: Attribute, level: Level): string {
  return attribute.type === 'numeric' && attribute.unit
    ? `e.g. "${level.value} ${attribute.unit}"`
    : 'Shown to respondents'
}

function LevelRow({
  attribute,
  level,
  index,
  canRemove,
  prior,
  onChange,
  onRemove,
}: {
  attribute: Attribute
  level: Level
  index: number
  canRemove: boolean
  prior: { value: number; label: string; set: (v: number) => void } | 'reference' | null
  onChange: (changes: Partial<Level>) => void
  onRemove: () => void
}) {
  const code = `L${index + 1}`
  const [imgOpen, setImgOpen] = useState(false)
  const [broken, setBroken] = useState(false)
  const imgButton = useRef<HTMLButtonElement>(null)
  const imgRowId = useId()
  const hasImg = !!level.imageUrl && level.imageUrl.trim() !== ''
  const preview = levelPreview(attribute, level)

  useEffect(() => setBroken(false), [level.imageUrl])

  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)_28px] items-center gap-x-2.5 gap-y-2 border-b border-line px-3 py-2 md:grid-cols-[var(--lv-cols)] md:py-1.5">
      <span className="font-mono text-12 text-ink-3">{code}</span>
      <LevelValueInput
        attribute={attribute}
        level={level}
        label={`${code} value`}
        onChange={(value) => onChange({ value })}
      />
      <Input
        size="sm"
        aria-label={`${code} display label`}
        value={level.displayValue ?? ''}
        placeholder={displayPlaceholder(attribute, level)}
        onChange={(e) => onChange({ displayValue: e.target.value || undefined })}
        className="col-start-2 md:col-start-auto"
      />
      <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 md:col-start-auto md:contents">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="sr-only">Preview: </span>
          <span className="tnum min-w-0 break-words text-13 font-semibold text-ink">{preview.text}</span>
          {preview.delta &&
            (preview.delta === 'no change' ? (
              <span className="text-12 text-ink-3">no change</span>
            ) : (
              <span className="rounded-tick bg-surface-3 px-1.5 py-[3px] font-mono text-12 leading-none text-ink-2">
                {preview.delta}
              </span>
            ))}
        </div>
        {prior === 'reference' && (
          <span className="text-12 text-ink-3" title="Reference level for the prior β">
            <span className="md:hidden">Prior β: </span>reference
          </span>
        )}
        {prior && prior !== 'reference' && (
          <label className="flex items-center gap-1.5 md:contents">
            <span aria-hidden="true" className="shrink-0 whitespace-nowrap text-12 text-ink-3 md:hidden">
              Prior β
            </span>
            <span className="block w-24 md:w-auto">
              <NumberInput
                size="sm"
                step={0.1}
                emptyBehavior={0}
                aria-label={`Prior β, ${prior.label}`}
                title={prior.label}
                value={prior.value}
                onValueChange={(v) => prior.set(v)}
                className="tnum font-mono"
              />
            </span>
          </label>
        )}
        <button
          ref={imgButton}
          type="button"
          aria-expanded={imgOpen}
          aria-controls={imgOpen ? imgRowId : undefined}
          aria-label={hasImg ? `Image for ${code}` : `Add image for ${code}`}
          title={broken ? 'Image failed to load' : hasImg ? level.imageUrl : 'Add an image'}
          onClick={() => setImgOpen((o) => !o)}
          className="focus-ring inline-flex size-7 items-center justify-center rounded-ctl text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
        >
          {hasImg && broken && (
            <span className="flex size-5 items-center justify-center rounded-bar border border-risk bg-risk-bg text-12 leading-none text-risk">
              !
            </span>
          )}
          {hasImg && !broken && (
            <img
              src={level.imageUrl}
              alt=""
              onError={() => setBroken(true)}
              className="size-5 rounded-bar object-cover shadow-hairline"
            />
          )}
          {!hasImg && <PictureIcon />}
        </button>
        <span title={level.id} className="min-w-0 truncate font-mono text-12 text-ink-3">
          <span className="sr-only">ID: </span>
          {level.id}
        </span>
      </div>
      <IconButton
        size="sm"
        label={`Remove level ${code}`}
        title={canRemove ? `Remove ${code}` : 'At least 2 levels required'}
        disabled={!canRemove}
        onClick={onRemove}
        data-level-remove=""
        className="col-start-3 row-start-1 md:col-start-auto md:row-start-auto"
      >
        <CloseIcon />
      </IconButton>
      {imgOpen && (
        <div id={imgRowId} className="col-start-2 col-end-[-1] flex min-w-0 items-center gap-1.5 pb-0.5">
          <Input
            size="sm"
            type="url"
            autoFocus
            aria-label={`Image URL for ${code}`}
            aria-invalid={broken || undefined}
            placeholder="https://… (png, jpg, svg)"
            value={level.imageUrl ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setBroken(false)
              onChange({ imageUrl: v.trim() === '' ? undefined : v })
            }}
            className="min-w-0 flex-1"
          />
          {broken && <span className="shrink-0 text-12 font-medium text-risk">Image failed to load</span>}
          <IconButton
            size="sm"
            label={hasImg ? `Remove image for ${code}` : `Close image field for ${code}`}
            onClick={() => {
              if (hasImg) onChange({ imageUrl: undefined })
              setImgOpen(false)
              imgButton.current?.focus()
            }}
          >
            <CloseIcon />
          </IconButton>
        </div>
      )}
    </li>
  )
}

export function LevelsTable({
  attribute,
  onUpdate,
  priors,
}: {
  attribute: Attribute
  onUpdate: (changes: Partial<Attribute>) => void
  priors: PriorColumn | null
}) {
  const levels = attribute.levels
  const canRemove = levels.length > 2
  const listRef = useRef<HTMLUListElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const pendingFocus = useRef<number | null>(null)

  // Removing a level unmounts the focused button; move focus to the level that took its place.
  useEffect(() => {
    const index = pendingFocus.current
    pendingFocus.current = null
    if (index === null) return
    focusAfterRemoval(listRef.current, addRef.current, index)
  }, [levels])

  const updateLevel = (id: string, changes: Partial<Level>) =>
    onUpdate({ levels: levels.map((l) => (l.id === id ? { ...l, ...changes } : l)) })
  const removeLevel = (id: string, index: number) => {
    pendingFocus.current = index
    onUpdate({ levels: levels.filter((l) => l.id !== id).map((l, i) => ({ ...l, position: i })) })
  }
  const addLevel = () => onUpdate({ levels: [...levels, createLevel(attribute)] })

  const cols = [
    '28px',
    'minmax(0,1fr)',
    'minmax(0,1.2fr)',
    'minmax(0,1fr)',
    ...(priors ? ['84px'] : []),
    '44px',
    '88px',
    '28px',
  ].join(' ')

  return (
    <div>
      <h4 className={H4}>
        Levels <span className="font-normal text-ink-3">· {levels.length}</span>
      </h4>
      <div
        className="rounded-well bg-surface shadow-hairline"
        style={{ ['--lv-cols' as string]: cols } as CSSProperties}
      >
        <div
          aria-hidden="true"
          className={cx(
            'hidden h-[30px] items-center gap-x-2.5 rounded-t-well border-b border-line bg-surface-2 px-3 md:grid md:grid-cols-[var(--lv-cols)]',
            COL_HEAD,
          )}
        >
          <span>#</span>
          <span>Value</span>
          <span className="truncate">Display label</span>
          <span>Preview</span>
          {priors && (
            <span className="truncate">
              Prior <span className="normal-case">β</span>
            </span>
          )}
          <span>Image</span>
          <span>ID</span>
          <span />
        </div>
        <ul ref={listRef}>
          {levels.map((l, i) => (
            <LevelRow
              key={l.id}
              attribute={attribute}
              level={l}
              index={i}
              canRemove={canRemove}
              prior={
                !priors
                  ? null
                  : i === 0
                    ? 'reference'
                    : {
                        value: priors.values[i - 1] ?? 0,
                        label: priors.labels[i - 1] ?? `L${i + 1}`,
                        set: (v) => priors.set(i - 1, v),
                      }
              }
              onChange={(changes) => updateLevel(l.id, changes)}
              onRemove={() => removeLevel(l.id, i)}
            />
          ))}
        </ul>
        <div className="px-1.5 py-1.5">
          <Button ref={addRef} variant="ghost" size="sm" icon={<PlusIcon />} onClick={addLevel}>
            Add level
          </Button>
        </div>
      </div>
      {priors && (
        <p className="mt-2 text-12 text-ink-3">
          Prior β for each level is relative to L1, the base level (dummy coding). Leave at 0 if unknown;
          the D-efficient search uses these values.
        </p>
      )}
    </div>
  )
}
