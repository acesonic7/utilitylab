'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Project } from '@/lib/schema'
import { identificationIssue } from '@/lib/dOptimal'
import { markReviewed, readReviewed, type ReviewStep } from '@/lib/library'
import type { SectionId } from '../Workspace'
import { SECTION_IDS } from './sections'

export type StepState = 'done' | 'next' | 'todo'

export type Progress = {
  states: Record<SectionId, StepState>
  /** The first step not done yet; null once every step is done. */
  next: SectionId | null
  doneCount: number
  hasDesign: boolean
  /** Why the structure can't support a design yet, or null. */
  structureIssue: string | null
  markReviewed: (step: ReviewStep) => void
}

const ProgressContext = createContext<Progress | null>(null)

// A step is done when its own work is: the structure can support a design, a design exists,
// and the later steps have been reviewed (or, for export, a file taken) for the current design.
export function ProgressProvider({ project, children }: { project: Project; children: ReactNode }) {
  const hasDesign = !!project.design && project.design.rows.length > 0
  const designKey = hasDesign ? project.design!.uploadedAt : null
  // Every structural check except the choice-task count, which the generator sets. Constants
  // alone identify a labeled model, so require an attribute explicitly.
  const structureIssue =
    project.attributes.length === 0
      ? 'Add at least one attribute with two or more levels.'
      : identificationIssue(project, Number.MAX_SAFE_INTEGER)
  const [reviewed, setReviewed] = useState<ReviewStep[]>([])

  useEffect(() => {
    setReviewed(readReviewed(project.id, designKey))
  }, [project.id, designKey])

  const mark = useCallback(
    (step: ReviewStep) => {
      if (!designKey) return
      setReviewed(markReviewed(project.id, designKey, step))
    },
    [project.id, designKey],
  )

  const value = useMemo<Progress>(() => {
    const met: Record<SectionId, boolean> = {
      structure: structureIssue === null,
      design: hasDesign,
      'choice-tasks': hasDesign && reviewed.includes('choice-tasks'),
      diagnostics: hasDesign && reviewed.includes('diagnostics'),
      export: hasDesign && reviewed.includes('export'),
    }
    const next = SECTION_IDS.find((id) => !met[id]) ?? null
    const states = Object.fromEntries(
      SECTION_IDS.map((id) => [id, met[id] ? 'done' : id === next ? 'next' : 'todo']),
    ) as Record<SectionId, StepState>
    return {
      states,
      next,
      doneCount: SECTION_IDS.filter((id) => met[id]).length,
      hasDesign,
      structureIssue,
      markReviewed: mark,
    }
  }, [structureIssue, hasDesign, reviewed, mark])

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

export function useProgress(): Progress {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgress must be used inside <ProgressProvider>')
  return ctx
}

const REVIEW_DWELL_MS = 1500

/** Marks choice tasks or diagnostics reviewed once the user has stayed on the section a moment. */
export function useReviewOnDwell(current: SectionId) {
  const { states, hasDesign, markReviewed } = useProgress()
  const step: ReviewStep | null =
    current === 'choice-tasks' || current === 'diagnostics' ? current : null
  const pending = step !== null && hasDesign && states[step] !== 'done'
  useEffect(() => {
    if (!pending || !step) return
    const t = window.setTimeout(() => markReviewed(step), REVIEW_DWELL_MS)
    return () => window.clearTimeout(t)
  }, [pending, step, markReviewed])
}
