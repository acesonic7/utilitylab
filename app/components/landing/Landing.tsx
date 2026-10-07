'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { travelModeExample } from '@/lib/example'
import { searchTrace } from '@/lib/searchTrace'
import { Wordmark } from '../Logo'
import { ChevronRight, Upload } from '../Icons'
import { SkipLink } from '../shell/AppShell'
import { APP_VERSION, CreditLink } from '../shell/Rail'
import { LegalLinks } from '../legal/LegalLinks'
import { MovedNotice } from '../shell/MovedNotice'
import { FeedbackButton } from '../feedback/Feedback'
import { ThemeToggle } from '../shell/ThemeToggle'
import { Button, buttonBase, buttonVariants, cx } from '../ui'
import { Film } from './Film'
import { MatrixMark, useMatrixIntro } from './MatrixMark'

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// The two main ways in are larger than the app's own buttons.
const action = (variant: 'primary' | 'secondary') =>
  cx(buttonBase, buttonVariants[variant], 'h-11 min-w-0 gap-2 px-5 text-[15px]')

export function Landing({
  intro,
  currentStudy,
  onContinue,
  onExample,
  onNew,
  onOpenFile,
}: {
  /** First visit: play the matrix entrance. */
  intro: boolean
  /** Name of the open study for a returning visitor, who can carry on with it. */
  currentStudy: string | null
  onContinue: () => void
  onExample: () => void
  onNew: () => void
  /** Resolves to an error message, or null once the study is open. */
  onOpenFile: (file: File) => Promise<string | null>
}) {
  // Mounted on the client only, so the search can run and the motion preference be read straight away.
  // One D-optimal search on the example study feeds both the entrance and the film.
  const [trace] = useState(() =>
    searchTrace(travelModeExample, { numTasks: 6, numBlocks: 2, rng: Math.random }),
  )
  const [play] = useState(() => intro && !prefersReducedMotion())
  const matrix = useMatrixIntro(play, trace)
  const revealed = matrix.phase === 'dock' || matrix.phase === 'done'
  const { skip } = matrix

  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Any key or click cuts the entrance short.
  useEffect(() => {
    if (revealed) return
    window.addEventListener('keydown', skip)
    window.addEventListener('pointerdown', skip)
    return () => {
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
  }, [revealed, skip])

  const openFile = async (file: File | undefined) => {
    if (!file) return
    setMessage(await onOpenFile(file))
  }

  // Everything but the mark waits for the entrance, then comes in one group after another.
  const reveal = (order: number, className?: string): { className: string; style?: CSSProperties } => ({
    className: cx(
      className,
      play && 'transition-[opacity,transform] duration-500 ease-out',
      revealed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
    ),
    style: play && revealed ? { transitionDelay: `${160 + order * 90}ms` } : undefined,
  })

  const returning = currentStudy !== null

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <MovedNotice />
      <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-4 sm:px-8 lg:px-11">
        <header className="flex items-center gap-3.5 pt-6 sm:pt-7">
          <MatrixMark intro={matrix} size={48} />
          <span {...reveal(0)}>
            <Wordmark size="lg" />
          </span>
          <span {...reveal(0, 'ml-auto')}>
            <ThemeToggle />
          </span>
        </header>

        <main
          id="main"
          tabIndex={-1}
          aria-hidden={revealed ? undefined : true}
          className="grid flex-1 items-center gap-10 py-9 focus:outline-none sm:py-10 lg:grid-cols-[minmax(0,10fr)_minmax(0,11fr)] lg:gap-14"
        >
          <div {...reveal(1)}>
            <p className="font-mono text-12 text-ink-3">Stated choice experiment designer</p>
            <h1 className="mt-3 max-w-[18ch] font-display text-34 font-[620] tracking-display text-ink [font-variation-settings:'opsz'_60,'wdth'_96] sm:text-42 xl:text-[48px] xl:leading-[52px]">
              Design a stated choice experiment, from structure to survey
            </h1>
            <p className="mt-4 max-w-[52ch] text-16 leading-6 text-ink-2">
              Define alternatives, attributes and levels, generate a D-efficient, balanced or random
              design, check it, and export choice tasks to Qualtrics, LimeSurvey or Sawtooth.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              {returning ? (
                <button type="button" onClick={onContinue} className={action('primary')}>
                  Continue your study
                  <ChevronRight size={15} />
                </button>
              ) : (
                <button type="button" onClick={onExample} className={action('primary')}>
                  Explore the example
                  <ChevronRight size={15} />
                </button>
              )}
              <button type="button" onClick={onNew} className={action('secondary')}>
                Start a new study
              </button>
            </div>
            <div className="-ml-2.5 mt-2.5 flex flex-wrap items-center gap-x-1 gap-y-1">
              {returning && (
                <Button variant="ghost" onClick={onExample}>
                  Explore the example
                </Button>
              )}
              <Button variant="ghost" icon={<Upload />} onClick={() => fileRef.current?.click()}>
                Open a project file…
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  void openFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>

            <p role="status" className={message ? 'mt-3 text-13 font-medium text-risk' : 'sr-only'}>
              {message ?? ''}
            </p>
            <p className="mt-6 max-w-[52ch] text-13 text-ink-3">
              {returning && (
                <>
                  Open study: <span className="font-medium text-ink-2">{currentStudy || 'Untitled stated choice experiment'}</span>.{' '}
                </>
              )}
              Studies are saved in this browser and nothing leaves it.
            </p>
          </div>

          <div {...reveal(2)}>
            <Film trace={trace} active={revealed} />
          </div>
        </main>

        <footer
          {...reveal(
            3,
            'flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line py-[18px] text-13 text-ink-3',
          )}
        >
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              UtilityLab <span className="font-mono text-12">v{APP_VERSION}</span>
            </span>
            <FeedbackButton />
            <LegalLinks />
          </span>
          <CreditLink />
        </footer>
      </div>
    </div>
  )
}
