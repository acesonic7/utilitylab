'use client'

import type { Project } from '@/lib/schema'
import { useDesignHealth } from '../DesignHealth'
import { useWorkspaceActions } from '../Workspace'
import { Button, EmptyState, SectionHeader } from '../ui'
import { DiagnosticsView } from '../diagnostics/DiagnosticsView'
import { ThresholdsDisclosure } from '../diagnostics/ThresholdsDisclosure'
import { verdict } from '../diagnostics/model'
import { NextStep } from '../shell/NextStep'
import { DesignFitNotice } from '../design/DesignFitNotice'

const STATIC_LEDE =
  'Checks for dominance, identical alternatives, attribute correlation, level balance and constraints. They re-run after every edit.'

export default function DiagnosticsSection({
  project,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const { goTo } = useWorkspaceActions()
  const { counts, violations, fit } = useDesignHealth()
  const tasks = project.design?.rows.length ?? 0
  const hasDesign = tasks > 0

  return (
    <>
      <SectionHeader
        index="04"
        title="Diagnostics"
        lede={
          !hasDesign
            ? STATIC_LEDE
            : fit
              ? `The design no longer matches the structure, so these checks only cover the cells that still fit it. ${verdict(counts, violations, tasks)}`
              : verdict(counts, violations, tasks)
        }
        actions={<ThresholdsDisclosure project={project} />}
      />
      {hasDesign && <DesignFitNotice context="use" />}
      {hasDesign ? (
        <DiagnosticsView project={project} violations={violations} />
      ) : (
        <EmptyState
          title="No design to check yet"
          body="Upload or generate a design in 02 Design. Every check runs on it automatically and re-runs after each edit."
          action={
            <Button size="sm" onClick={() => goTo('design')}>
              Go to Design
            </Button>
          }
        />
      )}
      <NextStep after="diagnostics" />
    </>
  )
}
