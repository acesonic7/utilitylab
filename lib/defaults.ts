import type { Project, Alternative, Attribute, ContextVariable, Level } from './schema'
import { uniqueSlug } from './slug'

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id_${Math.random().toString(36).slice(2, 11)}`
}

function nextLetterLabel(taken: string[]): string {
  for (let i = 0; i < 26; i++) {
    const label = `Option ${String.fromCharCode(65 + i)}`
    if (!taken.includes(label)) return label
  }
  return `Option ${taken.length + 1}`
}

export function createAlternative(project: Project): Alternative {
  const existingIds = project.alternatives.map((a) => a.id)
  const existingLabels = project.alternatives.map((a) => a.label)
  const label = nextLetterLabel(existingLabels)
  return {
    id: uniqueSlug(label, existingIds),
    label,
    isOptOut: false,
    position: project.alternatives.length,
  }
}

export function createAttribute(project: Project): Attribute {
  const existingIds = project.attributes.map((a) => a.id)
  const existingNames = project.attributes.map((a) => a.name)
  const base = 'New attribute'
  let name = base
  let n = 2
  while (existingNames.includes(name)) {
    name = `${base} ${n}`
    n++
  }
  return {
    id: uniqueSlug(name, existingIds),
    name,
    type: 'numeric',
    appliesTo: 'all',
    position: project.attributes.length,
    levels: [
      { id: genId(), value: 1, position: 0 },
      { id: genId(), value: 2, position: 1 },
      { id: genId(), value: 3, position: 2 },
    ],
  }
}

export function createContextVariable(project: Project): ContextVariable {
  const list = project.contextVariables ?? []
  const existingIds = list.map((c) => c.id)
  const existingNames = list.map((c) => c.name)
  const base = 'New context'
  let name = base
  let n = 2
  while (existingNames.includes(name)) {
    name = `${base} ${n}`
    n++
  }
  return {
    id: uniqueSlug(name, existingIds),
    name,
    type: 'categorical',
    position: list.length,
    levels: [
      { id: genId(), value: 'Level 1', position: 0 },
      { id: genId(), value: 'Level 2', position: 1 },
      { id: genId(), value: 'Level 3', position: 2 },
    ],
  }
}

export function createContextLevel(cv: ContextVariable): Level {
  const next = cv.levels.length
  if (cv.type === 'numeric') return { id: genId(), value: next + 1, position: next }
  if (cv.type === 'boolean') return { id: genId(), value: next === 0, position: next }
  return { id: genId(), value: `Level ${next + 1}`, position: next }
}

export function createLevel(attr: Attribute): Level {
  const next = attr.levels.length
  if (attr.type === 'numeric') return { id: genId(), value: next + 1, position: next }
  if (attr.type === 'boolean') return { id: genId(), value: next === 0, position: next }
  return { id: genId(), value: `Level ${next + 1}`, position: next }
}
