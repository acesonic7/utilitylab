'use client'

import { useId, type ReactNode } from 'react'
import { cx } from './cx'

export type FieldProps = {
  label: ReactNode
  hint?: ReactNode
  optional?: boolean
  error?: ReactNode
  className?: string
  children: (id: string, describedBy?: string) => ReactNode
}

export function Field({ label, hint, optional, error, className, children }: FieldProps) {
  const id = useId()
  const hintId = hint != null ? `${id}-hint` : undefined
  const errorId = error != null ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-12 font-medium text-ink-2">
        {label}
        {optional && <span className="font-normal text-ink-3"> (optional)</span>}
      </label>
      {children(id, describedBy)}
      {error != null && (
        <p id={errorId} className="text-12 font-medium text-risk">
          {error}
        </p>
      )}
      {hint != null && (
        <p id={hintId} className="text-12 text-ink-3">
          {hint}
        </p>
      )}
    </div>
  )
}
