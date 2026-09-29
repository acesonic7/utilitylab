'use client'

import type { MouseEvent } from 'react'
import type { Attribute } from '@/lib/schema'
import type { AltIdentity } from '@/lib/altIdentity'
import { paramCount } from '@/lib/dOptimal'
import { AltGlyph, cx } from '../../ui'
import { ChevronIcon, PrefIcon } from './icons'
import { LevelsViz } from './LevelsViz'
import { ATTR_GRID, PARAMS_CELL } from './grid'
import { PREF_TEXT, prefOf, typeParts } from './model'

export function appliesTo(attribute: Attribute, altId: string): boolean {
  return attribute.appliesTo === 'all' || attribute.appliesTo.includes(altId)
}

// Toggling from 'all' starts an explicit list of the current alternatives, as "Specific" did.
export function toggleApplies(attribute: Attribute, active: AltIdentity[], altId: string): Attribute['appliesTo'] {
  const list = attribute.appliesTo === 'all' ? active.map((a) => a.altId) : attribute.appliesTo
  return list.includes(altId) ? list.filter((id) => id !== altId) : [...list, altId]
}

function describeApplies(attribute: Attribute, active: AltIdentity[]): string {
  const on = active.filter((a) => appliesTo(attribute, a.altId))
  if (on.length === active.length) return 'Applies to all alternatives'
  if (on.length === 0) return 'Applies to no alternative'
  return `Applies to ${on.map((a) => a.label).join(', ')}`
}

function AppliesCell({
  attribute,
  active,
  labeled,
  onUpdate,
}: {
  attribute: Attribute
  active: AltIdentity[]
  labeled: boolean
  onUpdate: (changes: Partial<Attribute>) => void
}) {
  if (active.length === 0) return <span className="text-13 text-ink-3">No alternatives</span>
  const name = attribute.name.trim() || 'untitled attribute'

  if (!labeled) {
    const summary = describeApplies(attribute, active)
    return (
      <div
        role="img"
        aria-label={summary}
        title={`${summary}. In an unlabeled experiment every attribute applies to all alternatives.`}
        className="flex items-center gap-0.5"
      >
        {active.map((id) => (
          <span key={id.altId} className="inline-flex size-6 items-center justify-center">
            <AltGlyph identity={id} size={13} ghost={!appliesTo(attribute, id.altId)} />
          </span>
        ))}
      </div>
    )
  }

  return (
    <div role="group" aria-label={`Applies to, ${name}`} className="flex items-center gap-0.5">
      {active.map((id) => {
        const on = appliesTo(attribute, id.altId)
        return (
          <button
            key={id.altId}
            type="button"
            aria-pressed={on}
            aria-label={id.label}
            title={`${id.label}: ${on ? 'applies' : 'does not apply'}`}
            onClick={() => onUpdate({ appliesTo: toggleApplies(attribute, active, id.altId) })}
            className="focus-ring inline-flex size-6 items-center justify-center rounded-ctl transition-colors hover:bg-surface-3"
          >
            <AltGlyph identity={id} size={13} ghost={!on} />
          </button>
        )
      })}
    </div>
  )
}

export function AttributeRow({
  attribute,
  active,
  labeled,
  open,
  detailId,
  onToggle,
  onUpdate,
}: {
  attribute: Attribute
  active: AltIdentity[]
  labeled: boolean
  open: boolean
  detailId: string
  onToggle: () => void
  onUpdate: (changes: Partial<Attribute>) => void
}) {
  const { main, rest } = typeParts(attribute)
  const pref = prefOf(attribute)
  const name = attribute.name.trim()
  const params = paramCount(attribute)
  const ownLevels =
    attribute.type === 'numeric'
      ? active.filter(
          (a) => appliesTo(attribute, a.altId) && (attribute.levelsByAlternative?.[a.altId]?.length ?? 0) > 0,
        )
      : []

  // The whole row opens the editor for pointer users; the name button is the keyboard control.
  const onRowClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea, label')) return
    if (window.getSelection()?.toString()) return
    onToggle()
  }

  return (
    <div
      onClick={onRowClick}
      className={cx(
        'grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-well px-4 py-3 xl:min-h-16 xl:py-2',
        ATTR_GRID,
        !open && 'transition-colors hover:bg-surface-2',
      )}
    >
      <div className="min-w-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? detailId : undefined}
          onClick={onToggle}
          className="focus-ring -ml-1 flex max-w-full items-center gap-2 rounded-ctl px-1 py-0.5 text-left"
        >
          <ChevronIcon
            className={cx(
              'shrink-0 text-ink-3 transition-transform motion-reduce:transition-none',
              open && 'rotate-90',
            )}
          />
          <span
            className={cx(
              'min-w-0 break-words text-[15px] leading-5',
              name ? 'font-semibold text-ink' : 'italic text-ink-3',
            )}
          >
            {name || 'Untitled attribute'}
          </span>
        </button>
      </div>

      <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-[26px] xl:contents">
        <div className="min-w-0 text-13 text-ink-2">
          <span className="sr-only">Type: </span>
          {main}
          {rest.map((r) => (
            <span key={r} className="text-ink-3">
              {' · '}
              {r}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-13 text-ink-2">
          <PrefIcon dir={pref} className={cx('shrink-0', pref === 'none' ? 'text-ink-3' : 'text-ink')} />
          <span>
            <span className="sr-only">Preference: </span>
            {PREF_TEXT[pref]}
          </span>
        </div>
      </div>

      <div className="col-span-2 flex flex-wrap items-center gap-x-6 gap-y-2 pl-[26px] xl:contents">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-12 text-ink-3 xl:hidden">
            Applies to
          </span>
          <AppliesCell attribute={attribute} active={active} labeled={labeled} onUpdate={onUpdate} />
        </div>
        <div className="min-w-[180px] flex-1 xl:min-w-0">
          <LevelsViz attribute={attribute} levels={attribute.levels} />
          {ownLevels.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-12 text-ink-3">
              Own levels for
              {ownLevels.map((id) => (
                <AltGlyph key={id.altId} identity={id} size={10} />
              ))}
              <span className="sr-only">{ownLevels.map((id) => id.label).join(', ')}</span>
            </p>
          )}
        </div>
      </div>

      <div className={cx(PARAMS_CELL, 'tnum text-13 text-ink-2')}>
        {params}
        <span className="sr-only">{params === 1 ? ' parameter' : ' parameters'}</span>
      </div>

      <div
        title={attribute.id}
        className="col-start-2 row-start-1 min-w-0 max-w-[140px] truncate font-mono text-12 text-ink-3 xl:col-start-auto xl:row-start-auto xl:max-w-none"
      >
        <span className="sr-only">ID: </span>
        {attribute.id}
      </div>
    </div>
  )
}
