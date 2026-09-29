'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { Project, Alternative } from '@/lib/schema'
import { altIdentities, altStyle, type AltIdentity } from '@/lib/altIdentity'
import { altRoles, newAlternative, type AltRole } from '@/lib/altRoles'
import { joinNames } from '@/lib/text'
import { AltGlyph, Button, Checkbox, IconButton, Seg, cx } from '../ui'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plus, XMark } from '../Icons'
import ImageUrlInput from './ImageUrlInput'
import { HollowCircle, MoreIcon } from './structure/icons'
import { RequiredMark } from './structure/RequiredMark'

const TYPE_OPTIONS: { value: Project['experimentType']; label: string }[] = [
  { value: 'labeled', label: 'Labeled' },
  { value: 'unlabeled', label: 'Unlabeled' },
]

type PendingFocus = { kind: 'name' | 'move-prev' | 'move-next'; id: string } | { kind: 'add' }

export default function AlternativesEditor({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const headingId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const pendingFocus = useRef<PendingFocus | null>(null)

  const ids = altIdentities(project)
  const roles = altRoles(project)
  const alts = project.alternatives
  const hasOptOut = alts.some((a) => a.isOptOut)

  // Reordering moves DOM nodes, which drops focus; put it back on the control that was used.
  useEffect(() => {
    const p = pendingFocus.current
    pendingFocus.current = null
    if (!p || !rootRef.current) return
    if (p.kind === 'add') {
      addRef.current?.focus()
      return
    }
    const card = rootRef.current.querySelector<HTMLElement>(`[data-alt="${CSS.escape(p.id)}"]`)
    if (!card) return
    if (p.kind === 'name') {
      const input = card.querySelector<HTMLInputElement>('[data-role="name"]')
      input?.focus()
      input?.select()
      return
    }
    const want = card.querySelector<HTMLButtonElement>(`[data-role="${p.kind}"]`)
    const other = card.querySelector<HTMLButtonElement>(
      `[data-role="${p.kind === 'move-prev' ? 'move-next' : 'move-prev'}"]`,
    )
    ;(want && !want.disabled ? want : other)?.focus()
  })

  const stamp = (changes: Partial<Project>) =>
    setProject({ ...project, ...changes, updatedAt: new Date().toISOString() })

  const update = (id: string, changes: Partial<Alternative>) => {
    stamp({
      alternatives: alts.map((a) => (a.id === id ? { ...a, ...changes } : a)),
    })
  }

  const remove = (id: string) => {
    const idx = alts.findIndex((a) => a.id === id)
    const neighbour = alts[idx + 1] ?? alts[idx - 1]
    pendingFocus.current = neighbour ? { kind: 'name', id: neighbour.id } : { kind: 'add' }
    stamp({
      alternatives: alts.filter((a) => a.id !== id),
      builder: {
        ...project.builder,
        alternativeOrder: project.builder.alternativeOrder.filter((aid) => aid !== id),
      },
      attributes: project.attributes.map((attr) =>
        attr.appliesTo === 'all'
          ? attr
          : { ...attr, appliesTo: attr.appliesTo.filter((aid) => aid !== id) },
      ),
    })
  }

  const add = (optOut: boolean) => {
    const alt = newAlternative(project, { optOut })
    pendingFocus.current = { kind: 'name', id: alt.id }
    stamp({
      alternatives: [...alts, alt],
      builder: {
        ...project.builder,
        alternativeOrder: [...project.builder.alternativeOrder, alt.id],
      },
    })
  }

  const move = (id: string, direction: -1 | 1) => {
    const idx = alts.findIndex((a) => a.id === id)
    const target = idx + direction
    if (idx < 0 || target < 0 || target >= alts.length) return
    const reordered = [...alts]
    ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
    const withPositions = reordered.map((a, i) => ({ ...a, position: i }))
    const orderIds = withPositions.map((a) => a.id)
    pendingFocus.current = { kind: direction < 0 ? 'move-prev' : 'move-next', id }
    stamp({
      alternatives: withPositions,
      builder: { ...project.builder, alternativeOrder: orderIds },
    })
  }

  return (
    <div ref={rootRef} role="group" aria-labelledby={headingId} className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <h3 id={headingId} className="text-16 font-semibold tracking-[-0.005em] text-ink">
          Alternatives
        </h3>
        <span className="tnum text-16 font-medium text-ink-3">{alts.length}</span>
        <div className="ml-auto flex items-center gap-2">
          <span aria-hidden="true" className="text-12 font-medium text-ink-2">
            Experiment type
            <RequiredMark />
          </span>
          <Seg
            size="sm"
            ariaLabel="Experiment type"
            options={TYPE_OPTIONS}
            value={project.experimentType}
            onChange={(v) => stamp({ experimentType: v })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] sm:items-start">
          {alts.map((a, i) => (
            <AltToken
              key={a.id}
              alt={a}
              identity={ids[i]}
              role={roles.get(a.id) ?? null}
              index={i}
              prev={i > 0 ? ids[i - 1] : undefined}
              next={i < alts.length - 1 ? ids[i + 1] : undefined}
              canRemove={alts.length > 2}
              onUpdate={(changes) => update(a.id, changes)}
              onMove={(dir) => move(a.id, dir)}
              onRemove={() => remove(a.id)}
            />
          ))}
        </div>
        <div className="flex shrink-0 flex-col justify-center gap-1.5 sm:w-[150px]">
          <Button
            ref={addRef}
            variant="ghost"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => add(false)}
            className="!justify-start border-dashed !border-line-2 enabled:hover:!border-ink-4"
          >
            Add alternative
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<HollowCircle />}
            onClick={() => add(true)}
            disabled={hasOptOut}
            title={hasOptOut ? 'The choice set already has an opt-out alternative' : undefined}
            className="!justify-start border-dashed !border-line-2 enabled:hover:!border-ink-4"
          >
            Add opt-out
          </Button>
        </div>
      </div>

      <Caption project={project} identities={ids} roles={roles} />
    </div>
  )
}

function Caption({
  project,
  identities,
  roles,
}: {
  project: Project
  identities: AltIdentity[]
  roles: Map<string, AltRole>
}) {
  const withRole = (r: AltRole) => identities.filter((id) => roles.get(id.altId) === r)
  const asc = withRole('ASC').map((id) => id.label)
  const ref = withRole('reference')[0]
  const optOuts = withRole('opt-out')

  return (
    <p className="mt-3 max-w-[90ch] text-13 text-ink-3">
      {project.experimentType === 'labeled' ? (
        <>
          <b className="font-semibold text-ink-2">Labeled:</b>{' '}
          {asc.length > 0 && ref
            ? `alternative-specific constants are estimated for ${joinNames(asc)}; ${ref.label} is the reference alternative.`
            : 'alternative-specific constants are estimated for every alternative but the last, which is the reference; add another alternative to estimate one.'}
        </>
      ) : (
        <>
          <b className="font-semibold text-ink-2">Unlabeled (generic):</b> no
          alternative-specific constants are estimated; the alternatives differ only in their
          attribute levels.
        </>
      )}{' '}
      {optOuts.length > 0
        ? `${joinNames(optOuts.map((id) => id.label))} ${optOuts.length === 1 ? 'is an opt-out: it has' : 'are opt-outs: they have'} no attribute levels and ${optOuts.length === 1 ? 'is' : 'are'} left out of the D-error.`
        : 'To make a “neither” or status quo alternative an opt-out, tick Opt-out under its More settings (⋯) or use Add opt-out.'}{' '}
      The order here is the column order in choice tasks and exports.
    </p>
  )
}

function AltToken({
  alt,
  identity,
  role,
  index,
  prev,
  next,
  canRemove,
  onUpdate,
  onMove,
  onRemove,
}: {
  alt: Alternative
  identity: AltIdentity
  role: AltRole
  index: number
  prev?: AltIdentity
  next?: AltIdentity
  canRemove: boolean
  onUpdate: (changes: Partial<Alternative>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const [more, setMore] = useState(false)
  const moreId = useId()
  const name = identity.label
  const hasImage = !!alt.imageUrl && alt.imageUrl.trim() !== ''
  const small = '!size-6 [&_svg]:!size-3.5'
  return (
    <div
      role="group"
      aria-label={name}
      data-alt={alt.id}
      style={altStyle(identity)}
      className="relative min-w-0 overflow-hidden rounded-card bg-surface shadow-hairline"
    >
      <span aria-hidden="true" className="bg-alt absolute inset-x-0 top-0 h-[3px]" />

      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_1.5rem] items-center gap-x-2 pb-2 pl-1.5 pr-1.5 pt-2.5">
        <div className="row-span-2 flex flex-col">
          <IconButton
            size="sm"
            data-role="move-prev"
            label={prev ? `Move ${name} before ${prev.label}` : `Move ${name} earlier`}
            disabled={!prev}
            onClick={() => onMove(-1)}
            className={small}
          >
            <ChevronLeft className="hidden sm:block" />
            <ChevronUp className="sm:hidden" />
          </IconButton>
          <IconButton
            size="sm"
            data-role="move-next"
            label={next ? `Move ${name} after ${next.label}` : `Move ${name} later`}
            disabled={!next}
            onClick={() => onMove(1)}
            className={small}
          >
            <ChevronRight className="hidden sm:block" />
            <ChevronDown className="sm:hidden" />
          </IconButton>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <AltGlyph identity={identity} size={13} />
          <input
            type="text"
            data-role="name"
            value={alt.label}
            placeholder="Name, e.g. Car"
            aria-label={`Name of alternative ${index + 1}`}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="focus-ring h-7 min-w-0 flex-1 rounded-tick border border-transparent bg-transparent px-1 text-[15px] font-semibold leading-5 text-ink placeholder:font-normal placeholder:text-ink-3 hover:border-line-2 focus-visible:border-line-2"
          />
        </div>

        <div className="row-span-2 flex flex-col">
          <IconButton
            size="sm"
            label={`Remove ${name}`}
            title={canRemove ? `Remove ${name}` : 'At least 2 alternatives are required'}
            disabled={!canRemove}
            onClick={onRemove}
            className={cx(small, '!text-ink-3 enabled:hover:!text-risk')}
          >
            <XMark />
          </IconButton>
          <IconButton
            size="sm"
            label={`More settings for ${name}`}
            aria-expanded={more}
            aria-controls={more ? moreId : undefined}
            onClick={() => setMore((m) => !m)}
            className={cx(small, more ? '!bg-surface-3 !text-ink' : '!text-ink-3 enabled:hover:!text-ink')}
          >
            <MoreIcon />
          </IconButton>
        </div>

        <p className="flex min-w-0 items-baseline gap-2 text-12 leading-4 text-ink-3">
          <span
            className="min-w-0 truncate"
            title={[alt.id, role, hasImage && 'image'].filter(Boolean).join(' · ')}
          >
            <code className="font-mono">{alt.id}</code>
            {role && <> · {role}</>}
            {hasImage && <> · image</>}
          </span>
          <span className="tnum ml-auto shrink-0 font-mono" title={`Position ${index + 1}`}>
            {index + 1}
          </span>
        </p>
      </div>

      {more && (
        <div
          id={moreId}
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line px-2.5 py-2"
        >
          <Checkbox
            checked={alt.isOptOut}
            onChange={(checked) => onUpdate({ isOptOut: checked })}
            label="Opt-out"
          />
          <ImageUrlInput
            name={name}
            size={28}
            value={alt.imageUrl}
            onChange={(v) => onUpdate({ imageUrl: v })}
            className="basis-full"
          />
        </div>
      )}
    </div>
  )
}
