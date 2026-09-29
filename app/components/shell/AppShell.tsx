'use client'

import type { ReactNode } from 'react'
import type { Project } from '@/lib/schema'
import TopBar from '../TopBar'
import { MobileNav } from './MobileNav'
import { APP_VERSION, CreditLink, Rail } from './Rail'
import { useScrollSpy } from './useScrollSpy'

export const canvasClass = 'min-w-0 px-4 pb-24 pt-8 sm:px-8 lg:px-11 lg:pt-10'
export const contentClass = 'mx-auto max-w-[1120px]'

export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-ctl bg-surface px-3 py-2 text-13 font-medium text-ink shadow-raised focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ink"
    >
      Skip to content
    </a>
  )
}

export function AppShell({
  project,
  header,
  children,
}: {
  project: Project
  header: ReactNode
  children: ReactNode
}) {
  const current = useScrollSpy()

  return (
    <div className="min-h-screen">
      <SkipLink />
      <TopBar project={project} />
      <MobileNav project={project} current={current} />
      <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
        <Rail project={project} current={current} />
        <main
          id="main"
          tabIndex={-1}
          className={`${canvasClass} scroll-mt-[100px] focus:outline-none lg:scroll-mt-14`}
        >
          <div className={contentClass}>
            {header}
            {children}
            <footer className="mt-[72px] flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line pt-[18px] text-13 text-ink-3">
              <span>UtilityLab v{APP_VERSION} · Stated choice experiment designer</span>
              <CreditLink className="lg:hidden" />
            </footer>
          </div>
        </main>
      </div>
    </div>
  )
}
