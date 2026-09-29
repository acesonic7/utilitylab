import type { Project } from './schema'
import { altIdentities } from './altIdentity'
import { designShape } from './diagnostics'
import { buildPriorVector } from './dOptimal'
import { plural } from './text'

export function designSignature(project: Project, opts: { dError: number | null }): string {
  const parts: string[] = []

  const names = altIdentities(project).map((id) => id.label)
  parts.push(`C = {${names.join(', ')}}`)

  const attrs = project.attributes
  if (attrs.length > 0) {
    const levels = attrs.map((a) => a.levels.length).join('·')
    parts.push(`${plural(attrs.length, 'attribute')} (${levels} levels)`)
  }

  const contexts = project.contextVariables?.length ?? 0
  if (contexts > 0) parts.push(plural(contexts, 'context variable'))

  const shape = designShape(project)
  if (shape) {
    const { min, max } = shape.perRespondent
    const per = min === max ? String(min) : `${min}–${max}`
    parts.push(
      `${plural(shape.tasks, 'choice task')} / ${plural(shape.blocks, 'block')} → ${per} per respondent`,
    )
    if (opts.dError !== null && Number.isFinite(opts.dError)) {
      const nonZero = buildPriorVector(project).some((b) => b !== 0)
      parts.push(`MNL D-error ${opts.dError.toFixed(3)}, priors: ${nonZero ? 'non-zero' : 'zero'}`)
    }
  }

  return parts.join(' · ')
}
