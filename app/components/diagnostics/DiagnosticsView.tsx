'use client'

import { useMemo, useState } from 'react'
import type { Project } from '@/lib/schema'
import type { ConstraintViolations } from '@/lib/diagnosticsView'
import { levelCounts } from '@/lib/diagnostics'
import { resolveValidationConfig } from '@/lib/validation'
import { buildInsight, correlationsByAlt } from '@/lib/diagnosticsView'
import { useDesignHealth } from '../DesignHealth'
import { plural } from '@/lib/text'
import { cx } from '../ui'
import { CheckCircleIcon, FIGURE_IDS, figureTargetClass } from './bits'
import { ChoiceTaskMap } from './ChoiceTaskMap'
import { CorrelationMultiples } from './CorrelationMultiples'
import { EfficiencyTiles } from './EfficiencyTiles'
import { FilterChips } from './FilterChips'
import { FindingsGroups } from './FindingsGroups'
import { LevelBalance } from './LevelBalance'
import { CHECK_LABEL, checkTallies, showsFigure, type FilterKey } from './model'

// Side by side only while the map still has room for its cells.
const MAX_TASKS_BESIDE = 10

function AllPassed({ project }: { project: Project }) {
  const cfg = resolveValidationConfig(project)
  const off = [
    !cfg.dominance.enabled && 'dominance',
    !cfg.overlap.enabled && 'overlap',
    !cfg.correlation.enabled && 'correlation',
    !cfg.balance.enabled && 'level balance',
  ].filter(Boolean) as string[]
  return (
    <div className="flex items-start gap-3 rounded-panel bg-ok-bg px-5 py-4 text-13 text-ink">
      <CheckCircleIcon className="text-ok" />
      <p>
        <strong className="font-semibold text-ok">All checks passed.</strong> No dominated or identical
        alternatives, no attribute correlation above |r| {cfg.correlation.warnThreshold}, every level within ±
        {cfg.balance.maxDeviationPct}% of its ideal count, and no constraint violations.
        {off.length > 0 && ` Switched off in this project: ${off.join(', ')}.`}
      </p>
    </div>
  )
}

export function DiagnosticsView({ project, violations }: { project: Project; violations: ConstraintViolations }) {
  const health = useDesignHealth()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [announce, setAnnounce] = useState('')

  const cfg = useMemo(() => resolveValidationConfig(project), [project])
  const data = useMemo(
    () => {
      const correlations = correlationsByAlt(project)
      return {
        correlations,
        balanceRows: levelCounts(project),
        insight: buildInsight(project, health.byTask, correlations),
      }
    },
    // Only the fields the figures read.
    [
      project.alternatives,
      project.attributes,
      project.contextVariables,
      project.design,
      project.validationConfig,
      health.byTask,
    ],
  )

  const tallies = checkTallies(health.counts, cfg, violations)
  const total = health.totalFindings + violations.total
  const tasks = project.design?.rows.length ?? 0

  const onFilter = (f: FilterKey) => {
    setFilter(f)
    setAnnounce(
      f === 'all'
        ? `Showing all ${plural(total, 'finding')}`
        : `Showing ${CHECK_LABEL[f].toLowerCase()}: ${plural(tallies[f].total, 'finding')}`,
    )
  }

  const showMap = showsFigure(filter, 'map')
  const showCorr = showsFigure(filter, 'correlation')
  const showBalance = showsFigure(filter, 'balance')
  const beside = showMap && showCorr && tasks <= MAX_TASKS_BESIDE

  return (
    <>
      <FilterChips value={filter} onChange={onFilter} tallies={tallies} total={total} cfg={cfg} />
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <EfficiencyTiles
        project={project}
        cfg={cfg}
        balanceRows={data.balanceRows}
        correlations={data.correlations}
      />

      {(showMap || showCorr) && (
        <div
          className={cx(
            'mt-6 grid grid-cols-1 items-start gap-x-4 gap-y-6',
            beside && 'min-[1360px]:grid-cols-[minmax(0,1fr)_400px]',
          )}
        >
          {showMap && (
            <div id={FIGURE_IDS.map} tabIndex={-1} className={cx('min-w-0', figureTargetClass)}>
              <ChoiceTaskMap project={project} violationsByRow={violations.byRow} insight={data.insight} />
            </div>
          )}
          {showCorr && (
            <div id={FIGURE_IDS.correlation} tabIndex={-1} className={cx('min-w-0', figureTargetClass)}>
              <CorrelationMultiples project={project} cfg={cfg} correlations={data.correlations} beside={beside} />
            </div>
          )}
        </div>
      )}

      {showBalance && (
        <div id={FIGURE_IDS.balance} tabIndex={-1} className={cx('mt-6', figureTargetClass)}>
          <LevelBalance project={project} cfg={cfg} rows={data.balanceRows} />
        </div>
      )}

      <div className="mt-6">
        <h3 className="sr-only">Findings</h3>
        {total === 0 ? (
          <AllPassed project={project} />
        ) : (
          <FindingsGroups
            project={project}
            cfg={cfg}
            filter={filter}
            tallies={tallies}
            violations={violations}
            balanceRows={data.balanceRows}
          />
        )}
      </div>
    </>
  )
}
