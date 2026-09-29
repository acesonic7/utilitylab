'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Project } from '@/lib/schema'
import { altIdentities } from '@/lib/altIdentity'
import { AltGlyph, Button, cx } from '../ui'
import { useWorkspaceActions, type SectionId } from '../Workspace'
import { ChevronLeft, ChevronRight, XMark } from '../Icons'

const SEEN_KEY = 'utilitylab:walkthrough'

export function hasSeenWalkthrough(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === 'seen'
  } catch {
    return false
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, 'seen')
  } catch {}
}

type Step = { kicker: string; title: string; body: ReactNode; section?: SectionId }

function steps(project: Project): Step[] {
  return [
    {
      kicker: 'Welcome',
      title: 'Design a stated choice experiment, from structure to survey',
      body: (
        <>
          UtilityLab takes you from the alternatives and attributes of your study to choice tasks
          you can field in Qualtrics, LimeSurvey or Sawtooth. This one-minute tour uses the example
          study, <strong className="font-semibold text-ink">{project.name}</strong>.
        </>
      ),
    },
    {
      kicker: '01 · Structure',
      section: 'structure',
      title: 'Define the choice set',
      body: 'Add the alternatives respondents choose between, the attributes that describe them and the levels each attribute takes. Context variables set the scene for a whole choice task, and constraints rule out implausible combinations. Each alternative keeps its colour and glyph in every view.',
    },
    {
      kicker: '02 · Design',
      section: 'design',
      title: 'Generate or upload the design',
      body: 'Generate a D-efficient, balanced or random design from your structure, or upload one from Ngene, R or another tool as a CSV. The design matrix shows one row per choice task, grouped by block.',
    },
    {
      kicker: '03 · Choice tasks',
      section: 'choice-tasks',
      title: 'See what respondents will see',
      body: 'Page through every choice task as a respondent would (J and K step through them). Switch on the analyst lens to overlay level codes, dominated alternatives and choice probabilities.',
    },
    {
      kicker: '04 · Diagnostics',
      section: 'diagnostics',
      title: 'Check the design before fielding it',
      body: 'Dominance, identical alternatives, attribute correlation, level balance and constraint checks re-run after every edit, next to the D-error and observations per parameter.',
    },
    {
      kicker: '05 · Export',
      section: 'export',
      title: 'Take it to the field',
      body: 'Download files for Qualtrics, LimeSurvey or Sawtooth, or push straight to a LimeSurvey server. A generated methods paragraph describes the design for your paper.',
    },
    {
      kicker: 'Before you start',
      title: 'Your studies live in this browser',
      body: 'Edits save automatically to this browser on this device, and nothing leaves it unless you push to LimeSurvey. Open Studies from the study name at the top to start a new study, switch between studies or download one as a project file — do that to keep a copy, since clearing browser data removes everything. Reopen this tour any time from the Walkthrough link.',
    },
  ]
}

export function Walkthrough({
  project,
  open,
  onClose,
}: {
  project: Project
  open: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [i, setI] = useState(0)
  const { goTo } = useWorkspaceActions()
  const all = steps(project)
  const step = all[i]
  const last = i === all.length - 1

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setI(0)
      d.showModal()
    } else if (!open && d.open) d.close()
  }, [open])

  const finish = (section?: SectionId) => {
    markSeen()
    onClose()
    if (section) goTo(section)
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="walkthrough-title"
      onClose={() => {
        markSeen()
        onClose()
      }}
      className="w-[min(560px,calc(100vw-32px))] rounded-hero border border-line bg-surface p-0 text-ink shadow-raised backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-8">
        <span className="font-mono text-12 text-ink-3">{step.kicker}</span>
        <button
          type="button"
          onClick={() => finish()}
          aria-label="Close walkthrough"
          className="focus-ring -mr-2 -mt-2 rounded-ctl p-2 text-ink-3 hover:bg-surface-3 hover:text-ink"
        >
          <XMark size={16} />
        </button>
      </div>

      <div className="px-6 pb-2 pt-3 sm:px-8">
        {i === 0 && <GlyphRow project={project} />}
        <h2
          id="walkthrough-title"
          className="font-display text-26 font-semibold tracking-title text-ink"
        >
          {step.title}
        </h2>
        <p className="mt-3 text-14 leading-[22px] text-ink-2">{step.body}</p>
        {step.section && (
          <button
            type="button"
            onClick={() => finish(step.section)}
            className="focus-ring mt-3 rounded-tick text-13 font-medium text-ink underline decoration-line-2 underline-offset-[3px] hover:decoration-ink-3"
          >
            Go to this section
          </button>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line px-6 py-4 sm:px-8">
        <ol className="flex items-center gap-1.5" aria-label={`Step ${i + 1} of ${all.length}`}>
          {all.map((s, n) => (
            <li key={s.kicker}>
              <button
                type="button"
                onClick={() => setI(n)}
                aria-label={`Step ${n + 1}: ${s.title}`}
                aria-current={n === i ? 'step' : undefined}
                className={cx(
                  'focus-ring block h-1.5 rounded-pill transition-all',
                  n === i ? 'w-5 bg-ink' : 'w-1.5 bg-line-2 hover:bg-ink-4',
                )}
              />
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2">
          {i === 0 ? (
            <Button variant="ghost" onClick={() => finish()}>
              Skip
            </Button>
          ) : (
            <Button variant="ghost" icon={<ChevronLeft size={14} />} onClick={() => setI(i - 1)}>
              Back
            </Button>
          )}
          {last ? (
            <Button variant="primary" onClick={() => finish()} autoFocus>
              Start exploring
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setI(i + 1)} autoFocus={i === 0}>
              {i === 0 ? 'Take the tour' : 'Next'}
              <ChevronRight size={14} />
            </Button>
          )}
        </div>
      </div>
    </dialog>
  )
}

function GlyphRow({ project }: { project: Project }) {
  return (
    <div aria-hidden="true" className="mb-4 flex items-center gap-2">
      {altIdentities(project).map((id) => (
        <span
          key={id.altId}
          className="flex h-9 w-9 items-center justify-center rounded-card border border-line bg-surface-2"
        >
          <AltGlyph identity={id} size={14} />
        </span>
      ))}
    </div>
  )
}

export function WalkthroughLink({ onOpen, className }: { onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        'focus-ring whitespace-nowrap rounded-tick underline decoration-line-2 underline-offset-[3px] transition-colors hover:text-ink hover:decoration-ink-3',
        className,
      )}
    >
      Walkthrough
    </button>
  )
}
