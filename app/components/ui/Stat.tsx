import type { ReactNode } from 'react'
import { cx } from './cx'

export type StatProps = {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  hint?: ReactNode
  /** md: header figures (30px). lg: diagnostics tiles (34px). */
  size?: 'md' | 'lg'
  children?: ReactNode
  className?: string
}

const VALUE = {
  md: "text-30 tracking-stat [font-variation-settings:'opsz'_36]",
  lg: "text-34 tracking-[-0.025em] [font-variation-settings:'opsz'_40]",
}

export function Stat({ label, value, unit, hint, size = 'md', children, className }: StatProps) {
  return (
    <div className={cx('min-w-0', className)}>
      <div className={cx('tnum font-display font-medium text-ink', VALUE[size])}>
        {value}
        {unit != null && (
          <span className="ml-1 font-sans text-13 font-normal tracking-normal text-ink-3 [font-variation-settings:normal]">
            {unit}
          </span>
        )}
      </div>
      <div className="mt-1 whitespace-nowrap text-13 text-ink-3">{label}</div>
      {children}
      {hint != null && <div className="mt-2 text-12 text-ink-3">{hint}</div>}
    </div>
  )
}
