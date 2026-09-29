import type { ReactNode } from 'react'
import { cx } from './cx'

export type EmptyStateProps = {
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'rounded-panel border border-dashed border-line-2 bg-surface-2 px-6 py-10 text-center',
        className,
      )}
    >
      <p className="text-16 font-semibold text-ink">{title}</p>
      {body != null && <div className="mx-auto mt-1.5 max-w-[56ch] text-13 text-ink-3">{body}</div>}
      {action != null && <div className="mt-4 flex justify-center gap-2">{action}</div>}
    </div>
  )
}
