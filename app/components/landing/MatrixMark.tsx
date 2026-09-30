'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { travelModeExample } from '@/lib/example'
import { altIdentity } from '@/lib/altIdentity'
import type { SearchTrace } from '@/lib/searchTrace'
import { cx } from '../ui'

// search: block 1 of the example design is optimised, centre stage. settle: the middle 3×3
// becomes the logo. dock: the logo glides to its place in the header. done: the static mark.
export type IntroPhase = 'search' | 'settle' | 'dock' | 'done'

const SEARCH_MS = 1500
const HOLD_MS = 260
const SETTLE_MS = 520
const DOCK_MS = 720

export type MatrixIntro = {
  trace: SearchTrace | null
  phase: IntroPhase
  frame: number
  skip: () => void
}

/** Replays a D-optimal search on the example study, frame by frame, when `play` is set. */
export function useMatrixIntro(play: boolean, search: SearchTrace): MatrixIntro {
  const trace = play ? search : null
  const [phase, setPhase] = useState<IntroPhase>(play ? 'search' : 'done')
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (phase !== 'search' || !trace) return
    const last = trace.frames.length - 1
    const t =
      frame >= last
        ? window.setTimeout(() => setPhase('settle'), HOLD_MS)
        : window.setTimeout(() => setFrame((f) => f + 1), SEARCH_MS / last)
    return () => window.clearTimeout(t)
  }, [phase, frame, trace])

  useEffect(() => {
    if (phase !== 'settle' && phase !== 'dock') return
    const settling = phase === 'settle'
    const t = window.setTimeout(() => setPhase(settling ? 'dock' : 'done'), settling ? SETTLE_MS : DOCK_MS)
    return () => window.clearTimeout(t)
  }, [phase])

  const skip = useCallback(() => setPhase('done'), [])
  return { trace, phase, frame, skip }
}

// Geometry of the Matrix U (see Logo): 5-unit cells on a 6.5-unit pitch inside a 28-unit tile.
const PITCH = 6.5
const TILE_COLS = 3
const STAGE_SCALE = 3.2

type TileRole = 'u' | 'chosen' | 'empty'

function tileRole(row: number, col: number): TileRole {
  if (col === 1) return row === 2 ? 'u' : 'empty'
  return col === 0 && row === 2 ? 'chosen' : 'u'
}

const FADE = 'opacity 380ms ease, fill 380ms ease'

export function MatrixMark({ intro, size = 56 }: { intro: MatrixIntro; size?: number }) {
  const { trace, phase, frame } = intro
  const ref = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<string | null>(null)

  // Centre stage for the search: measured once, before the first paint.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !trace) return
    const r = el.getBoundingClientRect()
    const stripWidth = ((trace.columns.length * PITCH) / 28) * r.width
    const scale = Math.min(STAGE_SCALE, (window.innerWidth - 40) / stripWidth)
    const dx = window.innerWidth / 2 - (r.left + r.width / 2)
    const dy = window.innerHeight * 0.44 - (r.top + r.height / 2)
    setStage(`translate(${dx}px, ${dy}px) scale(${scale})`)
  }, [trace])

  const searching = phase === 'search'
  const staged = searching || phase === 'settle'
  const live = trace && phase !== 'done' ? trace : null
  const cols = live ? live.columns.length : TILE_COLS
  const side = Math.floor((cols - TILE_COLS) / 2)
  const current = live ? live.frames[Math.min(frame, live.frames.length - 1)] : null
  // The three choice tasks of block 1: what one respondent would see.
  const tasks = live ? live.blocks.flatMap((b, i) => (b === 1 ? [i] : [])) : []

  const wrapper: CSSProperties = {
    width: size,
    height: size,
    transform: staged && stage ? stage : undefined,
    // Only the way back to the header is animated, never the jump to centre stage.
    transition: trace && !staged ? `transform ${DOCK_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : undefined,
    // Hidden until measured, so the mark never shows in the header first.
    visibility: trace && !stage ? 'hidden' : undefined,
  }

  return (
    <div ref={ref} aria-hidden="true" className="relative z-10 shrink-0" style={wrapper}>
      <svg viewBox="0 0 28 28" width={size} height={size} overflow="visible" focusable="false" className="block">
        <rect
          x="0.5"
          y="0.5"
          width="27"
          height="27"
          rx="6.5"
          strokeWidth="1"
          className="fill-ink stroke-ink dark:fill-surface-3 dark:stroke-line-2"
          style={{ opacity: searching ? 0 : 1, transition: FADE }}
        />
        {[0, 1, 2].map((row) =>
          Array.from({ length: cols }, (_, col) => {
            const tileCol = col - side
            const inTile = tileCol >= 0 && tileCol < TILE_COLS
            const role = inTile ? tileRole(row, tileCol) : null
            const column = live?.columns[col]
            const level = current?.levels[tasks[row]]?.[col] ?? -1
            // Deeper tint for a higher level, as in the design matrix.
            const strength =
              column && level >= 0 ? 0.26 + (0.74 * level) / Math.max(1, column.levelCount - 1) : 0.12
            const tint = column
              ? `rgb(var(${altIdentity(travelModeExample, column.altId).cssVar}) / ${strength.toFixed(2)})`
              : undefined
            const gone = !searching && (role === null || role === 'empty')
            const distance = Math.abs(col - (cols - 1) / 2)
            return (
              <rect
                key={`${row}.${tileCol}`}
                x={5 + PITCH * tileCol}
                y={5 + PITCH * row}
                width="5"
                height="5"
                rx="1.3"
                className={cx(
                  !searching && role === 'u' && 'fill-paper dark:fill-ink',
                  !searching && role === 'chosen' && 'fill-accent',
                )}
                style={{
                  fill: searching || gone ? tint : undefined,
                  opacity: gone ? 0 : 1,
                  transition: FADE,
                  // The strip closes in on the logo from both ends.
                  transitionDelay:
                    !searching && role === null ? `${Math.round((cols / 2 - distance) * 28)}ms` : undefined,
                }}
              />
            )
          }),
        )}
        {live && (
          // SVG text scales with the mark and is not subject to a browser's minimum font size.
          <text
            x="14"
            y="37.5"
            textAnchor="middle"
            fontSize="3.1"
            className="fill-ink-3 font-mono"
            style={{ opacity: searching ? 1 : 0, transition: 'opacity 240ms ease' }}
          >
            D-optimal search · D-error{' '}
            <tspan className="tnum fill-ink">
              {current && Number.isFinite(current.dError) ? current.dError.toFixed(3) : '—'}
            </tspan>
          </text>
        )}
      </svg>
    </div>
  )
}
