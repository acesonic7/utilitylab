'use client'

import type { MouseEvent, ReactNode } from 'react'
import { useWorkspaceActions, type SectionId, type TaskRef } from '../Workspace'
import { onSectionLinkClick } from '../shell/sections'
import { cx } from '../ui'

type SvgProps = { className?: string }

export function ArrowIcon({ className }: SvgProps) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
      className={cx('size-3 shrink-0 fill-none stroke-current', className)}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 6h7M6.5 3l3 3-3 3" />
    </svg>
  )
}

export function ChevronIcon({ className }: SvgProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      className={cx('size-3.5 shrink-0 fill-none stroke-current', className)}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </svg>
  )
}

export function InfoIcon({ className }: SvgProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      className={cx('size-[18px] shrink-0 fill-none stroke-current', className)}
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="10" cy="10" r="8" />
      <path d="M10 9v5M10 6.2v.1" />
    </svg>
  )
}

export function CheckCircleIcon({ className }: SvgProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      className={cx('size-5 shrink-0 fill-none stroke-current', className)}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="8" />
      <path d="m6.5 10.2 2.4 2.4 4.6-5.2" />
    </svg>
  )
}

// 24px hit area (WCAG 2.5.8) that still takes up only the 13px text line in the layout.
export const linkClass =
  'focus-ring -mx-1 -my-[5.5px] inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-ctl px-1 text-13 font-medium leading-none text-ink-2 transition-colors hover:text-ink'

/** An in-page link to another section; plain clicks go through goTo so focus lands on its heading. */
export function SectionLink({
  section,
  task,
  className,
  title,
  children,
}: {
  section: SectionId
  task?: TaskRef
  className?: string
  title?: string
  children: ReactNode
}) {
  const { goTo } = useWorkspaceActions()
  return (
    <a
      href={`#${section}`}
      title={title}
      className={className ?? linkClass}
      onClick={(e) => onSectionLinkClick(e, () => goTo(section, task ? { task } : undefined))}
    >
      {children}
    </a>
  )
}

export const FIGURE_IDS = {
  map: 'diagnostics-choice-task-map',
  correlation: 'diagnostics-correlation',
  balance: 'diagnostics-level-balance',
} as const

// Figures are wrapped in a focusable anchor target so keyboard users land on the figure they asked for.
export const figureTargetClass = 'scroll-mt-[120px] focus:outline-none lg:scroll-mt-20'

function focusFigure(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  el.focus({ preventScroll: true })
}

export function FigureLink({ figure, children }: { figure: string; children: ReactNode }) {
  return (
    <a
      href={`#${figure}`}
      className={linkClass}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => onSectionLinkClick(e, () => focusFigure(figure))}
    >
      {children}
    </a>
  )
}
