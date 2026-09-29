import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { buttonBase, buttonVariants, type ButtonSize, type ButtonVariant } from './Button'
import { cx } from './cx'

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string
  size?: ButtonSize
  variant?: ButtonVariant
  children: ReactNode
}

const sizes: Record<ButtonSize, string> = {
  sm: 'size-7 [&_svg]:size-3.5',
  md: 'size-8 [&_svg]:size-4',
  lg: 'size-9 [&_svg]:size-4',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', variant = 'ghost', className, type = 'button', title, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cx(buttonBase, buttonVariants[variant], sizes[size], 'p-0', className)}
      {...rest}
    >
      {children}
    </button>
  )
})
