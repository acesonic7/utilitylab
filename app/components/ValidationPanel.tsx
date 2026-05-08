import { validate } from '@/lib/validation'
import { countViolations, constraintLabel } from '@/lib/constraints'
import type { Project } from '@/lib/schema'
import { Check } from './Icons'

const checkLabels: Record<string, string> = {
  dominance: 'Dominance',
  balance: 'Balance',
  correlation: 'Correlation',
  overlap: 'Overlap',
}

const severityStyle: Record<string, string> = {
  warning: 'bg-amber-50/70 ring-amber-200/80 text-amber-900 border-amber-400',
  concern: 'bg-red-50/70 ring-red-200/80 text-red-900 border-red-400',
}

export default function ValidationPanel({ project }: { project: Project }) {
  const report = validate(project)
  const violations = countViolations(
    project.design?.rows ?? [],
    project,
    project.constraints,
  )
  const violationsByConstraint = new Map<string, number[]>()
  for (const v of violations) {
    const existing = violationsByConstraint.get(v.constraint.id) ?? []
    existing.push(v.taskId)
    violationsByConstraint.set(v.constraint.id, existing)
  }
  const total = report.findings.length + violations.length

  const summary = [
    { key: 'dominance', label: 'dominance', count: report.summary.dominance, color: 'bg-red-400' },
    { key: 'balance', label: 'balance', count: report.summary.balance, color: 'bg-amber-400' },
    { key: 'correlation', label: 'correlation', count: report.summary.correlation, color: 'bg-red-400' },
    { key: 'overlap', label: 'overlap', count: report.summary.overlap, color: 'bg-amber-400' },
    { key: 'constraint', label: 'constraint', count: violations.length, color: 'bg-red-500' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="text-sm text-neutral-600">
          <span className="font-semibold text-neutral-900 tabular-nums">{total}</span>{' '}
          finding{total !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-600 flex-wrap">
          {summary.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  s.count > 0 ? s.color : 'bg-neutral-300'
                }`}
              />
              <span className="tabular-nums">{s.count}</span> {s.label}
            </span>
          ))}
        </div>
      </div>
      {total === 0 ? (
        <div className="bg-emerald-50/60 ring-1 ring-emerald-200/80 text-emerald-900 rounded-xl p-4 text-sm flex items-center gap-3 border-l-4 border-emerald-400">
          <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Check size={14} />
          </span>
          No issues found.
        </div>
      ) : (
        <ul className="space-y-2">
          {Array.from(violationsByConstraint.entries()).map(([cid, taskIds]) => {
            const c = project.constraints?.find((x) => x.id === cid)
            if (!c) return null
            return (
              <li
                key={`v-${cid}`}
                className="rounded-lg ring-1 border-l-4 p-3 text-sm bg-red-50/70 ring-red-200/80 text-red-900 border-red-500"
              >
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-semibold">Constraint violated</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-60">
                    error
                  </span>
                </div>
                <div className="leading-snug">
                  {constraintLabel(c, project)} — violated by{' '}
                  <span className="tabular-nums font-medium">
                    {taskIds.length}
                  </span>{' '}
                  task{taskIds.length !== 1 ? 's' : ''}: {taskIds.slice(0, 8).join(', ')}
                  {taskIds.length > 8 ? `, … (+${taskIds.length - 8} more)` : ''}
                </div>
              </li>
            )
          })}
          {report.findings.map((f, i) => (
            <li
              key={i}
              className={`rounded-lg ring-1 border-l-4 p-3 text-sm ${severityStyle[f.severity] ?? ''}`}
            >
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="font-semibold">{checkLabels[f.check]}</span>
                <span className="text-[10px] uppercase tracking-wider opacity-60">
                  {f.severity}
                </span>
              </div>
              <div className="leading-snug">{f.message}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
