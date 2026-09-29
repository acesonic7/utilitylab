'use client'

import { useId, type ReactNode } from 'react'
import { Tag } from '../ui'

export function PlatformCard({
  name,
  tag,
  description,
  howTo,
  error,
  children,
}: {
  name: string
  /** Short muted tag at the top right, e.g. "2 formats" or "Beta". */
  tag?: string
  description: ReactNode
  howTo?: ReactNode
  error?: string | null
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-2.5 rounded-panel bg-surface p-4 shadow-hairline"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <h3 id={titleId} className="text-14 font-semibold text-ink">
          {name}
        </h3>
        {tag && <Tag tone="muted">{tag}</Tag>}
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <p className="text-13 leading-[18px] text-ink-3">{description}</p>
        {howTo != null && <p className="text-12 leading-[17px] text-ink-3">{howTo}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {error && (
        <p role="alert" className="text-12 font-medium text-risk">
          {error}
        </p>
      )}
    </div>
  )
}

export function Path({ children }: { children: ReactNode }) {
  return <span className="font-medium text-ink-2">{children}</span>
}
