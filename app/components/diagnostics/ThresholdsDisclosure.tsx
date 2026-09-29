'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { Project } from '@/lib/schema'
import { resolveValidationConfig } from '@/lib/validation'
import { Button, Tag } from '../ui'

const Mono = ({ children }: { children: ReactNode }) => <span className="font-mono text-12">{children}</span>

function Row({ term, on, value, note }: { term: string; on: boolean; value: ReactNode; note: string }) {
  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <dt className="flex items-center gap-2 text-13 font-semibold text-ink">
        {term}
        {!on && <Tag tone="muted">Off</Tag>}
      </dt>
      {on && <dd className="mt-0.5 text-13 text-ink">{value}</dd>}
      <dd className="mt-0.5 text-12 text-ink-3">{note}</dd>
    </div>
  )
}

/** Read-only: validation thresholds live in the project file and have no editor. */
export function ThresholdsDisclosure({ project }: { project: Project }) {
  const cfg = resolveValidationConfig(project)
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const titleId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const constraints = project.constraints ?? []
  const enabledConstraints = constraints.filter((c) => c.enabled).length

  return (
    <div
      ref={wrapRef}
      className="relative"
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <Button
        ref={buttonRef}
        size="sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        Thresholds…
      </Button>
      <div
        id={panelId}
        role="group"
        aria-labelledby={titleId}
        hidden={!open}
        // Focusable, so a click inside keeps focus within the disclosure and it stays open.
        tabIndex={-1}
        className="absolute right-0 top-[calc(100%+8px)] z-30 w-[min(340px,calc(100vw-32px))] rounded-card bg-surface p-4 text-left shadow-raised focus:outline-none"
      >
        <p id={titleId} className="text-14 font-semibold text-ink">
          Thresholds
        </p>
        <p className="mt-0.5 text-12 text-ink-3">
          {project.validationConfig
            ? 'Set in this project file.'
            : 'Defaults. This project file does not set its own.'}
        </p>
        <dl className="mt-3 divide-y divide-line border-t border-line pt-3">
          <Row
            term="Dominance"
            on={cfg.dominance.enabled}
            value="Compared on common attributes"
            note="Flags an alternative that is no better on any common attribute with a preference direction, and worse on at least one."
          />
          <Row
            term="Overlap"
            on={cfg.overlap.enabled}
            value="Identical on every common attribute"
            note="Flags two alternatives that show the same levels in a choice task."
          />
          <Row
            term="Correlation"
            on={cfg.correlation.enabled}
            value={
              <>
                <Mono>|r| &gt; {cfg.correlation.warnThreshold}</Mono> warning ·{' '}
                <Mono>|r| &gt; {cfg.correlation.concernThreshold}</Mono> concern
              </>
            }
            note="Pearson r between attribute pairs within each alternative, across choice tasks."
          />
          <Row
            term="Level balance"
            on={cfg.balance.enabled}
            value={
              <>
                <Mono>±{cfg.balance.maxDeviationPct}%</Mono> of the ideal count
              </>
            }
            note="Per attribute (per alternative where level sets differ) and per context variable."
          />
          <Row
            term="Constraints"
            on
            value={
              constraints.length === 0
                ? 'None defined'
                : `${enabledConstraints} of ${constraints.length} enabled`
            }
            note="Forbidden combinations, edited in 01 Structure."
          />
        </dl>
      </div>
    </div>
  )
}
