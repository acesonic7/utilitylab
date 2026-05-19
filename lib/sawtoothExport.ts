import type { Project, Alternative, Attribute } from './schema'
import { cellKey } from './validation'
import { findLevelInAttr } from './levelLookup'

// Sawtooth Lighthouse Studio "Import Design" CSV.
//
// One row per (Version × Task × Concept). Version = block (1-indexed),
// Task = task index within block (1-indexed), Concept = non-opt-out
// alternative index within the task (1-indexed). Attribute columns hold the
// level's 1-indexed position, which must match the level codes you configure
// in Lighthouse Studio's attribute editor.
//
// Opt-out alternatives are not included — Lighthouse adds the "None" option
// via a CBC exercise setting, not via the imported design.
//
// Attributes that don't apply to a given alternative (labeled designs) are
// emitted as blank. Mark those attributes as "alternative-specific" in
// Lighthouse Studio so the blank value is ignored.

function appliesToAlt(attr: Attribute, altId: string): boolean {
  return attr.appliesTo === 'all' || attr.appliesTo.includes(altId)
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function exportSawtoothCsv(project: Project): string {
  if (!project.design) throw new Error('Project has no design')

  const altOrder = project.builder.alternativeOrder
    .map((id) => project.alternatives.find((a) => a.id === id))
    .filter((a): a is Alternative => !!a)
  const concepts = altOrder.filter((a) => !a.isOptOut)

  const attrOrder = project.builder.attributeOrder
    .map((id) => project.attributes.find((a) => a.id === id))
    .filter((a): a is Attribute => !!a)

  const headers = ['Version', 'Task', 'Concept', ...attrOrder.map((a) => csvEscape(a.name))]
  const lines: string[] = [headers.join(',')]

  for (let b = 1; b <= project.design.numBlocks; b++) {
    const blockRows = project.design.rows.filter((r) => r.block === b)
    blockRows.forEach((row, taskIdxInBlock) => {
      concepts.forEach((alt, conceptIdx) => {
        const cells: string[] = [
          String(b),
          String(taskIdxInBlock + 1),
          String(conceptIdx + 1),
        ]
        for (const attr of attrOrder) {
          if (!appliesToAlt(attr, alt.id)) {
            cells.push('')
            continue
          }
          const lid = row.cells[cellKey(alt.id, attr.id)]
          const level = findLevelInAttr(attr, lid)
          cells.push(level ? String(level.position + 1) : '')
        }
        lines.push(cells.join(','))
      })
    })
  }
  return lines.join('\n') + '\n'
}
