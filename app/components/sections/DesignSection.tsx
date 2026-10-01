'use client'

import { useRef } from 'react'
import type { Project } from '@/lib/schema'
import type { SetProject } from '../ProjectStore'
import { Button, EmptyState, SectionHeader } from '../ui'
import { Upload } from '../Icons'
import DesignSource, { DESIGN_PANEL_IDS, type DesignSourceMode } from '../DesignSource'
import { DesignMatrix } from '../design/DesignMatrix'
import { DesignHistory } from '../design/DesignHistory'
import { DesignFitNotice } from '../design/DesignFitNotice'
import { NextStep } from '../shell/NextStep'
import { useDesignPanel, useWorkspaceActions } from '../Workspace'

export default function DesignSection({
  project,
  setProject,
}: {
  project: Project
  setProject: SetProject
}) {
  // In the workspace, so the next-step bars and the top bar can open a panel from elsewhere.
  const open = useDesignPanel()
  const { setDesignPanel: setOpen } = useWorkspaceActions()
  const uploadBtn = useRef<HTMLButtonElement>(null)
  const generateBtn = useRef<HTMLButtonElement>(null)

  const design = project.design
  const hasRows = !!design && design.rows.length > 0
  const uploadLabel = design?.source === 'csv' ? 'Replace CSV' : 'Upload CSV'

  const toggle = (mode: DesignSourceMode) => setOpen(open === mode ? null : mode)

  const close = () => {
    const was = open
    setOpen(null)
    ;(was === 'generate' ? generateBtn : uploadBtn).current?.focus()
  }

  const clear = () => {
    if (!window.confirm('Clear the design? You can restore it later from Earlier designs.')) return
    setProject((p) => ({ ...p, design: null }))
    // The Clear button unmounts with the matrix; the header button stays put.
    uploadBtn.current?.focus()
  }

  return (
    <>
      <SectionHeader
        index="02"
        title="Design"
        lede="The experimental design as data: one row per choice task, grouped by block."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              ref={uploadBtn}
              size="sm"
              icon={<Upload />}
              aria-expanded={open === 'upload'}
              aria-controls={DESIGN_PANEL_IDS.upload}
              onClick={() => toggle('upload')}
              className="aria-expanded:border-ink aria-expanded:bg-surface-3"
            >
              {uploadLabel}
            </Button>
            <Button
              ref={generateBtn}
              size="sm"
              aria-expanded={open === 'generate'}
              aria-controls={DESIGN_PANEL_IDS.generate}
              onClick={() => toggle('generate')}
              className="aria-expanded:border-ink aria-expanded:bg-surface-3"
            >
              Generate design…
            </Button>
          </div>
        }
      />

      <DesignSource project={project} setProject={setProject} open={open} onClose={close} />

      {hasRows && <DesignFitNotice context="design" />}

      {hasRows ? (
        <DesignMatrix project={project} onClear={clear} />
      ) : (
        open === null && (
          <EmptyState
            title={design ? 'The design has no choice tasks' : 'No design yet'}
            body={
              design
                ? 'The current design has no rows. Upload a CSV with one row per choice task, or generate a design from the structure.'
                : 'Upload a design CSV with one row per choice task, or generate a D-efficient design from the structure.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" icon={<Upload />} onClick={() => setOpen('upload')}>
                  {uploadLabel}
                </Button>
                <Button size="sm" onClick={() => setOpen('generate')}>
                  Generate design…
                </Button>
                {design && (
                  <Button variant="danger" size="sm" onClick={clear}>
                    Clear design
                  </Button>
                )}
              </div>
            }
          />
        )
      )}

      <DesignHistory project={project} />
      <NextStep after="design" />
    </>
  )
}
