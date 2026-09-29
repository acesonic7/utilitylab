'use client'

import { useEffect, useRef } from 'react'
import type { Project } from '@/lib/schema'
import { useWorkspaceActions, type SectionId } from '../Workspace'
import { cx } from '../ui'
import { SECTIONS, onSectionLinkClick } from './sections'
import { HereDot, StatusMarker } from './StatusMarker'
import { useSectionStatus } from './useSectionStatus'

// Compact section strip shown instead of the rail below lg.
export function MobileNav({ project, current }: { project: Project; current: SectionId }) {
  const { goTo } = useWorkspaceActions()
  const status = useSectionStatus(project)
  const strip = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const list = strip.current
    const item = list?.querySelector<HTMLElement>(`[data-section="${current}"]`)
    if (!list || !item || list.clientWidth === 0) return
    const left = item.offsetLeft - 16
    const right = item.offsetLeft + item.offsetWidth + 16
    if (left >= list.scrollLeft && right <= list.scrollLeft + list.clientWidth) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    list.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' })
  }, [current])

  return (
    <nav
      aria-label="Sections"
      className="sticky top-14 z-20 border-b border-line bg-paper/90 backdrop-blur-md lg:hidden"
    >
      <ul
        ref={strip}
        className="relative flex h-11 items-center gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden"
      >
        {SECTIONS.map((s) => {
          const on = s.id === current
          const marker = s.id === 'diagnostics' ? status[s.id].marker : null
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                data-section={s.id}
                onClick={(e) => onSectionLinkClick(e, () => goTo(s.id))}
                aria-current={on ? 'location' : undefined}
                className={cx(
                  'focus-ring flex h-8 items-center gap-2 whitespace-nowrap rounded-well px-2.5 text-13 font-medium transition-colors',
                  on ? 'bg-surface text-ink shadow-hairline' : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
                )}
              >
                <span aria-hidden="true" className={cx('font-mono text-12', on ? 'text-ink' : 'text-ink-3')}>
                  {s.index}
                </span>
                {s.title}
                {marker?.kind === 'count' && <StatusMarker marker={marker} />}
                {on && <HereDot />}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
