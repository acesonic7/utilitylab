'use client'

import { Fragment, type ReactNode } from 'react'
import type { Project } from '@/lib/schema'
import { altIdentities } from '@/lib/altIdentity'
import { designShape } from '@/lib/diagnostics'
import { designSignature } from '@/lib/signature'
import { formatDay } from '@/lib/formatDate'
import { useDesignHealth } from './DesignHealth'
import { Download, Folder, Plus } from './Icons'
import { useLibrary } from './library/LibraryContext'
import { AltGlyph, Button, CopyButton, Gauge, Stat, Tag, type GaugeBand } from './ui'

// Same thresholds as analyzeSample in lib/sampleSize.ts: low < 25, borderline < 50, good.
const OBS_BANDS: GaugeBand[] = [
  { to: 25, tone: 'risk' },
  { to: 50, tone: 'caution' },
  { to: 200, tone: 'ok' },
]
const STATUS_WORD = { good: 'good', borderline: 'borderline', low: 'low', unset: 'not set' }

function word(n: number, one: string, many = `${one}s`) {
  return n === 1 ? one : many
}

function SignatureText({ project, signature }: { project: Project; signature: string }) {
  const ids = altIdentities(project)
  const prefix = `C = {${ids.map((id) => id.label).join(', ')}}`
  if (!signature.startsWith(prefix)) return <>{signature}</>
  const rest = signature
    .slice(prefix.length)
    .split(' · ')
    .filter((p) => p.length > 0)
  const op = (s: ReactNode) => <span className="text-ink-3">{s}</span>
  return (
    <>
      {op('C = {')}
      {ids.map((id, i) => (
        <Fragment key={id.altId}>
          <AltGlyph identity={id} size={9} className="ml-px mr-[3px]" />
          {id.label}
          {i < ids.length - 1 && ', '}
        </Fragment>
      ))}
      {op('}')}
      {rest.map((part, i) => (
        <Fragment key={i}>
          {op(' · ')}
          {part}
        </Fragment>
      ))}
    </>
  )
}

export default function ProjectHeader({ project }: { project: Project }) {
  const lib = useLibrary()
  const health = useDesignHealth()
  const shape = designShape(project)
  const signature = designSignature(project, { dError: health.dError })
  const created = formatDay(project.createdAt)
  const labeled = project.experimentType === 'labeled'

  const nAlts = project.alternatives.length
  const nAttrs = project.attributes.length
  const perRespondent = shape
    ? shape.perRespondent.min === shape.perRespondent.max
      ? String(shape.perRespondent.min)
      : `${shape.perRespondent.min}–${shape.perRespondent.max}`
    : '—'

  const sample = health.sample
  const obs = sample && sample.status !== 'unset' ? Math.round(sample.observationsPerParameter) : null
  const target = project.targetSampleSize && project.targetSampleSize > 0 ? project.targetSampleSize : null
  const priors = health.priorsNonZero ? 'non-zero' : 'zero'

  return (
    <section aria-labelledby="project-title">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-13 text-ink-3">
        <Tag>{labeled ? 'Labeled' : 'Unlabeled'} stated choice experiment</Tag>
        {project.slug && <span className="font-mono text-12">{project.slug}</span>}
        {created && (
          <span className="hidden gap-2.5 sm:inline-flex">
            <span aria-hidden="true">·</span>
            <span>Created {created}</span>
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" icon={<Plus />} onClick={lib.startNew}>
            New study
          </Button>
          <Button variant="ghost" size="sm" icon={<Folder />} onClick={lib.openLibrary}>
            Studies
          </Button>
          <Button variant="ghost" size="sm" icon={<Download />} onClick={() => lib.download(project.id)}>
            Download project
          </Button>
        </span>
      </div>

      <h1
        id="project-title"
        className="mt-3.5 break-words font-display text-34 font-[620] tracking-display text-ink [font-variation-settings:'opsz'_60,'wdth'_96] sm:text-42"
      >
        {project.name || 'Untitled stated choice experiment'}
      </h1>
      {project.description && (
        <p className="mt-2.5 max-w-[62ch] text-16 leading-6 text-ink-2">{project.description}</p>
      )}

      {/* No overflow clipping here, so the copy button's focus ring stays visible. */}
      <div className="mt-[22px] flex items-stretch rounded-card bg-surface shadow-hairline">
        <span className="hidden items-center whitespace-nowrap rounded-l-card border-r border-line bg-surface-2 px-3 text-12 font-medium text-ink-3 sm:flex">
          Signature
        </span>
        <p className="min-w-0 flex-1 break-words px-3.5 py-[11px] font-mono text-13 leading-[21px] text-ink">
          <SignatureText project={project} signature={signature} />
        </p>
        <CopyButton
          bare
          text={signature}
          aria-label="Copy signature"
          className="rounded-r-card border-l border-line px-3.5"
        />
      </div>

      <div className="mt-[26px] flex flex-wrap gap-y-6">
        <div role="group" aria-label="Experiment" className="flex flex-wrap gap-x-[30px] gap-y-4 pr-8">
          <Stat size="md" value={nAlts} label={word(nAlts, 'alternative')} />
          <Stat size="md" value={nAttrs} label={word(nAttrs, 'attribute')} />
          <Stat size="md" value={shape ? shape.tasks : '—'} label={word(shape?.tasks ?? 0, 'choice task')} />
          <Stat size="md" value={shape ? shape.blocks : '—'} label={word(shape?.blocks ?? 0, 'block')} />
          <Stat size="md" value={perRespondent} label="per respondent" />
        </div>

        <div
          role="group"
          aria-label="Efficiency"
          className="flex w-full flex-wrap gap-x-[30px] gap-y-4 border-t border-line pt-5 xl:w-auto xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0"
        >
          <Stat
            size="md"
            value={health.dError !== null ? health.dError.toFixed(3) : '—'}
            label={health.dError !== null ? `D-error (MNL, priors: ${priors})` : 'D-error'}
          />
          <Stat size="md" value={obs ?? '—'} label="observations per parameter">
            {obs !== null && sample && (
              <div className="w-[132px]" title="Low below 25, borderline 25–50, good from 50">
                <Gauge
                  value={obs}
                  min={0}
                  max={200}
                  bands={OBS_BANDS}
                  ariaLabel={`Observations per parameter: ${obs}, ${STATUS_WORD[sample.status]}. Low below 25, borderline 25 to 50, good from 50.`}
                />
              </div>
            )}
          </Stat>
          <Stat size="md" value={target ?? '—'} label="target respondents" />
        </div>
      </div>
    </section>
  )
}
