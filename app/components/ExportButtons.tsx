'use client'

import { Fragment, forwardRef, useState, type ButtonHTMLAttributes } from 'react'
import type { Project } from '@/lib/schema'
import { exportTxt, exportQsf } from '@/lib/qualtricsExport'
import { exportSawtoothCsv } from '@/lib/sawtoothExport'
import { buildSurveyLss } from '@/lib/limesurveyExport'
import { buildWiringGuide, hasPivotedAttributes, pivotedAttributes, tokenFor } from '@/lib/wiringGuide'
import { joinNames, listSeparator } from '@/lib/text'
import { Button, cx } from './ui'
import { useLatestProject } from './ProjectStore'
import { ChevronDown, Download, Upload } from './Icons'
import { PlatformCard, Path } from './export/PlatformCard'
import { downloadBlob } from './export/download'
import { useProgress } from './shell/Progress'

type CardKey = 'qualtrics' | 'limesurvey' | 'sawtooth' | 'wiring'

export default function ExportButtons({
  project,
  pushOpen,
  onTogglePush,
  pushPanelId,
  pushToggleId,
  noDesignId,
}: {
  project: Project
  pushOpen: boolean
  onTogglePush: () => void
  pushPanelId: string
  pushToggleId: string
  /** Id of the visible "no design" notice, referenced by the disabled buttons. */
  noDesignId?: string
}) {
  const hasDesign = !!project.design && project.design.rows.length > 0
  const showWiringGuide = hasPivotedAttributes(project)
  const [errors, setErrors] = useState<Partial<Record<CardKey, string>>>({})
  const describedBy = hasDesign ? undefined : noDesignId
  const getProject = useLatestProject()
  const { markReviewed } = useProgress()

  // Files are built from the latest project at click time, not from this view's deferred copy.
  const run = (card: CardKey, build: (latest: Project) => void) => {
    try {
      build(getProject())
      setErrors((e) => ({ ...e, [card]: undefined }))
      markReviewed('export')
    } catch (err) {
      setErrors((e) => ({ ...e, [card]: `Couldn’t build the file: ${(err as Error).message}` }))
    }
  }

  const pivoted = showWiringGuide ? pivotedAttributes(project) : []

  return (
    <div className={cx('grid gap-3 sm:grid-cols-2', showWiringGuide ? 'xl:grid-cols-4' : 'lg:grid-cols-3')}>
      <PlatformCard
        name="Qualtrics"
        tag="2 formats"
        description="Advanced Format TXT for the survey import, or a QSF survey with one block per design block."
        howTo={
          <>
            Import: <Path>Library → Survey Templates → New → Import</Path>.
            {(project.design?.numBlocks ?? 1) > 1 && (
              <span className="mt-1.5 block text-caution">
                The QSF shows each respondent one block. The TXT can’t: after importing it, add a
                Randomizer in Survey flow that presents 1 of the {project.design?.numBlocks} blocks,
                evenly (the file’s Setup notes explain how).
              </span>
            )}
          </>
        }
        error={errors.qualtrics}
      >
        <DownloadButton
          format="TXT"
          label="Advanced Format"
          title="Advanced Format TXT for the Qualtrics survey import"
          disabled={!hasDesign}
          aria-describedby={describedBy}
          onClick={() =>
            run('qualtrics', (p) => downloadBlob(exportTxt(p), `${p.slug}.txt`, 'text/plain'))
          }
        />
        <DownloadButton
          format="QSF"
          label="Qualtrics native"
          title="Qualtrics native QSF survey, one block per design block"
          disabled={!hasDesign}
          aria-describedby={describedBy}
          onClick={() =>
            run('qualtrics', (p) => downloadBlob(exportQsf(p), `${p.slug}.qsf`, 'application/json'))
          }
        />
      </PlatformCard>

      <PlatformCard
        name="LimeSurvey"
        tag="API beta"
        description="A complete LSS survey file, or push the choice tasks straight to your LimeSurvey server through RemoteControl 2."
        howTo={
          <>
            Import: <Path>Survey settings → Import</Path>.
          </>
        }
        error={errors.limesurvey}
      >
        <DownloadButton
          format="LSS"
          label="Survey file"
          title="LimeSurvey LSS survey file"
          disabled={!hasDesign}
          aria-describedby={describedBy}
          onClick={() =>
            run('limesurvey', (p) =>
              downloadBlob(buildSurveyLss(p), `${p.slug}.lss`, 'application/xml'),
            )
          }
        />
        <Button
          id={pushToggleId}
          size="sm"
          icon={<Upload />}
          aria-expanded={pushOpen}
          aria-controls={pushPanelId}
          onClick={onTogglePush}
          className={cx(pushOpen && 'shadow-pressed')}
        >
          Push via API
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={cx('transition-transform motion-reduce:transition-none', pushOpen && 'rotate-180')}
          />
        </Button>
      </PlatformCard>

      <PlatformCard
        name="Sawtooth"
        tag="Beta"
        description="Design CSV for Sawtooth Lighthouse Studio’s CBC exercise. Opt-out alternatives are left out; Lighthouse adds “None” through an exercise setting."
        howTo={
          <>
            Import: <Path>CBC exercise → Design tab → Import Design</Path>. Configure attributes and
            levels in Lighthouse first; level codes are 1-indexed positions.
          </>
        }
        error={errors.sawtooth}
      >
        <DownloadButton
          format="CSV"
          label="Sawtooth Lighthouse"
          title="CSV for Sawtooth Lighthouse Studio → CBC → Import Design"
          disabled={!hasDesign}
          aria-describedby={describedBy}
          onClick={() =>
            run('sawtooth', (p) =>
              downloadBlob(exportSawtoothCsv(p), `${p.slug}-sawtooth.csv`, 'text/csv'),
            )
          }
        />
      </PlatformCard>

      {showWiringGuide && (
        <PlatformCard
          name="Pivot wiring guide"
          description={
            <>
              This design has pivoted attributes. The guide shows how to pipe{' '}
              {pivoted.map((a, i) => (
                <Fragment key={a.id}>
                  {listSeparator(i, pivoted.length)}
                  <code className="rounded-bar bg-surface-3 px-1 font-mono text-12 text-ink-2">{tokenFor(a)}</code>
                </Fragment>
              ))}{' '}
              into Qualtrics or LimeSurvey so {joinNames(pivoted.map((a) => a.name.trim() || 'the attribute'))}{' '}
              {pivoted.length === 1 ? 'pivots' : 'pivot'} on each respondent’s own value.
            </>
          }
          error={errors.wiring}
        >
          <DownloadButton
            format="Markdown"
            label="Wiring guide"
            title="Markdown guide explaining how to wire pivoted attributes into Qualtrics or LimeSurvey"
            onClick={() =>
              run('wiring', (p) =>
                downloadBlob(buildWiringGuide(p), `${p.slug}-wiring-guide.md`, 'text/markdown'),
              )
            }
          />
        </PlatformCard>
      )}
    </div>
  )
}

const DownloadButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { format: string; label: string }
>(function DownloadButton({ format, label, title, ...rest }, ref) {
  return (
    <Button ref={ref} size="sm" icon={<Download />} title={title ?? `${label} (${format})`} {...rest}>
      <span className="sr-only">Download </span>
      {format}
      <span className="sr-only">, {label}</span>
    </Button>
  )
})
