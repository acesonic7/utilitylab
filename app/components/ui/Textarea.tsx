import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { controlBase } from './Input'
import { cx } from './cx'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { mono, className, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx(controlBase, 'block resize-y px-2.5 py-2 text-13', mono && 'font-mono', className)}
      {...rest}
    />
  )
})
