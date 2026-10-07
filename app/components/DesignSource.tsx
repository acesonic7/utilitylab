'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import type { Project } from '@/lib/schema'
import type { SetProject } from './ProjectStore'
import CsvUpload from './CsvUpload'
import DesignGenerator from './DesignGenerator'
import { XMark } from './Icons'
import { IconButton, Tag } from './ui'
import type { DesignPanel } from './Workspace'

export type DesignSourceMode = DesignPanel

export const DESIGN_PANEL_IDS: Record<DesignSourceMode, string> = {
  upload: 'design-upload-panel',
  generate: 'design-generate-panel',
}

// Both panels stay mounted while hidden, so an in-progress mapping or generator settings survive closing.
export default function DesignSource({
  project,
  setProject,
  open,
  onClose,
}: {
  project: Project
  setProject: SetProject
  open: DesignSourceMode | null
  onClose: (applied?: boolean) => void
}) {
  const uploadHeading = useRef<HTMLHeadingElement>(null)
  const generateHeading = useRef<HTMLHeadingElement>(null)
  const replacing = project.design?.source === 'csv'

  useEffect(() => {
    if (open === 'upload') uploadHeading.current?.focus()
    if (open === 'generate') generateHeading.current?.focus()
  }, [open])

  return (
    <>
      <SourcePanel
        id={DESIGN_PANEL_IDS.upload}
        hidden={open !== 'upload'}
        headingRef={uploadHeading}
        title={replacing ? 'Replace the design CSV' : 'Upload a design CSV'}
        lede="Map each column to the choice task, block, an alternative’s attribute or a context variable."
        onClose={() => onClose()}
      >
        <CsvUpload project={project} setProject={setProject} onApplied={() => onClose(true)} />
      </SourcePanel>
      <SourcePanel
        id={DESIGN_PANEL_IDS.generate}
        hidden={open !== 'generate'}
        headingRef={generateHeading}
        title="Generate a design"
        tag={<Tag tone="muted">Beta</Tag>}
        lede="Build the design from the structure by a D-efficient search, a balanced search or random sampling."
        onClose={() => onClose()}
      >
        <DesignGenerator project={project} setProject={setProject} />
      </SourcePanel>
    </>
  )
}

function SourcePanel({
  id,
  hidden,
  headingRef,
  title,
  tag,
  lede,
  onClose,
  children,
}: {
  id: string
  hidden: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
  title: string
  tag?: ReactNode
  lede: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div id={id} role="group" aria-labelledby={`${id}-title`} hidden={hidden}>
      <div className="mb-6 rounded-panel bg-surface shadow-hairline">
        <header className="flex items-start gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id={`${id}-title`}
                ref={headingRef}
                tabIndex={-1}
                className="text-16 font-semibold tracking-[-0.005em] text-ink focus:outline-none"
              >
                {title}
              </h3>
              {tag}
            </div>
            <p className="mt-0.5 text-13 text-ink-3">{lede}</p>
          </div>
          <IconButton label={`Close: ${title}`} size="sm" onClick={onClose} className="-mr-1.5 shrink-0">
            <XMark />
          </IconButton>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
