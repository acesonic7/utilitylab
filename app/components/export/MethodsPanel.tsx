'use client'

import { useId, useMemo } from 'react'
import type { Project } from '@/lib/schema'
import { buildMethodsParagraph } from '@/lib/methodsParagraph'
import { useDesignHealth } from '../DesignHealth'
import { CopyButton } from '../ui'

export function MethodsPanel({ project }: { project: Project }) {
  const health = useDesignHealth()
  const titleId = useId()
  const paragraph = useMemo(() => buildMethodsParagraph(project, health), [project, health])

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-3 rounded-panel bg-surface px-5 py-[18px] shadow-hairline [grid-template-areas:'title_copy'_'text_text'] lg:grid-cols-[200px_minmax(0,1fr)_auto] lg:[grid-template-areas:'title_text_copy']"
    >
      <div className="[grid-area:title]">
        <h3 id={titleId} className="text-14 font-semibold text-ink">
          Methods paragraph
        </h3>
        <p className="mt-1 text-12 leading-[18px] text-ink-3">
          Generated from the project. Paste it into your paper; highlighted figures come from the
          design.
        </p>
      </div>

      <div className="min-w-0 [grid-area:text]">
        <p className="max-w-[70ch] break-words text-14 leading-[23px] text-ink">
          {paragraph.segments.map((seg, i) =>
            seg.mark ? (
              <mark key={i} className="rounded-bar bg-accent/55 px-0.5 text-accent-ink box-decoration-clone dark:bg-accent/85">
                {seg.text}
              </mark>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </p>
        {paragraph.references.map((reference) => (
          <p key={reference} className="mt-2.5 max-w-[70ch] break-words text-12 leading-[18px] text-ink-3">
            <span className="font-medium text-ink-2">Reference:</span> {reference}
          </p>
        ))}
        {!paragraph.hasDesign && (
          <p className="mt-2.5 text-12 text-ink-3">
            Add a design in 02 Design to complete the paragraph with the choice tasks, blocks, D-error
            and design checks.
          </p>
        )}
      </div>

      <div className="[grid-area:copy]">
        <CopyButton text={paragraph.text} aria-label="Copy methods paragraph" />
      </div>
    </div>
  )
}
