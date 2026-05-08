import type { ReactNode } from 'react'

export default function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="block mb-1.5">
        <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
          {label}
        </span>
        {required && (
          <span
            className="text-rose-500 ml-1 text-[11px] leading-none"
            aria-label="required"
            title="Required"
          >
            *
          </span>
        )}
      </label>
      {children}
      {hint && <p className="text-[11px] text-neutral-500 mt-1">{hint}</p>}
    </div>
  )
}

// Standard input class. Use this for all text/number inputs to keep focus
// behavior consistent across the app.
export const inputCls =
  'w-full bg-white rounded-md px-3 py-1.5 text-sm ring-1 ring-neutral-200 hover:ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition'

export const inputClsCompact =
  'w-full bg-white rounded-md px-2 py-1 text-sm ring-1 ring-neutral-200 hover:ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition'
