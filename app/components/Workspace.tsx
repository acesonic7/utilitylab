'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type SectionId = 'structure' | 'design' | 'choice-tasks' | 'diagnostics' | 'export'

export type TaskRef = { block: number; taskId: number }

/** The Upload or Generate panel open in 02 Design, if any. */
export type DesignPanel = 'upload' | 'generate'

export type GoToOptions = { task?: TaskRef; lens?: boolean; panel?: DesignPanel }

/** Stable for the whole session: components that only navigate never re-render on J/K. */
export type WorkspaceActions = {
  setActiveTask: (t: TaskRef | null) => void
  setAnalystLens: (b: boolean) => void
  setIdentityMarks: (b: boolean) => void
  setDesignPanel: (p: DesignPanel | null) => void
  goTo: (section: SectionId, opts?: GoToOptions) => void
}

export type WorkspaceState = {
  activeTask: TaskRef | null
  analystLens: boolean
  identityMarks: boolean
}

export type Workspace = WorkspaceState & WorkspaceActions

const ActionsContext = createContext<WorkspaceActions | null>(null)
const StateContext = createContext<WorkspaceState | null>(null)
// Apart from the rest of the state, so the design section doesn't re-render on J/K.
const DesignPanelContext = createContext<DesignPanel | null>(null)

function scrollToSection(section: SectionId, focusHeading = true) {
  const el = document.getElementById(section)
  if (!el) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  // An opened design panel takes focus itself.
  if (!focusHeading) return
  // Move focus with the viewport so keyboard and screen reader users land in the section.
  const target = el.querySelector<HTMLElement>('h2') ?? el
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeTask, setActiveTaskState] = useState<TaskRef | null>(null)
  const [analystLens, setAnalystLens] = useState(true)
  const [identityMarks, setIdentityMarks] = useState(true)
  const [designPanel, setDesignPanel] = useState<DesignPanel | null>(null)

  const setActiveTask = useCallback((t: TaskRef | null) => {
    setActiveTaskState((prev) =>
      prev && t && prev.block === t.block && prev.taskId === t.taskId ? prev : t,
    )
  }, [])

  const goTo = useCallback(
    (section: SectionId, opts?: GoToOptions) => {
      if (opts?.task) setActiveTask(opts.task)
      if (opts?.lens !== undefined) setAnalystLens(opts.lens)
      if (opts?.panel) setDesignPanel(opts.panel)
      if (typeof window === 'undefined') return
      // Wait a frame so layout driven by the state above settles before scrolling.
      window.requestAnimationFrame(() => scrollToSection(section, !opts?.panel))
    },
    [setActiveTask],
  )

  const actions = useMemo<WorkspaceActions>(
    () => ({ setActiveTask, setAnalystLens, setIdentityMarks, setDesignPanel, goTo }),
    [setActiveTask, goTo],
  )
  const state = useMemo<WorkspaceState>(
    () => ({ activeTask, analystLens, identityMarks }),
    [activeTask, analystLens, identityMarks],
  )

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>
        <DesignPanelContext.Provider value={designPanel}>{children}</DesignPanelContext.Provider>
      </StateContext.Provider>
    </ActionsContext.Provider>
  )
}

/** Navigation and setters only; never changes, so it doesn't re-render its component. */
export function useWorkspaceActions(): WorkspaceActions {
  const ctx = useContext(ActionsContext)
  if (!ctx) throw new Error('useWorkspaceActions must be used inside <WorkspaceProvider>')
  return ctx
}

/** State and actions; re-renders whenever the active choice task, lens or marks change. */
export function useWorkspace(): Workspace {
  const actions = useWorkspaceActions()
  const state = useContext(StateContext)
  const merged = useMemo(() => (state ? { ...state, ...actions } : null), [state, actions])
  if (!merged) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return merged
}

export function useDesignPanel(): DesignPanel | null {
  return useContext(DesignPanelContext)
}
