'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Project } from '@/lib/schema'
import { useDesignHealth } from '../DesignHealth'
import { useWorkspace } from '../Workspace'
import { Seg, Switch, cx } from '../ui'
import { AnalystLens } from './AnalystLens'
import { Filmstrip, PagerControls } from './ChoiceTaskPager'
import { QualtricsPreview } from './QualtricsPreview'
import { RespondentCard } from './RespondentCard'
import { groupByBlock, orderedAlternatives, orderedAttributes } from './model'

type Skin = 'studio' | 'qualtrics'

const SKINS = [
  { value: 'studio' as const, label: 'Studio' },
  { value: 'qualtrics' as const, label: 'Qualtrics' },
]

const NON_TEXT_INPUTS = new Set(['radio', 'checkbox', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'])

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type)
  return !!target.closest('[role="textbox"],[role="combobox"],[role="searchbox"],[role="spinbutton"]')
}

// True while the element crosses the middle fifth of the viewport, so a sliver of the
// section peeking in at the top or bottom edge does not capture J/K.
function useInViewCentre(ref: React.RefObject<HTMLElement>): React.MutableRefObject<boolean> {
  const inView = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      inView.current = true
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        inView.current = e.isIntersecting
      },
      { rootMargin: '-40% 0px -40% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return inView
}

// J/K belong to this section when focus is in it, or when nothing else holds focus and it
// sits in the middle of the viewport. Focus inside another section keeps the keys there.
function ownsShortcut(root: HTMLElement, centred: boolean): boolean {
  const active = document.activeElement
  if (active && root.contains(active)) return true
  if (!centred) return false
  const mine = root.closest('section')
  const theirs = active && active !== document.body ? active.closest('section') : null
  return !theirs || theirs === mine || !!mine?.contains(theirs)
}

export function ChoiceTaskViewer({ project }: { project: Project }) {
  const { activeTask, setActiveTask, analystLens, setAnalystLens, identityMarks, setIdentityMarks } =
    useWorkspace()
  const { byTask, priorsNonZero, violations } = useDesignHealth()
  const baseId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const centred = useInViewCentre(rootRef)
  const [skin, setSkin] = useState<Skin>('studio')
  const [chosen, setChosen] = useState<Record<string, string>>({})

  const rows = project.design?.rows
  const { groups, order } = useMemo(() => groupByBlock(rows ?? []), [rows])
  const alternatives = useMemo(() => orderedAlternatives(project), [project])
  const attributes = useMemo(() => orderedAttributes(project), [project])
  const modelled = useMemo(() => alternatives.filter((a) => !a.isOptOut), [alternatives])

  // Preview picks belong to the design they were made on.
  useEffect(() => setChosen({}), [rows])

  const found = activeTask
    ? order.findIndex((e) => e.row.block === activeTask.block && e.row.taskId === activeTask.taskId)
    : -1
  const pos = found >= 0 ? found : 0
  const current = order[pos]

  // Default to the first choice task, and recover when the active one leaves the design.
  useEffect(() => {
    if (found < 0 && order.length > 0) {
      setActiveTask({ block: order[0].row.block, taskId: order[0].row.taskId })
    }
  }, [found, order, setActiveTask])

  const select = useCallback(
    (i: number) => {
      const e = order[i]
      if (e) setActiveTask({ block: e.row.block, taskId: e.row.taskId })
    },
    [order, setActiveTask],
  )
  const step = useCallback(
    (delta: 1 | -1) => {
      const next = pos + delta
      if (next >= 0 && next < order.length) select(next)
    },
    [pos, order.length, select],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k !== 'j' && k !== 'k') return
      if (isTextEntry(e.target)) return
      const root = rootRef.current
      if (!root || !ownsShortcut(root, centred.current)) return
      e.preventDefault()
      step(k === 'j' ? 1 : -1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [centred, step])

  if (!current) return null

  const taskIds = new Set(order.map((e) => e.row.taskId))
  const tabId = (i: number) => `${baseId}-tab-${i}`
  const panelId = `${baseId}-panel`
  const key = `${current.row.block}:${current.row.taskId}`
  const cardMax = `${Math.max(620, 180 + alternatives.length * 120)}px`

  return (
    <div ref={rootRef}>
      <div className="mb-[18px] flex flex-wrap items-center gap-x-[18px] gap-y-3">
        <PagerControls
          pos={pos}
          total={order.length}
          current={current}
          showBlock={taskIds.size < order.length}
          onStep={step}
        />
        <Filmstrip
          project={project}
          groups={groups}
          order={order}
          pos={pos}
          byTask={byTask}
          violationsByRow={violations.byRow}
          bars={modelled}
          panelId={panelId}
          tabId={tabId}
          onSelect={select}
          className="order-last min-w-0 basis-full xl:order-none xl:basis-0 xl:flex-1"
        />
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <Seg ariaLabel="Respondent skin" options={SKINS} value={skin} onChange={setSkin} />
          <Switch checked={analystLens} onChange={setAnalystLens} label="Analyst lens" />
        </div>
      </div>

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(pos)}
        style={{ '--card-max': cardMax } as CSSProperties}
        className={cx('grid items-start gap-6', analystLens && 'xl:grid-cols-[minmax(0,1fr)_360px]')}
      >
        <div className={cx('w-full min-w-0 max-w-[var(--card-max)]', analystLens && 'xl:max-w-none')}>
          {skin === 'studio' ? (
            <RespondentCard
              project={project}
              entry={current}
              alternatives={alternatives}
              attributes={attributes}
              identityMarks={identityMarks}
              onIdentityMarks={setIdentityMarks}
              chosen={chosen[key]}
              onChoose={(altId) => setChosen((m) => ({ ...m, [key]: altId }))}
              radioName={`${baseId}-choice-b${current.row.block}-t${current.row.taskId}`}
            />
          ) : (
            <QualtricsPreview
              project={project}
              entry={current}
              alternatives={alternatives}
              attributes={attributes}
            />
          )}
        </div>
        {analystLens && (
          <AnalystLens
            project={project}
            entry={current}
            diag={byTask[current.rowIndex]}
            violated={violations.groups
              .filter((g) => g.tasks.some((t) => t.block === current.row.block && t.taskId === current.row.taskId))
              .map((g) => g.label)}
            alternatives={modelled}
            attributes={attributes}
            priorsNonZero={priorsNonZero}
            className="w-full min-w-0 max-w-[var(--card-max)] xl:max-w-none"
          />
        )}
      </div>
    </div>
  )
}
