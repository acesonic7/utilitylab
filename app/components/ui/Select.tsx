import { forwardRef, type SelectHTMLAttributes } from 'react'
import { controlBase, controlSizes, type ControlSize } from './Input'
import { cx } from './cx'

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  size?: ControlSize
}

// className sizes the wrapper; the native select fills it.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <span className={cx('relative inline-flex w-full min-w-0', className)}>
      <select
        ref={ref}
        className={cx(controlBase, controlSizes[size], 'cursor-pointer appearance-none pr-8')}
        {...rest}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 fill-none stroke-ink-3"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3.5 6 8 10.5 12.5 6" />
      </svg>
    </span>
  )
})
