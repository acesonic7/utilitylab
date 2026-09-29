'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Project } from '@/lib/schema'

/** Rebuilds the project from the latest committed one, never from a render-time snapshot. */
export type ProjectUpdater = (latest: Project) => Project

/**
 * Every section gets this setter. Sections below Structure render a deferred copy of the project,
 * so their writes use the updater form and their actions read `useLatestProject()` at click time.
 */
export type SetProject = (next: Project | ProjectUpdater) => void

const LatestProjectContext = createContext<(() => Project) | null>(null)

export function LatestProjectProvider({ get, children }: { get: () => Project; children: ReactNode }) {
  return <LatestProjectContext.Provider value={get}>{children}</LatestProjectContext.Provider>
}

/** A stable getter for the latest project; call it inside handlers (generate, export, push), not while rendering. */
export function useLatestProject(): () => Project {
  const get = useContext(LatestProjectContext)
  if (!get) throw new Error('useLatestProject must be used inside <LatestProjectProvider>')
  return get
}
