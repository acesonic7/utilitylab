'use client'

import { useRef, type HTMLAttributes } from 'react'
import { cx } from './cx'
import { useOverflowX } from './useOverflowX'

/**
 * A sideways scroller for wide tables. Only while its content is wider than the box does it become
 * a named, focusable region, so keyboard users can scroll it and there is no extra tab stop otherwise.
 */
export function ScrollX({
  label,
  className,
  children,
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'tabIndex' | 'aria-label'> & {
  /** Names the region, e.g. "Analyst lens table, scrolls sideways". */
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scrolls = useOverflowX(ref)
  return (
    <div
      ref={ref}
      role={scrolls ? 'region' : undefined}
      aria-label={scrolls ? label : undefined}
      tabIndex={scrolls ? 0 : undefined}
      className={cx('focus-ring overflow-x-auto', className)}
      {...rest}
    >
      {children}
    </div>
  )
}
