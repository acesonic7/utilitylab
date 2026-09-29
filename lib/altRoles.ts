import type { Alternative, Project } from './schema'
import { createAlternative } from './defaults'
import { uniqueSlug } from './slug'

export type AltRole = 'ASC' | 'reference' | 'opt-out' | null

// Mirrors paramLayout in lib/dOptimal.ts: in labeled experiments every active alternative
// gets a constant except the last one, which is the reference. Opt-outs are left out.
export function altRoles(project: Project): Map<string, AltRole> {
  const roles = new Map<string, AltRole>()
  const active = project.alternatives.filter((a) => !a.isOptOut)
  const ref = active[active.length - 1]
  for (const a of project.alternatives) {
    if (a.isOptOut) roles.set(a.id, 'opt-out')
    else if (project.experimentType !== 'labeled') roles.set(a.id, null)
    else roles.set(a.id, a.id === ref?.id ? 'reference' : 'ASC')
  }
  return roles
}

function nextLetterLabel(taken: string[]): string {
  for (let i = 0; i < 26; i++) {
    const label = `Alternative ${String.fromCharCode(65 + i)}`
    if (!taken.includes(label)) return label
  }
  return `Alternative ${taken.length + 1}`
}

// createAlternative, relabeled "Alternative A, B, …" (or an opt-out) with an id slugged from that label.
export function newAlternative(project: Project, opts?: { optOut?: boolean }): Alternative {
  const base = createAlternative(project)
  const existingIds = project.alternatives.map((a) => a.id)
  const taken = project.alternatives.map((a) => a.label)
  const label = opts?.optOut
    ? taken.includes('None of these')
      ? nextLetterLabel(taken)
      : 'None of these'
    : nextLetterLabel(taken)
  return { ...base, id: uniqueSlug(label, existingIds), label, isOptOut: !!opts?.optOut }
}

