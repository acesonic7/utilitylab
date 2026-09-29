import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
}

// The whole control is one button so the label is its accessible name.
export function Switch({ checked, onChange, label, className, type = 'button', ...rest }: SwitchProps) {
  return (
    <button
      {...rest}
      type={type}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        'focus-ring inline-flex items-center gap-2 rounded-ctl text-13 text-ink-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'relative inline-block h-[18px] w-[30px] shrink-0 rounded-pill transition-colors',
          checked ? 'bg-accent shadow-[inset_0_0_0_1px_rgb(var(--accent-edge))]' : 'bg-surface-3 shadow-[inset_0_0_0_1px_rgb(var(--line-2))]',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 size-3.5 rounded-full transition-[left] motion-reduce:transition-none',
            checked ? 'left-[14px] bg-accent-ink' : 'left-0.5 bg-ink-3',
          )}
        />
      </span>
      {label != null && <span>{label}</span>}
    </button>
  )
}
