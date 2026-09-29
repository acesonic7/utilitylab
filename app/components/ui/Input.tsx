import { forwardRef, type InputHTMLAttributes } from 'react'
import { cx } from './cx'

export type ControlSize = 'sm' | 'md' | 'lg'

export const controlBase =
  'focus-ring w-full rounded-ctl border border-line-2 bg-surface text-ink placeholder:text-ink-3 transition-colors enabled:hover:border-ink-4 focus-visible:outline-offset-[-1px] aria-[invalid=true]:border-risk disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3'

export const controlSizes: Record<ControlSize, string> = {
  sm: 'h-7 px-2 text-13',
  md: 'h-8 px-2.5 text-13',
  lg: 'h-9 px-3 text-14',
}

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: ControlSize
  mono?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', mono, className, type = 'text', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cx(controlBase, controlSizes[size], mono && 'font-mono', className)}
      {...rest}
    />
  )
})
