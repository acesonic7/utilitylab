import type { ReactNode } from 'react'

export default function Section({
  number,
  title,
  hint,
  action,
  children,
}: {
  number: number
  title: string
  hint?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center tabular-nums shadow-sm shadow-indigo-200/60">
            {number}
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight leading-none">{title}</h2>
            {hint && (
              <p className="text-xs text-neutral-500 mt-1">{hint}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
