'use client'

import { useState, type ReactNode } from 'react'
import type { Project } from '@/lib/schema'
import TopBar from '../TopBar'
import { MobileNav } from './MobileNav'
import { APP_VERSION, CreditLink, Rail } from './Rail'
import { useScrollSpy } from './useScrollSpy'
import { useReviewOnDwell } from './Progress'
import { ExampleBanner } from '../library/ExampleBanner'
import { Walkthrough, WalkthroughLink } from './Walkthrough'
import { LegalLinks } from '../legal/LegalLinks'
import { FeedbackButton } from '../feedback/Feedback'

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
  useReviewOnDwell(current)
  // The landing screen is the welcome now, so the tour only opens when asked for.
  const [tourOpen, setTourOpen] = useState(false)
  const openTour = () => setTourOpen(true)

  return (
    <div className="min-h-screen">
      <SkipLink />
      <TopBar project={project} />
      <MobileNav project={project} current={current} />
      <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
        <Rail project={project} current={current} onOpenTour={openTour} />
        <main
          id="main"
          tabIndex={-1}
          className={`${canvasClass} scroll-mt-[100px] focus:outline-none lg:scroll-mt-14`}
        >
          <div className={contentClass}>
            <ExampleBanner onOpenTour={openTour} />
            {header}
            {children}
            <footer className="mt-[72px] flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line pt-[18px] text-13 text-ink-3">
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>UtilityLab v{APP_VERSION} · Stated choice experiment designer</span>
                <FeedbackButton />
                <LegalLinks />
              </span>
              <span className="flex items-center gap-4 lg:hidden">
                <WalkthroughLink onOpen={openTour} />
                <CreditLink />
              </span>
            </footer>
          </div>
        </main>
      </div>
      <Walkthrough project={project} open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  )
}
