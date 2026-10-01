import type { Design, DesignRow } from './schema'

/**
 * The design's rows with blocks numbered 1…B in order, and B. Exports assign each respondent a
 * block from 1 to B, so a stored numBlocks larger than the blocks that have rows, or a gap in the
 * numbering (1 and 3), would send respondents to an empty block. Every exporter goes through this.
 */
export function exportBlocks(design: Design): { rows: DesignRow[]; numBlocks: number } {
  const labels = Array.from(new Set(design.rows.map((r) => r.block))).sort((a, b) => a - b)
  const number = new Map(labels.map((b, i) => [b, i + 1]))
  const contiguous = labels.every((b, i) => b === i + 1)
  return {
    rows: contiguous ? design.rows : design.rows.map((r) => ({ ...r, block: number.get(r.block)! })),
    numBlocks: Math.max(1, labels.length),
  }
}

/** A block count the generator can fill: a whole number from 1 to the number of choice tasks. */
export function clampBlocks(numBlocks: number, numTasks: number): number {
  const tasks = Math.max(1, Math.floor(Number.isFinite(numTasks) ? numTasks : 1))
  const blocks = Math.floor(Number.isFinite(numBlocks) ? numBlocks : 1)
  return Math.min(Math.max(1, blocks), tasks)
}
