'use client'

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react'
import type { Project } from '@/lib/schema'
import { loadProject, saveProject, clearProject } from '@/lib/persist'
import { travelModeExample } from '@/lib/example'
import { ensureIdentitySlots } from '@/lib/altIdentity'

import { DesignHealthProvider } from './DesignHealth'
import { LatestProjectProvider, type SetProject } from './ProjectStore'
import { WorkspaceProvider } from './Workspace'
import ProjectHeader from './ProjectHeader'
import { AppShell } from './shell/AppShell'
import { ShellSkeleton } from './shell/ShellSkeleton'
import { markSaved } from './shell/SavedIndicator'
import { SECTIONS, sectionClass } from './shell/sections'
import type { SectionId } from './Workspace'
import StructureSection from './sections/StructureSection'
import DesignSection from './sections/DesignSection'
import ChoiceTasksSection from './sections/ChoiceTasksSection'
import DiagnosticsSection from './sections/DiagnosticsSection'
import ExportSection from './sections/ExportSection'

type SectionProps = { project: Project; setProject: SetProject }

const SECTION_VIEWS: Record<SectionId, ComponentType<SectionProps>> = {
  structure: memo(StructureSection),
  design: memo(DesignSection),
  'choice-tasks': memo(ChoiceTasksSection),
  diagnostics: memo(DiagnosticsSection),
  export: memo(ExportSection),
}

// The editors render the live project; the heavier views below them render a deferred copy,
// so typing in Structure never waits on the design matrix, diagnostics or the methods paragraph.
// Rules for the deferred sections:
// - never bind an input straight to a project field; keep a local draft (see ui NumberInput);
// - write with the updater form, setProject((latest) => …), so an edit never rebuilds from the snapshot;
// - read useLatestProject() in handlers that generate, export or push.
const LIVE_SECTIONS = new Set<SectionId>(['structure'])

export default function Designer() {
  const [project, setProjectState] = useState<Project | null>(null)
  const latest = useRef<Project | null>(null)

  // Every update stores identity slots, so reordering alternatives never repaints them.
  // The updater form runs against the latest project, not the caller's render-time copy.
  const setProject = useCallback<SetProject>((update) => {
    const base = latest.current
    const p = typeof update === 'function' ? (base ? update(base) : null) : update
    if (!p || p === base) return
    const next = ensureIdentitySlots(p)
    latest.current = next
    setProjectState(next)
  }, [])

  const getProject = useCallback(() => latest.current as Project, [])

  const deferred = useDeferredValue(project)

  // Fallback for a plain object from a deferred view, which may be built on an older project:
  // apply only the top-level fields its edit changed, so it can't undo a newer edit to other fields.
  const setFromDeferred = useMemo<SetProject>(() => {
    const base = deferred
    return (update) => {
      if (typeof update === 'function') return setProject(update)
      const cur = latest.current
      if (!base || !cur || cur === base) return setProject(update)
      const merged: Record<string, unknown> = { ...cur }
      const b = base as unknown as Record<string, unknown>
      const n = update as unknown as Record<string, unknown>
      for (const k of new Set([...Object.keys(b), ...Object.keys(n)])) {
        if (b[k] !== n[k]) merged[k] = n[k]
      }
      setProject(merged as unknown as Project)
    }
  }, [deferred, setProject])

  useEffect(() => {
    setProject(loadProject())
  }, [setProject])

  useEffect(() => {
    if (!project) return
    saveProject(project)
    markSaved()
  }, [project])

  // The page is client-rendered, so the metadata title template never sees the project name.
  const docTitle = project ? project.name || 'Untitled stated choice experiment' : null
  useEffect(() => {
    if (docTitle !== null) document.title = `${docTitle} · UtilityLab`
  }, [docTitle])

  const handleReset = useCallback(() => {
    if (!window.confirm('Reset to the travel mode example? Your current edits will be lost.')) return
    clearProject()
    setProject({ ...travelModeExample })
  }, [setProject])

  if (!project || !deferred) return <ShellSkeleton />

  return (
    <WorkspaceProvider>
      <LatestProjectProvider get={getProject}>
        <DesignHealthProvider project={deferred}>
          <AppShell project={project} header={<ProjectHeader project={project} onReset={handleReset} />}>
            {SECTIONS.map(({ id, title }) => {
              const View = SECTION_VIEWS[id]
              const live = LIVE_SECTIONS.has(id)
              return (
                <section key={id} id={id} aria-label={title} className={sectionClass}>
                  <View
                    project={live ? project : deferred}
                    setProject={live ? setProject : setFromDeferred}
                  />
                </section>
              )
            })}
          </AppShell>
        </DesignHealthProvider>
      </LatestProjectProvider>
    </WorkspaceProvider>
  )
}
