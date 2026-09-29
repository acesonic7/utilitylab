// One template for the header and every row, so the columns line up. The Parameters column only
// appears from 1440px, where the canvas reaches its full 1120px width.
export const ATTR_GRID =
  'xl:grid-cols-[160px_136px_128px_var(--applies-w)_minmax(0,1fr)_120px] min-[1440px]:grid-cols-[166px_146px_128px_var(--applies-w)_minmax(0,1fr)_96px_136px] xl:gap-x-3.5'

// Centred, so the count doesn't read as part of the ID beside it.
export const PARAMS_CELL = 'hidden text-center min-[1440px]:block'

export const COL_HEAD = 'font-mono text-12 font-normal uppercase tracking-caps text-ink-3'

// Toggle buttons are 24px with a 2px gap; the column never narrows below its header.
export function appliesWidth(n: number): number {
  return Math.max(96, n * 24 + Math.max(0, n - 1) * 2)
}
