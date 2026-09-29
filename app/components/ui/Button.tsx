import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  kbd?: string
}

export const buttonBase =
  'focus-ring inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-ctl border font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0'

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'border-accent-edge bg-accent font-semibold text-accent-ink enabled:hover:brightness-95',
  secondary: 'border-line-2 bg-surface text-ink enabled:hover:border-ink-4',
  ghost:
    'border-transparent bg-transparent text-ink-2 enabled:hover:bg-surface-3 enabled:hover:text-ink',
  danger:
    'border-line-2 bg-surface text-risk enabled:hover:border-risk enabled:hover:bg-risk-bg',
}

export const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 px-2.5 text-13',
  md: 'h-8 gap-2 px-3 text-13',
  lg: 'h-9 gap-2 px-3.5 text-14',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, kbd, className, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...rest}
    >
      {icon && (
        <span className="inline-flex [&>svg]:size-3.5" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
      {kbd && (
        // Hidden from the name; callers announce the shortcut with aria-keyshortcuts.
        <kbd
          aria-hidden="true"
          className={cx(
            'rounded-tick px-[5px] py-[3px] font-mono text-12 font-normal leading-none',
            variant === 'primary' ? 'bg-accent-ink/10 text-accent-ink' : 'bg-surface-3 text-ink-2',
          )}
        >
          {kbd}
        </kbd>
      )}
    </button>
  )
})
