'use client'

import { useEffect } from 'react'
import type { Project } from '@/lib/schema'
import { useWorkspaceActions } from '../Workspace'
import { Button, EmptyState, SectionHeader } from '../ui'
import { ChoiceTaskViewer } from '../choice-tasks/ChoiceTaskViewer'
import { NextStep } from '../shell/NextStep'

export default function ChoiceTasksSection({
  project,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const { goTo, setActiveTask } = useWorkspaceActions()
  const rows = project.design?.rows ?? []
  const hasRows = rows.length > 0
  const hasAlternatives = project.alternatives.length > 0

  // Clearing an already empty selection is a no-op, so this needn't subscribe to the active task.
  useEffect(() => {
    if (!hasRows) setActiveTask(null)
  }, [hasRows, setActiveTask])

  return (
    <>
      <SectionHeader
        index="03"
        title="Choice tasks"
        lede="Each choice task as respondents will see it. Switch on the analyst lens to overlay level codes and findings."
      />
      {!hasRows ? (
        <EmptyState
          title="No choice tasks yet"
          body="Upload or generate a design in 02 Design, and each choice task will appear here as respondents will see it."
          action={
            <Button size="sm" onClick={() => goTo('design')}>
              Go to Design
            </Button>
          }
        />
      ) : !hasAlternatives ? (
        <EmptyState
          title="No alternatives yet"
          body="Add alternatives in 01 Structure to preview the choice tasks."
          action={
            <Button size="sm" onClick={() => goTo('structure')}>
              Go to Structure
            </Button>
          }
        />
      ) : (
        <ChoiceTaskViewer project={project} />
      )}
      <NextStep after="choice-tasks" />
    </>
  )
}
