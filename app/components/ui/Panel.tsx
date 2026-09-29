'use client'

import { useId, type ReactNode } from 'react'
import { cx } from './cx'

export type PanelProps = {
  title?: ReactNode
  count?: ReactNode
  actions?: ReactNode
  flush?: boolean
  className?: string
  children?: ReactNode
}

export function Panel({ title, count, actions, flush, className, children }: PanelProps) {
  const titleId = useId()
  const hasHeader = title != null || actions != null
  return (
    // A group, not a region, so a page of panels doesn't flood the landmark list.
    <div
      role="group"
      aria-labelledby={title != null ? titleId : undefined}
      className={cx('rounded-panel bg-surface shadow-hairline', className)}
    >
      {hasHeader && (
        <header className={cx('flex items-baseline gap-2.5 px-5 pt-4', flush && 'pb-3')}>
          {title != null && (
            <h3 id={titleId} className="text-16 font-semibold tracking-[-0.005em] text-ink">
              {title}
            </h3>
          )}
          {count != null && <span className="tnum text-16 font-medium text-ink-3">{count}</span>}
          {actions != null && (
            <div className="ml-auto flex items-center gap-2 self-center text-13 text-ink-3">
              {actions}
            </div>
          )}
        </header>
      )}
      <div className={flush ? undefined : 'px-5 pb-5 pt-4'}>{children}</div>
    </div>
  )
}
