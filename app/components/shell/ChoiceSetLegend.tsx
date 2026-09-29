import { useId } from 'react'
import type { Project } from '@/lib/schema'
import { altIdentities } from '@/lib/altIdentity'
import { AltGlyph } from '../ui'

const ROW = 29

// Brace with fixed-size curls; only the straight runs stretch with the number of rows.
function bracePath(h: number): string {
  const run = Math.max(0, (h - 50) / 2)
  return `M10.5 1C6 1 6.2 5 6.2 12v${run}c0 7-1.6 11.8-5 13 3.4 1.2 5 6 5 13v${run}c0 7-.2 11 4.3 11`
}

function Brace({ height, flip }: { height: number; flip?: boolean }) {
  return (
    <svg
      viewBox={`0 0 12 ${height}`}
      width={12}
      height={height}
      aria-hidden="true"
      focusable="false"
      className="fill-none stroke-ink-4"
      strokeWidth={1.2}
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d={bracePath(height)} />
    </svg>
  )
}

export function ChoiceSetLegend({ project }: { project: Project }) {
  const titleId = useId()
  const ids = altIdentities(project)
  const height = Math.max(60, ids.length * ROW)

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-panel bg-surface px-2.5 pb-3 pt-3.5 shadow-hairline"
    >
      <div className="flex items-baseline justify-between px-0.5">
        <span id={titleId} className="text-13 font-semibold text-ink">
          Choice set
        </span>
        <span className="font-mono text-12 text-ink-3">J = {ids.length}</span>
      </div>

      {ids.length === 0 ? (
        <p className="mt-2.5 px-0.5 text-12 text-ink-3">No alternatives yet.</p>
      ) : (
        <div className="mt-2.5 grid grid-cols-[auto_12px_minmax(0,1fr)_12px] items-center">
          <span
            aria-hidden="true"
            className="whitespace-nowrap pr-1.5 font-display text-16 font-medium italic leading-none text-ink-2"
          >
            C =
          </span>
          <Brace height={height} />
          <ul className="min-w-0 px-1">
            {ids.map((id) => (
              <li
                key={id.altId}
                className="flex h-[29px] min-w-0 items-center gap-1.5 pl-0.5 text-13 font-medium text-ink"
              >
                <AltGlyph identity={id} />
                <span className="truncate" title={id.label}>
                  {id.label}
                </span>
              </li>
            ))}
          </ul>
          <Brace height={height} flip />
        </div>
      )}

      <p className="mx-0.5 mt-2.5 border-t border-dashed border-line-2 pt-2.5 text-12 text-ink-3">
        Each alternative keeps its color and glyph in every view: editor, choice tasks, design
        matrix and diagnostics.
      </p>
    </section>
  )
}
