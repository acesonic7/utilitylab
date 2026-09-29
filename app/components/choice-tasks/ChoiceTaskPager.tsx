'use client'

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { Alternative, Project } from '@/lib/schema'
import type { TaskDiagnostics } from '@/lib/diagnostics'
import { altIdentity, altStyle } from '@/lib/altIdentity'
import { AltGlyph, cx, IconButton } from '../ui'
import { rovingIndex } from '../ui/roving'
import { plural } from '@/lib/text'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from './icons'
import type { BlockGroup, TaskEntry } from './model'

export function taskKey(e: TaskEntry): string {
  return `${e.row.block}:${e.row.taskId}:${e.rowIndex}`
}

// aria-disabled rather than disabled, so a keyboard user who steps onto the first or
// last choice task keeps focus on the button instead of dropping to <body>.
function StepButton({
  label,
  shortcut,
  off,
  onPress,
  children,
}: {
  label: string
  shortcut: string
  off: boolean
  onPress: () => void
  children: ReactNode
}) {
  return (
    <IconButton
      label={label}
      title={`${label} (${shortcut})`}
      aria-keyshortcuts={shortcut}
      aria-disabled={off || undefined}
      variant="secondary"
      onClick={() => {
        if (!off) onPress()
      }}
      className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:border-line-2"
    >
      {children}
    </IconButton>
  )
}

export function PagerControls({
  pos,
  total,
  current,
  showBlock,
  onStep,
}: {
  pos: number
  total: number
  current: TaskEntry
  showBlock: boolean
  onStep: (delta: 1 | -1) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <StepButton label="Previous choice task" shortcut="K" off={pos <= 0} onPress={() => onStep(-1)}>
        <ChevronLeftIcon />
      </StepButton>
      <span aria-live="polite" className="whitespace-nowrap px-2 text-16 font-semibold text-ink">
        Choice task <span className="tnum">{current.row.taskId}</span>{' '}
        <span className="font-normal text-ink-3">
          of <span className="tnum">{total}</span>
          {showBlock && <> · Block {current.row.block}</>}
        </span>
      </span>
      <StepButton label="Next choice task" shortcut="J" off={pos >= total - 1} onPress={() => onStep(1)}>
        <ChevronRightIcon />
      </StepButton>
    </div>
  )
}

export function Filmstrip({
  project,
  groups,
  order,
  pos,
  byTask,
  violationsByRow,
  bars,
  panelId,
  tabId,
  onSelect,
  className,
}: {
  project: Project
  groups: BlockGroup[]
  order: TaskEntry[]
  pos: number
  byTask: TaskDiagnostics[]
  /** Constraint violations per design row, aligned with byTask. */
  violationsByRow: number[]
  /** Non-opt-out alternatives in display order. */
  bars: Alternative[]
  panelId: string
  tabId: (pos: number) => string
  onSelect: (pos: number) => void
  className?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const posOf = new Map(order.map((e, i) => [taskKey(e), i]))

  // Keep the selected thumbnail in view without scrolling the page.
  useEffect(() => {
    const box = scrollRef.current
    const el = tabRefs.current[pos]
    if (!box || !el) return
    const b = box.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (r.left < b.left) box.scrollLeft -= b.left - r.left + 8
    else if (r.right > b.right) box.scrollLeft += r.right - b.right + 8
  }, [pos])

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const next = rovingIndex(e, i, order.length)
    if (next === null) return
    e.preventDefault()
    onSelect(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div ref={scrollRef} className={cx('relative -m-1.5 overflow-x-auto p-1.5', className)}>
      <div role="tablist" aria-label="Choice tasks" className="flex w-max items-end gap-3.5">
        {groups.map((g) => (
          <div key={g.block} className="flex flex-col gap-[5px]">
            <span aria-hidden="true" className="pl-0.5 font-mono text-12 leading-4 text-ink-3">
              Block {g.block}
            </span>
            <div className="flex gap-1.5">
              {g.tasks.map((entry) => {
                const i = posOf.get(taskKey(entry)) ?? 0
                const on = i === pos
                const diag = byTask[entry.rowIndex]
                const v = violationsByRow[entry.rowIndex] ?? 0
                const n = (diag?.findings.length ?? 0) + v
                const dominated = new Set(diag?.dominated.map((d) => d.altId) ?? [])
                const findingsText =
                  n === 0
                    ? 'no findings'
                    : v > 0
                      ? `${plural(n, 'finding')} including ${plural(v, 'constraint violation')}`
                      : plural(n, 'finding')
                const domText = bars
                  .filter((a) => dominated.has(a.id))
                  .map((a) => altIdentity(project, a.id).label)
                const summary = domText.length > 0 ? `${findingsText}; dominated: ${domText.join(', ')}` : findingsText
                return (
                  <button
                    key={taskKey(entry)}
                    ref={(el) => {
                      tabRefs.current[i] = el
                    }}
                    type="button"
                    role="tab"
                    id={tabId(i)}
                    aria-selected={on}
                    aria-controls={panelId}
                    aria-label={`Choice task ${entry.row.taskId}, block ${entry.row.block}, ${summary}`}
                    title={`Choice task ${entry.row.taskId} · ${summary}`}
                    tabIndex={on ? 0 : -1}
                    onClick={() => onSelect(i)}
                    onKeyDown={(e) => onKeyDown(e, i)}
                    className={cx(
                      'focus-ring grid grid-cols-[auto_auto] grid-rows-[auto_auto] items-end gap-x-[7px] rounded-well bg-surface py-1.5 pl-[7px] pr-2 transition-shadow',
                      on ? 'shadow-[0_0_0_1.5px_rgb(var(--ink))]' : 'shadow-hairline hover:shadow-hairline-2',
                    )}
                  >
                    <span
                      className={cx(
                        'col-start-1 row-start-1 self-start text-left font-mono text-12 leading-none',
                        on ? 'text-ink' : 'text-ink-3',
                      )}
                    >
                      {entry.row.taskId}
                    </span>
                    <span className="col-start-1 row-start-2 mt-[5px] text-left text-12 font-semibold leading-none">
                      {n > 0 ? (
                        <span className={cx('tnum', v > 0 ? 'text-risk' : 'text-caution')}>{n}</span>
                      ) : (
                        <CheckIcon className="size-3 text-ok" />
                      )}
                    </span>
                    <span
                      aria-hidden="true"
                      className="col-start-2 row-span-2 row-start-1 flex items-end gap-[3px]"
                    >
                      {bars.map((alt) => {
                        const id = altIdentity(project, alt.id)
                        const d = dominated.has(alt.id)
                        return (
                          <span key={alt.id} style={altStyle(id)} className="flex w-2 flex-col items-center gap-0.5">
                            <span
                              className={cx(
                                'w-full rounded-[2px]',
                                d ? 'hatch-dense h-3 shadow-[inset_0_0_0_1px_rgb(var(--alt)/0.7)]' : 'bg-alt h-5',
                              )}
                            />
                            <AltGlyph identity={id} size={8} className="align-top" />
                          </span>
                        )
                      })}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
