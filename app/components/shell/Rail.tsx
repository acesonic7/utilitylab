'use client'

import type { Project } from '@/lib/schema'
import pkg from '@/package.json'
import { useWorkspaceActions, type SectionId } from '../Workspace'
import { cx } from '../ui'
import { ChoiceSetLegend } from './ChoiceSetLegend'
import { SECTIONS, onSectionLinkClick } from './sections'
import { HereDot, StatusMarker } from './StatusMarker'
import { WalkthroughLink } from './Walkthrough'
import { LegalLinks } from '../legal/LegalLinks'
import { useSectionStatus } from './useSectionStatus'
import { useProgress, type StepState } from './Progress'

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
  const progress = useProgress()

  return (
    <aside
      aria-label="Workspace"
      className="sticky top-14 hidden h-[calc(100vh-56px)] flex-col gap-[26px] overflow-y-auto border-r border-line px-3.5 pb-[18px] pt-[22px] lg:flex"
    >
      <nav aria-label="Steps">
        <ol className="flex flex-col gap-0.5">
          {SECTIONS.map((s, i) => {
            const on = s.id === current
            const st = status[s.id]
            const step = progress.states[s.id]
            const last = i === SECTIONS.length - 1
            return (
              <li key={s.id} className="relative">
                {!last && (
                  <span
                    aria-hidden="true"
                    className={cx(
                      'pointer-events-none absolute left-[18.25px] top-[35px] -bottom-[7px] z-[1] w-[1.5px] rounded-full',
                      step === 'done' && progress.states[SECTIONS[i + 1].id] === 'done' ? 'bg-ok' : 'bg-line-2',
                    )}
                  />
                )}
                <a
                  href={`#${s.id}`}
                  onClick={(e) => onSectionLinkClick(e, () => goTo(s.id))}
                  aria-current={on ? 'location' : undefined}
                  className={cx(
                    'focus-ring relative grid w-full grid-cols-[22px_minmax(0,1fr)_auto] gap-x-2.5 rounded-well py-[9px] pl-2 pr-2.5 text-left transition-colors',
                    on ? 'bg-surface shadow-hairline' : 'hover:bg-surface-3',
                  )}
                >
                  {on && (
                    <span
                      aria-hidden="true"
                      className="absolute -left-3.5 bottom-3 top-3 w-[3px] rounded-r-bar bg-ink"
                    />
                  )}
                  <StepDot index={s.index} state={step} />
                  <span className={cx('text-14 font-semibold', step === 'todo' ? 'text-ink-2' : 'text-ink')}>
                    {s.title}
                    <span className="sr-only">{STEP_SR[step]}</span>
                  </span>
                  <span className="flex items-center gap-1.5 self-center">
                    {step === 'next' && !on && (
                      <span aria-hidden="true" className="text-12 font-medium text-ink-3">
                        Next
                      </span>
                    )}
                    <StatusMarker marker={st.marker} />
                    {on && <HereDot />}
                  </span>
                  <span className="col-span-2 col-start-2 truncate text-12 text-ink-3">{st.line}</span>
                </a>
              </li>
            )
          })}
        </ol>
        <StepsDone done={progress.doneCount} total={SECTIONS.length} />
      </nav>

      <ChoiceSetLegend project={project} />

      <div className="mt-auto flex flex-col gap-2 px-2 text-12 text-ink-3">
        <span className="flex items-center gap-3">
          <WalkthroughLink onOpen={onOpenTour} />
          <LegalLinks />
        </span>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono">v{APP_VERSION}</span>
          <CreditLink />
        </div>
      </div>
    </aside>
  )
}

const STEP_SR: Record<StepState, string> = { done: ', done', next: ', next step', todo: '' }

export function StepDot({ index, state, size = 22 }: { index: string; state: StepState; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cx(
        'relative z-[2] row-span-2 flex shrink-0 items-center justify-center rounded-full border font-mono text-12 leading-none',
        state === 'done' && 'border-ok bg-ok text-paper',
        state === 'next' && 'border-accent-edge bg-accent font-semibold text-accent-ink',
        state === 'todo' && 'border-line-2 bg-surface-2 text-ink-3',
      )}
    >
      {state === 'done' ? (
        <svg
          viewBox="0 0 16 16"
          className="size-3 fill-none stroke-current"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      ) : (
        Number(index)
      )}
    </span>
  )
}

function StepsDone({ done, total }: { done: number; total: number }) {
  return (
    <div className="mt-3 px-2">
      <div aria-hidden="true" className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cx('h-1 flex-1 rounded-full', i < done ? 'bg-ok' : 'bg-line-2')} />
        ))}
      </div>
      <p className="mt-1.5 text-12 text-ink-3">
        {done === total ? 'All steps done' : `${done} of ${total} steps done`}
      </p>
    </div>
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
