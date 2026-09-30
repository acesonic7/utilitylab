import type { DesignRow, Project } from './schema'
import { dOptimalSearch } from './dOptimal'
import { matrixGroups } from './designMatrix'
import { cellKey } from './validation'

export type TraceColumn = { altId: string; attrId: string; levelCount: number }

export type TraceFrame = {
  dError: number
  // [choice task][column] → 0-based level index, -1 when the cell has no level.
  levels: number[][]
}

export type SearchTrace = {
  columns: TraceColumn[]
  /** Block of each choice task, in design order. */
  blocks: number[]
  frames: TraceFrame[]
  /** The design the search ended on. */
  rows: DesignRow[]
}

/**
 * Runs one start of the D-optimal search and records the design at the start and after
 * every accepted swap, so the landing screen can replay the search as it happened.
 */
export function searchTrace(
  project: Project,
  opts: { numTasks: number; numBlocks: number; rng: () => number },
): SearchTrace {
  const cols = matrixGroups(project).flatMap((g) =>
    g.columns.map((c) => ({
      key: cellKey(g.alt.id, c.attr.id),
      altId: g.alt.id,
      attrId: c.attr.id,
      ids: c.levels.map((l) => l.id),
    })),
  )
  const frames: TraceFrame[] = []
  const result = dOptimalSearch(project, {
    numTasks: opts.numTasks,
    numBlocks: opts.numBlocks,
    multistarts: 1,
    rng: opts.rng,
    onStep: (rows, dError) => {
      frames.push({ dError, levels: rows.map((r) => cols.map((c) => c.ids.indexOf(r.cells[c.key]))) })
    },
  })
  return {
    columns: cols.map((c) => ({ altId: c.altId, attrId: c.attrId, levelCount: c.ids.length })),
    blocks: result.rows.map((r) => r.block),
    frames,
    rows: result.rows,
  }
}
