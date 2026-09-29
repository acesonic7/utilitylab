import type { ReactNode } from 'react'

export type SectionHeaderProps = {
  index: string
  title: string
  lede?: ReactNode
  actions?: ReactNode
  /** Optional id for the h2. */
  id?: string
}

export function SectionHeader({ index, title, lede, actions, id }: SectionHeaderProps) {
  return (
    <header className="mb-[22px] flex flex-wrap items-baseline gap-x-3.5 gap-y-1 border-b border-line pb-3.5">
      <span className="-translate-y-0.5 font-mono text-13 leading-none text-ink-3" aria-hidden="true">
        {index}
      </span>
      <h2
        id={id}
        className="font-display text-26 font-semibold tracking-title text-ink [font-variation-settings:'opsz'_32]"
      >
        {title}
      </h2>
      {lede != null && <p className="text-14 text-ink-3">{lede}</p>}
      {actions != null && <div className="ml-auto flex gap-2 self-center">{actions}</div>}
    </header>
  )
}
