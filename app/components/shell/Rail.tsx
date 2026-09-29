'use client'

import type { Project } from '@/lib/schema'
import pkg from '@/package.json'
import { useWorkspaceActions, type SectionId } from '../Workspace'
import { cx } from '../ui'
import { ChoiceSetLegend } from './ChoiceSetLegend'
import { SECTIONS, onSectionLinkClick } from './sections'
import { HereDot, StatusMarker } from './StatusMarker'
import { WalkthroughLink } from './Walkthrough'
import { useSectionStatus } from './useSectionStatus'

export const APP_VERSION = pkg.version

export function Rail({
  project,
  current,
  onOpenTour,
}: {
  project: Project
  current: SectionId
  onOpenTour: () => void
}) {
  const { goTo } = useWorkspaceActions()
  const status = useSectionStatus(project)

  return (
    <aside
      aria-label="Workspace"
      className="sticky top-14 hidden h-[calc(100vh-56px)] flex-col gap-[26px] overflow-y-auto border-r border-line px-3.5 pb-[18px] pt-[22px] lg:flex"
    >
      <nav aria-label="Sections">
        <ul className="flex flex-col gap-0.5">
          {SECTIONS.map((s) => {
            const on = s.id === current
            const st = status[s.id]
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => onSectionLinkClick(e, () => goTo(s.id))}
                  aria-current={on ? 'location' : undefined}
                  className={cx(
                    'focus-ring relative grid w-full grid-cols-[26px_minmax(0,1fr)_auto] gap-x-1.5 rounded-well py-[9px] pl-2 pr-2.5 text-left transition-colors',
                    on ? 'bg-surface shadow-hairline' : 'hover:bg-surface-3',
                  )}
                >
                  {on && (
                    <span
                      aria-hidden="true"
                      className="absolute -left-3.5 bottom-3 top-3 w-[3px] rounded-r-bar bg-ink"
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={cx('row-span-2 font-mono text-12 leading-5', on ? 'text-ink' : 'text-ink-3')}
                  >
                    {s.index}
                  </span>
                  <span className="text-14 font-semibold text-ink">{s.title}</span>
                  <span className="flex items-center gap-1.5 self-center">
                    <StatusMarker marker={st.marker} />
                    {on && <HereDot />}
                  </span>
                  <span className="col-span-2 col-start-2 truncate text-12 text-ink-3">{st.line}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      <ChoiceSetLegend project={project} />

      <div className="mt-auto flex flex-col gap-2 px-2 text-12 text-ink-3">
        <WalkthroughLink onOpen={onOpenTour} className="self-start" />
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono">v{APP_VERSION}</span>
          <CreditLink />
        </div>
      </div>
    </aside>
  )
}

export function CreditLink({ className }: { className?: string }) {
  return (
    <a
      href="https://github.com/acesonic7"
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        'focus-ring whitespace-nowrap rounded-tick underline decoration-line-2 underline-offset-[3px] transition-colors hover:text-ink hover:decoration-ink-3',
        className,
      )}
    >
      Made by Ioannis Tsouros
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
