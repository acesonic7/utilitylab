'use client'

import type { ReactNode } from 'react'
import { useDesignHealth } from '../DesignHealth'
import { ChevronRight, Info, Upload } from '../Icons'
import { useWorkspaceActions, type SectionId } from '../Workspace'
import { Button, cx } from '../ui'
import { plural } from '@/lib/text'
import { SECTIONS } from './sections'
import { useProgress } from './Progress'

type Bar = {
  target: SectionId
  title: string
  body: ReactNode
  action?: { label: string; run: () => void }
  secondary?: ReactNode
  blocked?: boolean
}

/** The hand-off at the end of a section: what comes next, and a button to go there. */
export function NextStep({ after }: { after: SectionId }) {
  const { goTo } = useWorkspaceActions()
  const progress = useProgress()
  const health = useDesignHealth()
  const { hasDesign, designStale } = progress

  let concerns = health.constraintViolations
  for (const c of Object.values(health.counts)) concerns += c.concern

  let bar: Bar | null = null
  if (after === 'structure') {
    bar = progress.structureIssue
      ? {
          target: 'design',
          title: 'Finish the structure to build a design',
          body: progress.structureIssue,
          blocked: true,
        }
      : !hasDesign
        ? {
            target: 'design',
            title: 'Build the design from this structure',
            body: 'Generate a design here (D-efficient, balanced or random), or upload one from Ngene, R or another tool.',
            action: { label: 'Generate design', run: () => goTo('design', { panel: 'generate' }) },
            secondary: (
              <Button icon={<Upload />} onClick={() => goTo('design', { panel: 'upload' })}>
                Upload CSV
              </Button>
            ),
          }
        : designStale
          ? {
              target: 'design',
              title: 'The design no longer matches the structure',
              body: 'Your edits removed or changed levels, attributes or alternatives the design uses. Generate it again to include them.',
              action: { label: 'Generate again', run: () => goTo('design', { panel: 'generate' }) },
            }
          : {
              target: 'design',
              title: 'Review the design',
              body: 'Edits to the structure don’t change the design. Generate it again to include them.',
              action: { label: 'Go to Design', run: () => goTo('design') },
            }
  } else if (after === 'design' && hasDesign) {
    bar = {
      target: 'choice-tasks',
      title: 'See the choice tasks as respondents will',
      body: 'Page through each choice task, then switch on the analyst lens for level codes and choice probabilities.',
      action: { label: 'Preview choice tasks', run: () => goTo('choice-tasks', { lens: false }) },
    }
  } else if (after === 'choice-tasks' && hasDesign) {
    bar = {
      target: 'diagnostics',
      title: 'Check the design before fielding it',
      body: 'Dominance, identical alternatives, correlation, level balance and constraints, next to the D-error.',
      action: { label: 'Check diagnostics', run: () => goTo('diagnostics') },
    }
  } else if (after === 'diagnostics' && hasDesign) {
    bar = {
      target: 'export',
      title: 'Take it to the field',
      body: designStale
        ? 'The design no longer matches the structure. Generate it again before you download files for your survey platform.'
        : concerns > 0
          ? `Download for Qualtrics, LimeSurvey or Sawtooth. ${plural(concerns, 'concern')} above ${concerns === 1 ? 'is' : 'are'} still open.`
          : 'Download for Qualtrics, LimeSurvey or Sawtooth, or push the design to a LimeSurvey server.',
      action: { label: 'Go to Export', run: () => goTo('export') },
    }
  }
  if (!bar) return null

  const meta = SECTIONS.find((s) => s.id === bar.target)!
  const primary = progress.next === bar.target

  return (
    <aside
      aria-label={`Next step: ${meta.title}`}
      className={cx(
        'mt-8 flex flex-col gap-3 rounded-card px-4 py-3.5 sm:flex-row sm:items-center sm:gap-5 sm:px-5',
        bar.blocked ? 'border border-dashed border-line-2 bg-surface-2' : 'bg-surface shadow-hairline',
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        {bar.blocked && <Info size={14} className="mt-[3px] shrink-0 text-ink-3" />}
        <div className="min-w-0">
          <p className="font-mono text-12 text-ink-3">
            Next step · {meta.index} {meta.title}
          </p>
          <p className="mt-0.5 text-14 font-semibold text-ink">{bar.title}</p>
          <p className="mt-0.5 text-13 text-ink-3">{bar.body}</p>
        </div>
      </div>
      {bar.action && (
        <div className="flex shrink-0 flex-wrap gap-2">
          {bar.secondary}
          <Button variant={primary ? 'primary' : 'secondary'} onClick={bar.action.run}>
            {bar.action.label}
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
        </div>
      )}
    </aside>
  )
}
