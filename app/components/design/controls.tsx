'use client'

import type { ReactNode } from 'react'
import { ChevronRight } from '../Icons'
import { buttonBase, buttonSizes, cx, type ButtonSize } from '../ui'

// Solid ink commit button for in-panel actions; citron stays reserved for Export.
export function inkButtonClass(size: ButtonSize = 'md') {
  return cx(
    buttonBase,
    buttonSizes[size],
    'border-ink bg-ink font-semibold text-paper enabled:hover:border-ink-2 enabled:hover:bg-ink-2',
  )
}

export function Disclosure({
  id,
  label,
  summary,
  open,
  onToggle,
  children,
}: {
  id: string
  label: ReactNode
  summary?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-card bg-surface-2 shadow-hairline">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="focus-ring flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-card px-3.5 py-2.5 text-left transition-colors hover:bg-surface-3"
      >
        <span className="inline-flex items-center gap-1.5 text-13 font-medium text-ink">
          <ChevronRight
            size={14}
            className={cx('shrink-0 text-ink-3 transition-transform motion-reduce:transition-none', open && 'rotate-90')}
          />
          {label}
        </span>
        {summary != null && <span className="ml-auto text-12 text-ink-3">{summary}</span>}
      </button>
      <div id={id} hidden={!open}>
        <div className="border-t border-line px-3.5 pb-3.5 pt-3">{children}</div>
      </div>
    </div>
  )
}
