'use client'

import type { Project } from '@/lib/schema'
import { designShape } from '@/lib/diagnostics'
import { useDesignHealth } from '../DesignHealth'
import { useWorkspace, type SectionId } from '../Workspace'
import { plural } from '@/lib/text'

// Only findings get a marker; the step dots in the rail show which steps are done.
export type SectionMarker = { kind: 'count'; tone: 'risk' | 'caution'; count: number; label: string }

export type SectionStatus = { line: string; marker: SectionMarker | null }

export function useSectionStatus(project: Project): Record<SectionId, SectionStatus> {
  const health = useDesignHealth()
  const { activeTask } = useWorkspace()
  const shape = designShape(project)
  const rows = project.design?.rows ?? []

  const nAlts = project.alternatives.length
  const nAttrs = project.attributes.length

  let taskLine = shape ? plural(shape.tasks, 'choice task') : 'No choice tasks yet'
  if (shape && activeTask) {
    const row = rows.find((r) => r.block === activeTask.block && r.taskId === activeTask.taskId)
    // Same label as the choice-task pager: the design's own number, plus the block when numbers repeat.
    if (row) {
      const repeats = new Set(rows.map((r) => r.taskId)).size < rows.length
      taskLine = `Choice task ${row.taskId} of ${rows.length}${repeats ? ` · Block ${row.block}` : ''}`
    }
  }

  let concerns = health.constraintViolations
  let warnings = 0
  for (const c of Object.values(health.counts)) {
    concerns += c.concern
    warnings += c.warning
  }
  const diagMarker: SectionMarker | null = !shape
    ? null
    : concerns > 0
      ? { kind: 'count', tone: 'risk', count: concerns, label: plural(concerns, 'concern') }
      : warnings > 0
        ? { kind: 'count', tone: 'caution', count: warnings, label: plural(warnings, 'warning') }
        : null

  const diagLine = !shape
    ? 'No design yet'
    : [
        plural(health.totalFindings + health.constraintViolations, 'finding'),
        health.dError !== null ? `D-error ${health.dError.toFixed(3)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')

  return {
    structure: {
      line: `${plural(nAlts, 'alternative')} × ${plural(nAttrs, 'attribute')}`,
      marker: null,
    },
    design: {
      line: shape ? `${plural(shape.tasks, 'choice task')} · ${plural(shape.blocks, 'block')}` : 'No design yet',
      marker: null,
    },
    'choice-tasks': { line: taskLine, marker: null },
    diagnostics: { line: diagLine, marker: diagMarker },
    export: { line: 'Qualtrics · LimeSurvey +1', marker: null },
  }
}
