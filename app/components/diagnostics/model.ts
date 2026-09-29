import type { ValidationConfig } from '@/lib/schema'
import type { DesignHealth } from '../DesignHealth'
import type { ConstraintViolations } from '@/lib/diagnosticsView'
import { plural } from '@/lib/text'

export type CheckKey = 'dominance' | 'correlation' | 'overlap' | 'balance' | 'constraints'
export type FilterKey = 'all' | CheckKey

export const CHECK_ORDER: CheckKey[] = ['dominance', 'correlation', 'overlap', 'balance', 'constraints']

export const CHECK_LABEL: Record<CheckKey, string> = {
  dominance: 'Dominance',
  correlation: 'Correlation',
  overlap: 'Overlap',
  balance: 'Level balance',
  constraints: 'Constraints',
}

export type CheckTally = { total: number; concerns: number; warnings: number; enabled: boolean }

export function checkTallies(
  counts: DesignHealth['counts'],
  cfg: ValidationConfig,
  violations: ConstraintViolations,
): Record<CheckKey, CheckTally> {
  const t = (k: 'dominance' | 'correlation' | 'overlap' | 'balance'): CheckTally => {
    const c = counts[k] ?? { warning: 0, concern: 0 }
    return { total: c.warning + c.concern, concerns: c.concern, warnings: c.warning, enabled: cfg[k].enabled }
  }
  return {
    dominance: t('dominance'),
    correlation: t('correlation'),
    overlap: t('overlap'),
    balance: t('balance'),
    // A violated constraint is a hard error, so it ranks with concerns.
    constraints: { total: violations.total, concerns: violations.total, warnings: 0, enabled: true },
  }
}

/** Which figures a filter keeps on screen. */
export function showsFigure(filter: FilterKey, figure: 'map' | 'correlation' | 'balance'): boolean {
  if (filter === 'all') return true
  if (figure === 'map') return filter === 'dominance' || filter === 'overlap'
  return filter === figure
}

/** The section lede: same totals as the "All" chip, constraint violations counted as concerns. */
export function verdict(counts: DesignHealth['counts'], violations: ConstraintViolations, tasks: number): string {
  let concerns = violations.total
  let warnings = 0
  for (const c of Object.values(counts)) {
    concerns += c.concern
    warnings += c.warning
  }
  const total = concerns + warnings
  const across = plural(tasks, 'choice task')
  if (total === 0) return `All checks passed on ${across}.`
  const parts = [concerns > 0 && plural(concerns, 'concern'), warnings > 0 && plural(warnings, 'warning')].filter(Boolean)
  return `${plural(total, 'finding')} across ${across}: ${parts.join(', ')}.`
}
