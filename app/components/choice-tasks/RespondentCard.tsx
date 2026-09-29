'use client'

import { Fragment, useId, type CSSProperties } from 'react'
import type { Alternative, Attribute, Project } from '@/lib/schema'
import { altIdentity, altStyle } from '@/lib/altIdentity'
import { AltGlyph, cx } from '../ui'
import { CheckIcon } from './icons'
import {
  QUESTION_STEM,
  cellFor,
  choiceColumnLabel,
  contextEntries,
  type Cell,
  type TaskEntry,
} from './model'

const ROW_MIN = 'sm:min-h-[62px]'

export function RespondentCard({
  project,
  entry,
  alternatives,
  attributes,
  identityMarks,
  onIdentityMarks,
  chosen,
  onChoose,
  radioName,
}: {
  project: Project
  entry: TaskEntry
  alternatives: Alternative[]
  attributes: Attribute[]
  identityMarks: boolean
  onIdentityMarks: (on: boolean) => void
  chosen: string | undefined
  onChoose: (altId: string) => void
  radioName: string
}) {
  const stemId = useId()
  const { row } = entry
  const context = contextEntries(project, row)
  const choiceLabel = choiceColumnLabel(project)
  const chosenAlt = alternatives.find((a) => a.id === chosen)
  const J = alternatives.length

  return (
    <article
      aria-label={`Choice task ${row.taskId}, respondent view`}
      className="rounded-hero bg-surface px-4 pb-5 pt-5 shadow-raised sm:px-[30px] sm:pb-6 sm:pt-[26px]"
    >
      <div className="flex items-center justify-between gap-3 text-13 text-ink-3">
        <span>
          Block {row.block} · choice task {entry.inBlock} of {entry.blockSize} for this respondent
        </span>
        <span aria-hidden="true" className="flex shrink-0 gap-[5px]">
          {Array.from({ length: Math.min(entry.blockSize, 24) }, (_, i) => (
            <span
              key={i}
              className={cx(
                'h-1 rounded-[2px]',
                entry.blockSize > 12 ? 'w-2' : 'w-[18px]',
                i < entry.inBlock ? 'bg-ink' : 'bg-line-2',
              )}
            />
          ))}
        </span>
      </div>

      {context.length > 0 && (
        <div className="mt-[18px] flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-card bg-surface-2 px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgb(var(--line))]">
          <span className="border-r border-line-2 pr-2.5 text-12 font-medium text-ink-3">Context variables</span>
          {context.map((c, i) => (
            <Fragment key={c.id}>
              {i > 0 && <span aria-hidden="true" className="size-[3px] rounded-full bg-ink-4" />}
              <span className="text-14 text-ink-3">
                {c.name}: <b className="font-semibold text-ink">{c.text}</b>
              </span>
            </Fragment>
          ))}
        </div>
      )}

      <h3
        id={stemId}
        className="my-5 font-display text-20 font-semibold tracking-[-0.018em] text-ink [font-variation-settings:'opsz'_28] sm:text-[23px] sm:leading-[30px]"
      >
        {QUESTION_STEM}
      </h3>

      <div role="group" aria-labelledby={stemId} className="relative -mx-1.5 overflow-x-auto px-1.5 pb-2 pt-0.5">
        <div
          className="grid gap-3 sm:[grid-template-columns:112px_repeat(var(--j),minmax(96px,1fr))] sm:[grid-template-rows:repeat(var(--rows),auto)] sm:gap-2.5"
          style={{ '--j': J, '--rows': attributes.length + 2 } as CSSProperties}
        >
          <div aria-hidden="true" className="hidden sm:row-span-full sm:grid sm:grid-rows-subgrid">
            <div />
            {attributes.map((attr) => (
              <div
                key={attr.id}
                className={cx('flex items-center gap-1.5 border-t border-line py-2 pr-2 text-13 font-medium text-ink-2', ROW_MIN)}
              >
                {attr.imageUrl && <img src={attr.imageUrl} alt="" className="size-5 shrink-0 object-contain" />}
                <span>
                  {attr.name}
                  {project.builder.showUnits && attr.unit && (
                    <span className="ml-1 text-12 font-normal text-ink-3">({attr.unit})</span>
                  )}
                </span>
              </div>
            ))}
            <div className="flex items-center text-12 font-medium text-ink-3">{choiceLabel}</div>
          </div>

          {alternatives.map((alt) => (
            <AlternativeColumn
              key={alt.id}
              project={project}
              alt={alt}
              attributes={attributes}
              row={entry.row}
              marks={identityMarks}
              chosen={chosen === alt.id}
              onChoose={onChoose}
              radioName={radioName}
              choiceLabel={choiceLabel}
            />
          ))}
        </div>
      </div>

      <div className="mt-[18px] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3.5 text-13 text-ink-3">
        <span>
          {chosenAlt ? (
            <>
              Preview: the respondent picked{' '}
              <b className="font-semibold text-ink">{altIdentity(project, chosenAlt.id).label}</b>
            </>
          ) : (
            'Preview: no alternative chosen yet'
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          <span>
            Layout <b className="font-medium text-ink-2">attributes as rows</b>
          </span>
          <span>
            Units <b className="font-medium text-ink-2">{project.builder.showUnits ? 'shown' : 'hidden'}</b>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={identityMarks}
            onClick={() => onIdentityMarks(!identityMarks)}
            title="Identity colors and glyphs on this preview. Exports are always neutral."
            className="focus-ring inline-flex h-6 items-center gap-1.5 rounded-pill border border-line-2 bg-surface px-2 text-13 text-ink-3 transition-colors hover:border-ink-4 hover:text-ink-2"
          >
            Identity marks
            <b aria-hidden="true" className="font-medium text-ink-2">
              {identityMarks ? 'on' : 'off'}
            </b>
          </button>
        </span>
      </div>
    </article>
  )
}

function AlternativeColumn({
  project,
  alt,
  attributes,
  row,
  marks,
  chosen,
  onChoose,
  radioName,
  choiceLabel,
}: {
  project: Project
  alt: Alternative
  attributes: Attribute[]
  row: TaskEntry['row']
  marks: boolean
  chosen: boolean
  onChoose: (altId: string) => void
  radioName: string
  choiceLabel: string
}) {
  const nameId = useId()
  const id = altIdentity(project, alt.id)
  const label = alt.label.trim() ? alt.label : id.label
  const coloured = marks && !alt.isOptOut

  return (
    <div
      role="group"
      aria-labelledby={nameId}
      style={marks ? altStyle(id) : undefined}
      className={cx(
        'relative flex flex-col overflow-hidden rounded-panel bg-surface sm:row-span-full sm:grid sm:grid-rows-subgrid',
        chosen
          ? marks
            ? 'shadow-[0_0_0_2px_rgb(var(--alt)),0_10px_24px_-14px_rgb(var(--alt)/0.7)]'
            : 'shadow-[0_0_0_2px_rgb(var(--ink))]'
          : 'shadow-hairline',
      )}
    >
      {coloured && <span aria-hidden="true" className="bg-alt absolute inset-x-0 top-0 h-1" />}
      <div
        className={cx(
          'flex flex-col items-center justify-center gap-[7px] px-2 pb-2.5 pt-3.5 text-center sm:min-h-[74px]',
          chosen && (marks ? 'bg-alt-tint-8' : 'bg-surface-2'),
        )}
      >
        {alt.imageUrl && <img src={alt.imageUrl} alt="" className="max-h-12 object-contain" />}
        {marks && <AltGlyph identity={id} size={15} />}
        <span
          id={nameId}
          className="font-display text-[15px] font-semibold leading-[18px] tracking-[-0.01em] text-ink [font-variation-settings:'opsz'_16]"
        >
          {label}
        </span>
        {alt.isOptOut && <span className="text-12 text-ink-3">Opt-out</span>}
      </div>

      {attributes.map((attr) => (
        <AttributeCell
          key={attr.id}
          attr={attr}
          cell={cellFor(attr, alt, row)}
          showUnit={project.builder.showUnits}
        />
      ))}

      <div className="flex items-center gap-3 border-t border-line px-3 py-3 sm:min-h-[66px] sm:justify-center sm:px-2">
        <span aria-hidden="true" className="mr-auto text-13 font-medium text-ink-2 sm:hidden">
          {choiceLabel}
        </span>
        <label className="relative w-40 shrink-0 cursor-pointer sm:w-full">
          <input
            type="radio"
            name={radioName}
            value={alt.id}
            checked={chosen}
            onChange={() => onChoose(alt.id)}
            aria-label={label}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={cx(
              'flex h-9 w-full items-center justify-center gap-2 rounded-well border text-13 font-semibold transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink',
              chosen
                ? marks
                  ? 'border-transparent bg-[color-mix(in_oklab,rgb(var(--alt))_72%,rgb(var(--ink)))] text-paper'
                  : 'border-transparent bg-ink text-paper'
                : 'border-line-2 bg-surface text-ink hover:border-ink-4',
            )}
          >
            {chosen ? (
              <CheckIcon className="size-3.5" />
            ) : (
              <span className="size-3.5 rounded-full shadow-[inset_0_0_0_1.5px_rgb(var(--ink-3))]" />
            )}
            {chosen ? 'Chosen' : 'Choose'}
          </span>
        </label>
      </div>
    </div>
  )
}

function AttributeCell({ attr, cell, showUnit }: { attr: Attribute; cell: Cell; showUnit: boolean }) {
  // Below sm the columns stack, so each cell carries its own attribute name.
  const name = (
    <span className="mr-auto inline-flex items-center gap-1.5 pr-3 text-left text-13 font-medium text-ink-2 sm:sr-only">
      {attr.imageUrl && <img src={attr.imageUrl} alt="" className="size-4 shrink-0 object-contain" />}
      {attr.name}
      {showUnit && attr.unit && <span className="ml-1 text-12 font-normal text-ink-3">({attr.unit})</span>}
    </span>
  )
  const base = cx(
    'flex items-center border-t border-line px-3 py-2.5 sm:flex-col sm:justify-center sm:px-2 sm:text-center',
    ROW_MIN,
  )

  if (cell.kind === 'na' || cell.kind === 'optout' || cell.kind === 'missing') {
    return (
      <div className={cx(base, cell.kind === 'na' ? 'hatch' : 'bg-surface-2', 'text-ink-3')}>
        {name}
        <span aria-hidden="true" className="rounded-tick bg-surface px-1.5 py-0.5 text-14 leading-none">
          —
        </span>
        <span className="sr-only">{cell.kind === 'missing' ? 'No level set' : 'Not applicable'}</span>
      </div>
    )
  }

  return (
    <div className={base}>
      {name}
      <span className="flex flex-col items-end sm:items-center">
        {cell.level.imageUrl && (
          <img src={cell.level.imageUrl} alt="" className="mb-1 max-h-10 object-contain" />
        )}
        {cell.figure ? (
          <span className="tnum whitespace-nowrap font-display text-20 font-medium tracking-[-0.02em] text-ink [font-variation-settings:'opsz'_28] sm:text-[25px] sm:leading-7">
            {cell.figure.num}
            {cell.figure.unit && (
              <small className="ml-[3px] font-sans text-13 font-normal tracking-normal text-ink-3">
                {cell.figure.unit}
              </small>
            )}
          </span>
        ) : (
          <span className="text-16 font-medium text-ink">{cell.word}</span>
        )}
        {cell.delta && (
          <span className="mt-1 rounded-tick bg-surface-3 px-1.5 py-[3px] font-mono text-12 font-normal leading-none text-ink-2">
            {cell.delta}
          </span>
        )}
        {cell.meter && (
          <span aria-hidden="true" className="mt-1.5 flex gap-[3px]">
            {Array.from({ length: cell.meter.steps }, (_, i) => (
              <span
                key={i}
                className={cx('h-1 w-3.5 rounded-[2px]', i < cell.meter!.filled ? 'bg-ink-2' : 'bg-line-2')}
              />
            ))}
          </span>
        )}
      </span>
    </div>
  )
}
