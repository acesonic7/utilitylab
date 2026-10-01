import type { Project, DesignRow, Constraint } from './schema'
import { appliesToAlt, cellKey } from './validation'
import { findLevelInAttr, getLevelsForAlt } from './levelLookup'

function altsInScope(project: Project, c: Constraint) {
  return c.alternativeId === 'all'
    ? project.alternatives.filter((a) => !a.isOptOut)
    : project.alternatives.filter((a) => a.id === c.alternativeId && !a.isOptOut)
}

function active(c: Constraint): boolean {
  return c.enabled && c.type === 'forbidden_combination' && c.clauses.length > 0
}

/** How many alternatives in the row show the forbidden combination. */
function matches(row: DesignRow, project: Project, c: Constraint): number {
  if (!active(c)) return 0
  let n = 0
  for (const alt of altsInScope(project, c)) {
    if (c.clauses.every((cl) => row.cells[cellKey(alt.id, cl.attributeId)] === cl.levelId)) n++
  }
  return n
}

export function rowViolates(
  row: DesignRow,
  project: Project,
  c: Constraint,
): boolean {
  return matches(row, project, c) > 0
}

/** Forbidden combinations in the row, counted per constraint and alternative; 0 when it is clean. */
export function rowViolationCount(
  row: DesignRow,
  project: Project,
  constraints: Constraint[] | undefined,
): number {
  if (!constraints || constraints.length === 0) return 0
  let n = 0
  for (const c of constraints) n += matches(row, project, c)
  return n
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

/** Choice tasks that break at least one constraint. */
export function violatingRows(rows: DesignRow[], project: Project): number {
  const constraints = project.constraints
  if (!constraints || constraints.length === 0) return 0
  return rows.filter((r) => rowViolationCount(r, project, constraints) > 0).length
}

/**
 * Why an enabled constraint can never match any choice task, or null when it can. A constraint
 * whose alternative, attribute or level was deleted, whose attribute isn't shown for the
 * alternative, or whose level belongs to another level set (the alternative has its own levels)
 * would otherwise show "No violations" while forbidding nothing.
 */
export function constraintProblem(c: Constraint, project: Project): string | null {
  if (!c.enabled || c.type !== 'forbidden_combination') return null
  if (c.clauses.length === 0) return 'It has no conditions yet, so it forbids nothing.'

  if (c.alternativeId !== 'all') {
    const alt = project.alternatives.find((a) => a.id === c.alternativeId)
    if (!alt) return 'Its alternative was deleted, so it forbids nothing. Pick another alternative or remove it.'
    if (alt.isOptOut) return `${alt.label} is an opt-out, which shows no attributes, so it forbids nothing.`
  }

  for (const cl of c.clauses) {
    const attr = project.attributes.find((a) => a.id === cl.attributeId)
    if (!attr) return 'One of its attributes was deleted, so it forbids nothing. Remove that condition.'
    if (!findLevelInAttr(attr, cl.levelId)) {
      return `The level it names for ${attr.name} was deleted, so it forbids nothing. Pick a level again.`
    }
  }

  // Can any alternative in scope show every clause's level at once?
  const reachable = altsInScope(project, c).some((alt) =>
    c.clauses.every((cl) => {
      const attr = project.attributes.find((a) => a.id === cl.attributeId)!
      return appliesToAlt(attr, alt.id) && getLevelsForAlt(attr, alt.id).some((l) => l.id === cl.levelId)
    }),
  )
  if (reachable) return null

  if (c.alternativeId !== 'all') {
    const alt = project.alternatives.find((a) => a.id === c.alternativeId)!
    for (const cl of c.clauses) {
      const attr = project.attributes.find((a) => a.id === cl.attributeId)!
      if (!appliesToAlt(attr, alt.id)) return `${attr.name} isn't shown for ${alt.label}, so it forbids nothing.`
      if (!getLevelsForAlt(attr, alt.id).some((l) => l.id === cl.levelId)) {
        return `${alt.label} has its own levels for ${attr.name}, and the level picked isn't one of them, so it forbids nothing. Pick one of ${alt.label}'s levels.`
      }
    }
  }
  return 'No alternative can show all of these levels together, so it forbids nothing.'
}

/** Every enabled constraint that can never match, with the reason. */
export function constraintProblems(project: Project): { constraint: Constraint; problem: string }[] {
  return (project.constraints ?? []).flatMap((c) => {
    const problem = constraintProblem(c, project)
    return problem ? [{ constraint: c, problem }] : []
  })
}

export function constraintLabel(c: Constraint, project: Project): string {
  if (c.label) return c.label
  if (c.type !== 'forbidden_combination' || c.clauses.length === 0) {
    return '(empty constraint)'
  }
  const altLabel =
    c.alternativeId === 'all'
      ? 'any alternative'
      : project.alternatives.find((a) => a.id === c.alternativeId)?.label ?? 'a deleted alternative'
  const parts = c.clauses.map((cl) => {
    const attr = project.attributes.find((a) => a.id === cl.attributeId)
    if (!attr) return 'a deleted attribute'
    const lvl = findLevelInAttr(attr, cl.levelId)
    const lvlLabel = lvl ? lvl.displayValue ?? String(lvl.value) : 'a deleted level'
    return `${attr.name} = ${lvlLabel}`
  })
  return `Forbid for ${altLabel}: ${parts.join(' AND ')}`
}
