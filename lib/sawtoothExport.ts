import type { Project, Alternative, Attribute, Level } from './schema'
import { appliesToAlt, cellKey } from './validation'
import { getLevelsForAlt } from './levelLookup'
import { levelDisplayText } from './format'
import { exportBlocks } from './blocks'

// Sawtooth Lighthouse Studio CBC "Import Design" CSV, as documented at
// https://sawtoothsoftware.com/help/lighthouse-studio/manual/importing-exporting-cbc-designs.html
//
// Column 1 is the version (block, from 1), column 2 the task within the version, column 3 the
// concept, and columns 4 onwards the attribute levels as 1-based codes. "When an attribute is not
// shown in a product concept, it receives a level '0'." The header row follows the documented
// example (Att 1, Att 2, …); sawtoothColumns lists which attribute each column is, so the
// attributes can be set up in Lighthouse in the same order.
//
// - Opt-outs are left out: Lighthouse adds "None" through an exercise setting.
// - A labeled design gets a primary attribute first, "Alternative", whose level is the concept's
//   alternative; the other attributes are then conditional on it in Lighthouse.
// - An attribute with its own levels for some alternatives becomes one column per level set, so a
//   code always means one value.
// - Context variables are not exported: every column after the third is read as an attribute.

export type SawtoothColumn = {
  /** The attribute's name as it should be set up in Lighthouse. */
  name: string
  levels: string[]
  /** Code for this concept's cell: 1-based level, or 0 when not shown for the concept. */
  code: (alt: Alternative, cells: Record<string, string>, taskLabel: string) => number
}

function conceptsOf(project: Project): Alternative[] {
  return project.builder.alternativeOrder
    .map((id) => project.alternatives.find((a) => a.id === id))
    .filter((a): a is Alternative => !!a && !a.isOptOut)
}

function levelCode(attr: Attribute, levels: Level[], alt: Alternative, cells: Record<string, string>, taskLabel: string): number {
  const lid = cells[cellKey(alt.id, attr.id)]
  const i = levels.findIndex((l) => l.id === lid)
  // A cell that names no level would import as a different level, or as "not shown".
  if (i < 0) throw new Error(`${taskLabel} has no valid level for ${alt.label} · ${attr.name}. Generate the design again.`)
  return i + 1
}

export function sawtoothColumns(project: Project): SawtoothColumn[] {
  const concepts = conceptsOf(project)
  const columns: SawtoothColumn[] = []
  if (project.experimentType === 'labeled') {
    columns.push({
      name: 'Alternative',
      levels: concepts.map((a) => a.label),
      code: (alt) => concepts.findIndex((a) => a.id === alt.id) + 1,
    })
  }
  const attrOrder = project.builder.attributeOrder
    .map((id) => project.attributes.find((a) => a.id === id))
    .filter((a): a is Attribute => !!a)
  for (const attr of attrOrder) {
    const own = concepts.filter((a) => appliesToAlt(attr, a.id) && (attr.levelsByAlternative?.[a.id]?.length ?? 0) > 0)
    const shared = concepts.filter((a) => appliesToAlt(attr, a.id) && !own.includes(a))
    const label = (l: Level) => levelDisplayText(attr, l)
    if (shared.length) {
      const ids = new Set(shared.map((a) => a.id))
      columns.push({
        name: own.length ? `${attr.name} (${shared.map((a) => a.label).join(', ')})` : attr.name,
        levels: attr.levels.map(label),
        code: (alt, cells, t) => (ids.has(alt.id) ? levelCode(attr, attr.levels, alt, cells, t) : 0),
      })
    }
    for (const a of own) {
      const levels = getLevelsForAlt(attr, a.id)
      columns.push({
        name: `${attr.name} (${a.label})`,
        levels: levels.map(label),
        code: (alt, cells, t) => (alt.id === a.id ? levelCode(attr, levels, alt, cells, t) : 0),
      })
    }
  }
  return columns
}

export function exportSawtoothCsv(project: Project): string {
  if (!project.design) throw new Error('Project has no design')
  const { rows, numBlocks } = exportBlocks(project.design)
  const concepts = conceptsOf(project)
  const columns = sawtoothColumns(project)

  const headers = ['Version', 'Task', 'Concept', ...columns.map((_, i) => `Att ${i + 1}`)]
  const lines: string[] = [headers.join(',')]

  for (let b = 1; b <= numBlocks; b++) {
    const blockRows = rows.filter((r) => r.block === b)
    blockRows.forEach((row, taskIdxInBlock) => {
      const taskLabel = `Choice task ${row.taskId} (block ${b})`
      concepts.forEach((alt, conceptIdx) => {
        const cells = [String(b), String(taskIdxInBlock + 1), String(conceptIdx + 1)]
        for (const col of columns) cells.push(String(col.code(alt, row.cells, taskLabel)))
        lines.push(cells.join(','))
      })
    })
  }
  return lines.join('\n') + '\n'
}
