import type { HTMLAttributes } from 'react'
import { cx } from './cx'

export function Kbd({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cx(
        'inline-flex items-center rounded-tick bg-surface-3 px-[5px] py-[3px] font-mono text-12 font-normal leading-none text-ink-2',
        className,
      )}
      {...rest}
    />
  )
}
