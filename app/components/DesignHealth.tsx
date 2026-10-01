'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Project } from '@/lib/schema'
import { validate, type Report } from '@/lib/validation'
import { buildPriorVector, computeDError, paramLayout } from '@/lib/dOptimal'
import { analyzeSample, type SampleAnalysis } from '@/lib/sampleSize'
import { constraintViolations, type ConstraintViolations } from '@/lib/diagnosticsView'
import { designFit, type DesignFit } from '@/lib/designFit'
import {
  designShape,
  diagnosticsByTask,
  findingCounts,
  type TaskDiagnostics,
} from '@/lib/diagnostics'

export type DesignHealth = {
  report: Report
  counts: ReturnType<typeof findingCounts>
  byTask: TaskDiagnostics[]
  dError: number | null
  K: number
  priorsNonZero: boolean
  sample: SampleAnalysis | null
  /** Validation findings only; constraint violations are counted separately. */
  totalFindings: number
  /** Violated (row, enabled constraint) pairs; each ranks as a concern. Same as violations.total. */
  constraintViolations: number
  /** Constraint violations per design row and per constraint: the one source for every count. */
  violations: ConstraintViolations
  /** Where the design no longer matches the structure (edited after the design was made), or null. */
  fit: DesignFit | null
}

export function computeDesignHealth(project: Project): DesignHealth {
  const report = validate(project)
  const layout = paramLayout(project)
  const priors = buildPriorVector(project, layout)
  const rows = project.design?.rows ?? []
  const d = rows.length > 0 ? computeDError(project, rows, priors, layout) : Infinity
  const shape = designShape(project)
  const violations = constraintViolations(project)
  return {
    report,
    counts: findingCounts(report),
    byTask: diagnosticsByTask(project, report),
    dError: Number.isFinite(d) ? d : null,
    K: layout.totalK,
    priorsNonZero: priors.some((b) => b !== 0),
    sample: shape ? analyzeSample(project, shape.tasks, shape.blocks) : null,
    totalFindings: report.findings.length,
    constraintViolations: violations.total,
    violations,
    fit: designFit(project),
  }
}

const DesignHealthContext = createContext<DesignHealth | null>(null)

export function DesignHealthProvider({
  project,
  children,
}: {
  project: Project
  children: ReactNode
}) {
  const value = useMemo(
    () => computeDesignHealth(project),
    // Only the fields the checks read, so editing the name or export settings doesn't recompute.
    [
      project.alternatives,
      project.attributes,
      project.contextVariables,
      project.constraints,
      project.design,
      project.experimentType,
      project.validationConfig,
      project.targetSampleSize,
    ],
  )
  return <DesignHealthContext.Provider value={value}>{children}</DesignHealthContext.Provider>
}

export function useDesignHealth(): DesignHealth {
  const ctx = useContext(DesignHealthContext)
  if (!ctx) throw new Error('useDesignHealth must be used inside <DesignHealthProvider>')
  return ctx
}
