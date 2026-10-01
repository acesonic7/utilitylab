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
import {
  addStudy,
  archiveDesign,
  blankStudy,
  deleteStudy,
  designHistory,
  duplicateStudy,
  exampleStudy,
  hasStoredStudies,
  listStudies,
  loadLibrary,
  openStudy,
  readStudy,
  readStudyRaw,
  saveStudy,
  setDesignHistory,
  type ArchivedDesign,
  type HistoryWrite,
  type StudyMeta,
} from '@/lib/library'
import { downloadText, parseProjectFile, projectFileName, serializeProjectFile } from '@/lib/projectFile'
import { ensureIdentitySlots } from '@/lib/altIdentity'

import { DesignHealthProvider } from './DesignHealth'
import { LatestProjectProvider, type SetProject } from './ProjectStore'
import { WorkspaceProvider } from './Workspace'
import ProjectHeader from './ProjectHeader'
import { AppShell } from './shell/AppShell'
import { StudyErrorBoundary } from './StudyErrorBoundary'
import { ShellSkeleton } from './shell/ShellSkeleton'
import { ProgressProvider } from './shell/Progress'
import { markSaveFailed, markSaved } from './shell/SavedIndicator'
import { LibraryContext, type LibraryApi } from './library/LibraryContext'
import { StudyLibrary } from './library/StudyLibrary'
import { NewStudyDialog } from './library/NewStudyDialog'
import { Landing } from './landing/Landing'
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
  const [studies, setStudies] = useState<StudyMeta[]>([])
  const [unreadable, setUnreadable] = useState<string[]>([])
  const [history, setHistory] = useState<ArchivedDesign[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  // Earlier designs that did not fit in browser storage, per study. They live only in this tab,
  // so they are listed, included in project downloads, and guarded by a leave-page warning.
  const overflow = useRef(new Map<string, ArchivedDesign[]>())
  // Earlier designs an imported file had that could not be read.
  const [historyNote, setHistoryNote] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  // The landing screen: 'first' on a first visit (with its entrance), 'return' when reopened from the logo.
  const [landing, setLanding] = useState<'first' | 'return' | null>(null)

  const refreshStudies = useCallback(() => setStudies(listStudies()), [])

  // Stored entries plus any that only this tab holds, newest first.
  const fullHistory = useCallback((id: string): ArchivedDesign[] => {
    const held = overflow.current.get(id) ?? []
    const stored = designHistory(id).filter((a) => !held.some((h) => h.design.uploadedAt === a.design.uploadedAt))
    return [...stored, ...held].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt))
  }, [])

  // Every change to a study's earlier designs goes through here, so none is dropped silently.
  const storeHistory = useCallback((id: string, write: HistoryWrite) => {
    if (write.overflow.length) overflow.current.set(id, write.overflow)
    else overflow.current.delete(id)
    if (id === latest.current?.id) setHistory([...write.stored, ...write.overflow])
  }, [])

  // Every update stores identity slots, so reordering alternatives never repaints them.
  // The updater form runs against the latest project, not the caller's render-time copy.
  // Replacing or clearing a study's design keeps the previous one in its design history.
  const setProject = useCallback<SetProject>((update) => {
    const base = latest.current
    const p = typeof update === 'function' ? (base ? update(base) : null) : update
    if (!p || p === base) return
    const next = ensureIdentitySlots(p)
    if (base && base.id === next.id && base.design && base.design.uploadedAt !== next.design?.uploadedAt) {
      storeHistory(base.id, archiveDesign(base.id, base.design, fullHistory(base.id)))
    }
    latest.current = next
    setProjectState(next)
  }, [fullHistory, storeHistory])

  // Switching studies replaces the project wholesale, with no design archiving.
  const switchTo = useCallback((p: Project) => {
    const next = ensureIdentitySlots(p)
    latest.current = next
    setProjectState(next)
    setHistory(fullHistory(next.id))
    setHistoryNote(null)
    setStudies(listStudies())
    setLanding(null)
  }, [fullHistory])

  const getProject = useCallback(() => latest.current as Project, [])

  // The first project shows at once; only later edits are deferred.
  const deferred = useDeferredValue(project) ?? project

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

  // A first visit stays on the landing screen, and nothing is stored until a choice is made there.
  useEffect(() => {
    if (!hasStoredStudies()) return setLanding('first')
    const lib = loadLibrary()
    setUnreadable(lib.unreadable)
    switchTo(lib.project)
  }, [switchTo])

  useEffect(() => {
    if (!project) return
    const r = saveStudy(project)
    if (r.ok) {
      markSaved()
      setSaveError(null)
    } else {
      markSaveFailed(r.error)
      setSaveError(r.error)
    }
    setStudies(listStudies())
  }, [project])

  // Leaving the page would lose edits that failed to save, or earlier designs held only in this tab.
  const unsaved = !!saveError || overflow.current.size > 0
  useEffect(() => {
    if (!unsaved) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved])

  // The page is client-rendered, so the metadata title template never sees the project name.
  // The landing screen and the workspace each open at the top, whatever the other was scrolled to.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [landing])

  const docTitle = landing
    ? 'UtilityLab'
    : project
      ? `${project.name || 'Untitled stated choice experiment'} · UtilityLab`
      : null
  useEffect(() => {
    if (docTitle !== null) document.title = docTitle
  }, [docTitle])

  const create = useCallback(
    (p: Project, opts?: { fromExample?: boolean; history?: ArchivedDesign[] }) => {
      const r = addStudy(p, opts)
      if (!r.ok) {
        setSaveError(r.error)
        return r.error
      }
      switchTo(p)
      if (opts?.history?.length) storeHistory(p.id, setDesignHistory(p.id, opts.history))
      setLibraryOpen(false)
      setNewOpen(false)
      return null
    },
    [switchTo, storeHistory],
  )

  const library = useMemo<LibraryApi>(
    () => ({
      studies,
      unreadable,
      activeId: project?.id ?? '',
      history,
      unsavedHistory: project ? overflow.current.get(project.id)?.length ?? 0 : 0,
      historyNote,
      saveError,
      openLibrary: () => setLibraryOpen(true),
      goHome: () => setLanding('return'),
      startNew: () => {
        setLibraryOpen(false)
        setNewOpen(true)
      },
      createStudy: (opts) => create(blankStudy({ ...opts, starterAttribute: false })),
      newFromExample: () => void create(exampleStudy(), { fromExample: true }),
      open: (id) => {
        const p = openStudy(id)
        if (p) {
          switchTo(p)
          setLibraryOpen(false)
        } else setUnreadable((u) => (u.includes(id) ? u : [...u, id]))
      },
      duplicate: (id) => {
        const src = id === latest.current?.id ? latest.current : readStudy(id)
        if (src) create(duplicateStudy(src), { history: fullHistory(id) })
      },
      remove: (id) => {
        deleteStudy(id)
        setUnreadable((u) => u.filter((x) => x !== id))
        if (id !== latest.current?.id) return refreshStudies()
        const nextMeta = listStudies()[0]
        const next = nextMeta ? openStudy(nextMeta.id) : null
        if (next) switchTo(next)
        else create(exampleStudy(), { fromExample: true })
      },
      importFile: async (file) => {
        const parsed = parseProjectFile(await file.text(), listStudies().map((m) => m.id))
        if (!parsed.ok) return parsed.error
        const err = create({ ...parsed.project, updatedAt: new Date().toISOString() }, { history: parsed.designHistory })
        if (!err && parsed.droppedHistory > 0) {
          setHistoryNote(
            `${parsed.droppedHistory} earlier design${parsed.droppedHistory === 1 ? '' : 's'} in the file could not be read and ${parsed.droppedHistory === 1 ? 'was' : 'were'} left out.`,
          )
        }
        return err
      },
      download: (id) => {
        const p = id === latest.current?.id ? latest.current : readStudy(id)
        if (p) downloadText(projectFileName(p), serializeProjectFile(p, fullHistory(id)))
      },
      downloadRaw: (id) => {
        const raw = readStudyRaw(id)
        if (raw !== null) downloadText(`${id}.unreadable.json`, raw)
      },
      restoreDesign: (entry) => {
        const id = latest.current?.id
        if (!id) return
        setProject((p) => ({ ...p, design: entry.design, updatedAt: new Date().toISOString() }))
        const rest = fullHistory(id).filter((a) => a.design.uploadedAt !== entry.design.uploadedAt)
        storeHistory(id, setDesignHistory(id, rest))
      },
      forgetDesign: (entry) => {
        const id = latest.current?.id
        if (!id) return
        const rest = fullHistory(id).filter((a) => a.design.uploadedAt !== entry.design.uploadedAt)
        storeHistory(id, setDesignHistory(id, rest))
      },
      current: getProject,
    }),
    [studies, unreadable, project?.id, history, historyNote, saveError, create, switchTo, refreshStudies, setProject, getProject, fullHistory, storeHistory],
  )

  // The example already in the library if there is one, otherwise a fresh copy. When the browser
  // refuses to store it, the example still opens, unsaved, as it did before the landing screen.
  const exploreExample = () => {
    const existing = listStudies().find((m) => m.fromExample)
    const stored = existing ? openStudy(existing.id) : null
    if (stored) return switchTo(stored)
    const fresh = exampleStudy()
    if (create(fresh, { fromExample: true }) !== null) switchTo(fresh)
  }

  return (
    <LibraryContext.Provider value={library}>
    <WorkspaceProvider>
      <LatestProjectProvider get={getProject}>
        {landing ? (
          <Landing
            intro={landing === 'first'}
            currentStudy={project ? project.name : null}
            onContinue={() => setLanding(null)}
            onExample={exploreExample}
            onNew={library.startNew}
            onOpenFile={library.importFile}
          />
        ) : !project || !deferred ? (
          <ShellSkeleton />
        ) : (
        <StudyErrorBoundary key={project.id} studyId={project.id} studyName={project.name}>
        <DesignHealthProvider project={deferred}>
          <ProgressProvider project={project}>
          <AppShell project={project} header={<ProjectHeader project={project} />}>
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
          </ProgressProvider>
        </DesignHealthProvider>
        </StudyErrorBoundary>
        )}
        <NewStudyDialog open={newOpen} onClose={() => setNewOpen(false)} />
      </LatestProjectProvider>
    </WorkspaceProvider>
      <StudyLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </LibraryContext.Provider>
  )
}
