'use client'

import { useState } from 'react'
import type { Project } from '@/lib/schema'
import type { SetProject } from '../ProjectStore'
import { useWorkspaceActions } from '../Workspace'
import { Button, SectionHeader } from '../ui'
import { Info } from '../Icons'
import ExportButtons from '../ExportButtons'
import LimeSurveyPush from '../LimeSurveyPush'
import { MethodsPanel } from '../export/MethodsPanel'

const PUSH_PANEL_ID = 'limesurvey-push'
const PUSH_TOGGLE_ID = 'limesurvey-push-toggle'
const NO_DESIGN_ID = 'export-no-design'

export default function ExportSection({
  project,
  setProject,
}: {
  project: Project
  setProject: SetProject
}) {
  const { goTo } = useWorkspaceActions()
  const [pushOpen, setPushOpen] = useState(false)
  const hasDesign = !!project.design && project.design.rows.length > 0

  const closePush = () => {
    setPushOpen(false)
    document.getElementById(PUSH_TOGGLE_ID)?.focus()
  }

  return (
    <>
      <SectionHeader
        index="05"
        title="Export"
        lede="Download files for your survey platform, or push the design straight into LimeSurvey."
      />

      {!hasDesign && (
        <div
          id={NO_DESIGN_ID}
          className="mb-3 flex flex-col gap-3 rounded-card bg-surface-2 px-4 py-3 shadow-hairline sm:flex-row sm:items-center"
        >
          <p className="flex min-w-0 gap-2 text-13 text-ink-2">
            <Info size={14} className="mt-[3px] shrink-0 text-ink-3" />
            <span>
              No design yet, so the file exports and the LimeSurvey push are disabled. Upload or
              generate a design first; editor changes alone don’t produce choice tasks.
            </span>
          </p>
          <Button size="sm" className="self-start sm:ml-auto sm:self-center" onClick={() => goTo('design')}>
            Go to Design
          </Button>
        </div>
      )}

      <ExportButtons
        project={project}
        pushOpen={pushOpen}
        onTogglePush={() => setPushOpen((o) => !o)}
        pushPanelId={PUSH_PANEL_ID}
        pushToggleId={PUSH_TOGGLE_ID}
        noDesignId={NO_DESIGN_ID}
      />

      <div id={PUSH_PANEL_ID} hidden={!pushOpen} className="mt-3">
        {pushOpen && <LimeSurveyPush project={project} setProject={setProject} onClose={closePush} />}
      </div>

      <p className="mt-3 text-12 text-ink-3">
        Files are generated from the current state of the project, so export again after any change.
      </p>

      <div className="mt-6">
        <MethodsPanel project={project} />
      </div>
    </>
  )
}
