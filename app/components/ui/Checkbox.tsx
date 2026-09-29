import type { InputHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange'> & {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
}

export function Checkbox({ checked, onChange, label, className, disabled, ...rest }: CheckboxProps) {
  return (
    <label
      className={cx(
        'inline-flex items-center gap-2 text-13 text-ink-2',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="focus-ring peer size-4 cursor-[inherit] appearance-none rounded-tick border border-ink-3 bg-surface transition-colors checked:border-ink checked:bg-ink enabled:hover:border-ink"
          {...rest}
        />
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto size-3 fill-none stroke-paper opacity-0 peer-checked:opacity-100"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      </span>
      {label != null && <span>{label}</span>}
    </label>
  )
}
