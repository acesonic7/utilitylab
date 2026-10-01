import type { Project } from './schema'
import { getLevelsForAlt } from './levelLookup'
import { appliesToAlt, cellKey } from './validation'
import { joinNames, plural } from './text'

// A design is stored as level ids keyed by (alternative, attribute) and context variable. Editing
// the structure afterwards does not touch it, so a deleted level, attribute or alternative leaves
// cells that no export, check or D-error can read. This finds every such mismatch.

export type DesignFitIssueKind =
  | 'unknown-level' // a cell's level no longer exists in that alternative's level set
  | 'missing-cell' // an alternative × attribute the structure shows has no level in the design
  | 'removed' // the design has values for an alternative, attribute or context variable no longer shown
  | 'unknown-context' // a choice task's context level no longer exists
  | 'missing-context' // a context variable has no level in a choice task

export type DesignFitIssue = {
  kind: DesignFitIssueKind
  /** Choice tasks (design rows) affected. */
  rows: number
  /** Names of the alternatives, attributes or context variables involved. */
  names: string[]
  message: string
}

export type DesignFit = {
  issues: DesignFitIssue[]
  /** Choice tasks with at least one issue. */
  affectedRows: number
  totalRows: number
}

type Acc = { rows: Set<number>; names: Set<string> }

function bump(map: Map<DesignFitIssueKind, Acc>, kind: DesignFitIssueKind, row: number, name: string) {
  let acc = map.get(kind)
  if (!acc) map.set(kind, (acc = { rows: new Set(), names: new Set() }))
  acc.rows.add(row)
  acc.names.add(name)
}

function message(kind: DesignFitIssueKind, rows: number, names: string[]): string {
  const where = joinNames(names.length > 4 ? [...names.slice(0, 3), `${names.length - 3} more`] : names)
  const tasks = plural(rows, 'choice task')
  switch (kind) {
    case 'unknown-level':
      return `${tasks} use a level that no longer exists (${where}).`
    case 'missing-cell':
      return `${tasks} have no level for ${where}.`
    case 'removed':
      return `The design still has levels for ${where}, which ${names.length === 1 ? 'is' : 'are'} no longer in the structure or no longer shown.`
    case 'unknown-context':
      return `${tasks} use a context level that no longer exists (${where}).`
    case 'missing-context':
      return `${tasks} have no level for the context variable ${where}.`
  }
}

const ORDER: DesignFitIssueKind[] = ['unknown-level', 'missing-cell', 'removed', 'unknown-context', 'missing-context']

/** Mismatches between the stored design and the current structure; null when there is no design or it fits. */
export function designFit(project: Project): DesignFit | null {
  const rows = project.design?.rows ?? []
  if (rows.length === 0) return null

  const designed = project.alternatives.filter((a) => !a.isOptOut)
  const altById = new Map(project.alternatives.map((a) => [a.id, a]))
  const attrById = new Map(project.attributes.map((a) => [a.id, a]))
  const contextVars = project.contextVariables ?? []
  const cvById = new Map(contextVars.map((c) => [c.id, c]))

  // Cells the structure expects, keyed as in the design.
  const expected = new Map<string, { altLabel: string; attrName: string; levelIds: Set<string> }>()
  for (const alt of designed) {
    for (const attr of project.attributes) {
      if (!appliesToAlt(attr, alt.id)) continue
      const levels = getLevelsForAlt(attr, alt.id)
      if (levels.length === 0) continue
      expected.set(cellKey(alt.id, attr.id), {
        altLabel: alt.label,
        attrName: attr.name,
        levelIds: new Set(levels.map((l) => l.id)),
      })
    }
  }

  const found = new Map<DesignFitIssueKind, Acc>()
  rows.forEach((row, i) => {
    for (const [key, cell] of expected) {
      const lid = row.cells[key]
      if (!lid) bump(found, 'missing-cell', i, `${cell.altLabel} · ${cell.attrName}`)
      else if (!cell.levelIds.has(lid)) bump(found, 'unknown-level', i, `${cell.altLabel} · ${cell.attrName}`)
    }
    for (const key of Object.keys(row.cells)) {
      if (expected.has(key) || !row.cells[key]) continue
      // Keys are "<altId>.<attrId>"; ids may themselves contain dots, so match on known ids first.
      const dot = key.indexOf('.')
      const altId = key.slice(0, dot)
      const attrId = key.slice(dot + 1)
      const alt = altById.get(altId)
      const attr = attrById.get(attrId)
      const name = !alt
        ? 'a deleted alternative'
        : !attr
          ? 'a deleted attribute'
          : alt.isOptOut
            ? `${alt.label} (now an opt-out)`
            : `${alt.label} · ${attr.name}`
      bump(found, 'removed', i, name)
    }
    const ctx = row.context ?? {}
    for (const cv of contextVars) {
      if (cv.levels.length === 0) continue
      const lid = ctx[cv.id]
      if (!lid) bump(found, 'missing-context', i, cv.name)
      else if (!cv.levels.some((l) => l.id === lid)) bump(found, 'unknown-context', i, cv.name)
    }
    for (const id of Object.keys(ctx)) {
      if (!cvById.has(id) && ctx[id]) bump(found, 'removed', i, 'a deleted context variable')
    }
  })

  if (found.size === 0) return null
  const affected = new Set<number>()
  const issues: DesignFitIssue[] = []
  for (const kind of ORDER) {
    const acc = found.get(kind)
    if (!acc) continue
    acc.rows.forEach((r) => affected.add(r))
    const names = Array.from(acc.names)
    issues.push({ kind, rows: acc.rows.size, names, message: message(kind, acc.rows.size, names) })
  }
  return { issues, affectedRows: affected.size, totalRows: rows.length }
}
