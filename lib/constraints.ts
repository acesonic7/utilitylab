import type { Project, DesignRow, Constraint } from './schema'
import { cellKey } from './validation'

export function rowViolates(
  row: DesignRow,
  project: Project,
  c: Constraint,
): boolean {
  if (!c.enabled) return false
  if (c.type !== 'forbidden_combination') return false
  if (c.clauses.length === 0) return false

  const altsToCheck =
    c.alternativeId === 'all'
      ? project.alternatives.filter((a) => !a.isOptOut)
      : project.alternatives.filter((a) => a.id === c.alternativeId && !a.isOptOut)

  for (const alt of altsToCheck) {
    const allMatch = c.clauses.every((cl) => {
      const lid = row.cells[cellKey(alt.id, cl.attributeId)]
      return lid === cl.levelId
    })
    if (allMatch) return true
  }
  return false
}

export function firstViolation(
  row: DesignRow,
  project: Project,
  constraints: Constraint[] | undefined,
): Constraint | null {
  if (!constraints || constraints.length === 0) return null
  for (const c of constraints) {
    if (rowViolates(row, project, c)) return c
  }
  return null
}

export function countViolations(
  rows: DesignRow[],
  project: Project,
  constraints: Constraint[] | undefined,
): { taskId: number; constraint: Constraint }[] {
  if (!constraints || constraints.length === 0) return []
  const out: { taskId: number; constraint: Constraint }[] = []
  for (const row of rows) {
    for (const c of constraints) {
      if (rowViolates(row, project, c)) {
        out.push({ taskId: row.taskId, constraint: c })
      }
    }
  }
  return out
}

export function constraintLabel(c: Constraint, project: Project): string {
  if (c.label) return c.label
  if (c.type !== 'forbidden_combination' || c.clauses.length === 0) {
    return '(empty constraint)'
  }
  const altLabel =
    c.alternativeId === 'all'
      ? 'any alternative'
      : project.alternatives.find((a) => a.id === c.alternativeId)?.label ??
        c.alternativeId
  const parts = c.clauses.map((cl) => {
    const attr = project.attributes.find((a) => a.id === cl.attributeId)
    const lvl = attr?.levels.find((l) => l.id === cl.levelId)
    const lvlLabel = lvl?.displayValue ?? String(lvl?.value ?? '?')
    return `${attr?.name ?? cl.attributeId} = ${lvlLabel}`
  })
  return `Forbid for ${altLabel}: ${parts.join(' AND ')}`
}
