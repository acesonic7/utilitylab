import type { Alternative, Attribute, Project } from './schema'
import { appliesToAlt, resolveValidationConfig, type Report } from './validation'
import { designShape, type TaskDiagnostics } from './diagnostics'
import { paramLayout } from './dOptimal'
import { joinNames, listSeparator } from './text'

// A plain-text methods paragraph that states only what is true of the project.
// Segments marked `mark` are figures derived from the design itself.

export type MethodsSegment = { text: string; mark?: boolean }

export type MethodsHealth = {
  report: Report
  byTask: TaskDiagnostics[]
  dError: number | null
  K: number
  priorsNonZero: boolean
}

export type MethodsParagraph = {
  segments: MethodsSegment[]
  text: string
  hasDesign: boolean
}

const WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
]

function word(n: number): string {
  return n >= 0 && n < WORDS.length ? WORDS[n] : n.toLocaleString('en-US')
}

function num(n: number): string {
  return n.toLocaleString('en-US')
}

function s(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many
}

function altName(alt: Alternative, i: number): string {
  return alt.label.trim() || `Alternative ${i + 1}`
}

function attrName(attr: { name: string }, i: number, kind: string): string {
  return attr.name.trim() || `${kind} ${i + 1}`
}

function formatDError(d: number): string {
  return d >= 0.001 ? d.toFixed(3) : d.toPrecision(3)
}

function signed(v: number): string {
  if (v > 0) return `+${v}`
  if (v < 0) return `−${Math.abs(v)}`
  return '0'
}

class Writer {
  segments: MethodsSegment[] = []
  t(text: string) {
    const last = this.segments[this.segments.length - 1]
    if (last && !last.mark) last.text += text
    else this.segments.push({ text })
    return this
  }
  m(text: string) {
    this.segments.push({ text, mark: true })
    return this
  }
}

function levelsPhrase(attr: Attribute, designed: Alternative[]): string {
  const applicable = designed.filter((a) => appliesToAlt(attr, a.id))
  const counts = applicable.length
    ? applicable.map((a) => (attr.levelsByAlternative?.[a.id] ?? attr.levels).length)
    : [attr.levels.length]
  const min = Math.min(...counts)
  const max = Math.max(...counts)
  return min === max
    ? `${min} ${s(min, 'level')}`
    : `${min}–${max} levels, depending on the alternative`
}

function scopePhrase(attr: Attribute, designed: Alternative[], names: Map<string, string>): string {
  if (attr.appliesTo === 'all') return ''
  const scoped = designed.filter((a) => appliesToAlt(attr, a.id))
  if (scoped.length === 0 || scoped.length === designed.length) return ''
  return `; ${joinNames(scoped.map((a) => names.get(a.id)!))} only`
}

function pivotSentence(attr: Attribute, name: string): string | null {
  const mode = attr.pivot?.mode
  if (attr.type !== 'numeric' || !mode || mode === 'none') return null
  const hasOverrides = !!attr.levelsByAlternative && Object.keys(attr.levelsByAlternative).length > 0
  const values = [...attr.levels]
    .sort((a, b) => a.position - b.position)
    .map((l) => Number(l.value))
    .filter((v) => Number.isFinite(v))
  const head = `${name} was pivoted on each respondent’s own reference value`
  if (hasOverrides || values.length === 0) {
    return `${head}, with levels as ${mode === 'relative' ? 'multipliers of' : 'offsets from'} that value. `
  }
  if (mode === 'relative') {
    return `${head}, with levels as multipliers (${joinNames(values.map((v) => `×${v}`))}). `
  }
  const unit = attr.unit?.trim() ? ` ${attr.unit.trim()}` : ''
  return `${head}, with levels as offsets (${joinNames(values.map(signed))}${unit}). `
}

function generationPhrase(project: Project): string {
  const params = project.design?.generationParams
  if (!params) return 'It was generated in UtilityLab. '
  const seed = params.seed !== undefined && Number.isFinite(params.seed) ? params.seed : undefined
  const details: string[] = []
  let how: string
  if (params.method === 'd-optimal') {
    how = 'with a modified Fedorov D-optimal search'
    if (params.multistarts) details.push(`${num(params.multistarts)} random ${s(params.multistarts, 'start')}`)
  } else if (params.method === 'balanced') {
    how = params.iterations
      ? `by keeping the best of ${num(params.iterations)} random candidate designs, scored on level balance, attribute correlation, dominance and overlap`
      : 'by keeping the best of a set of random candidate designs, scored on level balance, attribute correlation, dominance and overlap'
  } else {
    how = 'by drawing attribute levels at random'
  }
  if (seed !== undefined) details.push(`random seed ${seed}`)
  return `It was generated in UtilityLab ${how}${details.length ? ` (${details.join(', ')})` : ''}. `
}

export function buildMethodsParagraph(project: Project, health: MethodsHealth): MethodsParagraph {
  const w = new Writer()
  const alts = project.alternatives
  const names = new Map(alts.map((a, i) => [a.id, altName(a, i)]))
  const designed = alts.filter((a) => !a.isOptOut)
  const optOuts = alts.filter((a) => a.isOptOut)
  const labeled = project.experimentType === 'labeled'

  // Alternatives
  w.t(`We used a${labeled ? ' labeled' : 'n unlabeled'} stated choice experiment`)
  if (designed.length > 0) {
    w.t(` with ${word(designed.length)} ${s(designed.length, 'alternative')} (${joinNames(designed.map((a) => names.get(a.id)!))})`)
  }
  if (optOuts.length > 0) {
    const quoted = joinNames(optOuts.map((a) => `“${names.get(a.id)}”`))
    const lead = designed.length > 0 ? ' plus' : ' with'
    w.t(optOuts.length === 1 ? `${lead} an opt-out alternative (${quoted})` : `${lead} ${word(optOuts.length)} opt-out alternatives (${quoted})`)
  }
  w.t('. ')

  // Attributes
  const attrs = project.attributes
  if (attrs.length > 0) {
    const subject = designed.length === 1 ? 'The alternative was' : 'Alternatives were'
    const details = attrs.map((attr, i) => {
      const unit = attr.unit?.trim() ? `, in ${attr.unit.trim()}` : ''
      return `${attrName(attr, i, 'Attribute')} (${levelsPhrase(attr, designed)}${unit}${scopePhrase(attr, designed, names)})`
    })
    w.t(`${subject} described by ${word(attrs.length)} ${s(attrs.length, 'attribute')}: ${joinNames(details)}. `)
    attrs.forEach((attr, i) => {
      const sentence = pivotSentence(attr, attrName(attr, i, 'Attribute'))
      if (sentence) w.t(sentence)
    })
  }

  // Context variables
  const cvs = project.contextVariables ?? []
  if (cvs.length > 0) {
    const details = cvs.map((cv, i) => {
      const unit = cv.unit?.trim() ? `, in ${cv.unit.trim()}` : ''
      return `${attrName(cv, i, 'Context variable')} (${cv.levels.length} ${s(cv.levels.length, 'level')}${unit})`
    })
    w.t(
      `Each choice task was set in a context described by ${word(cvs.length)} ${s(cvs.length, 'context variable')}: ${joinNames(details)}. `,
    )
  }

  const shape = designShape(project)
  if (shape) {
    // Design size and source
    const source = project.design!.source
    w.t(source === 'csv' ? 'The experimental design, imported from a CSV file, comprised ' : 'The experimental design comprised ')
    w.m(
      `${num(shape.tasks)} ${s(shape.tasks, 'choice task')} in ${shape.blocks === 1 ? 'a single block' : `${num(shape.blocks)} blocks`}`,
    )
    const { min, max } = shape.perRespondent
    if (shape.blocks === 1) w.t(`, so each respondent completed all ${num(shape.tasks)}. `)
    else if (min === max) w.t(`, so each respondent completed ${num(min)} ${s(min, 'choice task')}. `)
    else w.t(`, so each respondent completed between ${num(min)} and ${num(max)} choice tasks. `)
    if (source === 'generated') w.t(generationPhrase(project))

    // D-error
    if (health.K > 0) {
      const priors = health.priorsNonZero ? 'non-zero' : 'zero'
      const layout = paramLayout(project)
      const asc = layout.ascCount
      const ascText = layout.sharedConstant
        ? ', including a constant shared by the designed alternatives'
        : asc > 0
          ? `, including ${word(asc)} alternative-specific ${s(asc, 'constant')}`
          : ''
      const optOutNote = optOuts.length > 0 ? ', with the opt-out as the zero-utility reference' : ''
      const coding = project.attributes.some((a) => a.type !== 'numeric')
        ? '; categorical attributes were dummy coded against their first level'
        : ''
      if (health.dError !== null) {
        w.t(`Under a multinomial logit (MNL) model with ${priors} priors (K = ${health.K} parameters${ascText}), the design’s D-error was `)
        w.m(formatDError(health.dError))
        w.t(`${optOutNote}${coding}. `)
      } else {
        w.t(
          `Under a multinomial logit (MNL) model with ${priors} priors (K = ${health.K} parameters${ascText}), the design’s D-error could not be computed because the design does not identify every parameter (the information matrix is singular). `,
        )
      }
    }

    // Design checks
    const cfg = resolveValidationConfig(project)
    const { summary } = health.report
    // Only the leading count is a design figure; zero reads as plain "no".
    const count = (n: number, one: string, many = `${one}s`) => {
      if (n === 0) w.t('no')
      else w.m(num(n))
      w.t(` ${s(n, one, many)}`)
    }
    const checks: (() => void)[] = []
    if (cfg.dominance.enabled) {
      const dominatedTasks = health.byTask.filter((t) => t.dominated.length > 0)
      const dominated = dominatedTasks.reduce((sum, t) => sum + t.dominated.length, 0)
      checks.push(() => {
        count(dominated, 'dominated alternative')
        if (dominated > 0) w.t(` across ${num(dominatedTasks.length)} ${s(dominatedTasks.length, 'choice task')}`)
      })
    }
    if (cfg.overlap.enabled) {
      checks.push(() => {
        count(summary.overlap, 'pair')
        w.t(' of alternatives identical on all common attributes')
      })
    }
    if (cfg.correlation.enabled) {
      const concern = health.report.findings.filter((f) => f.check === 'correlation' && f.severity === 'concern').length
      checks.push(() => {
        count(summary.correlation, 'within-alternative attribute correlation')
        w.t(` above |r| = ${cfg.correlation.warnThreshold}`)
        if (concern > 0) w.t(` (${num(concern)} above ${cfg.correlation.concernThreshold})`)
      })
    }
    if (cfg.balance.enabled) {
      checks.push(() => {
        count(summary.balance, 'level-balance deviation')
        w.t(` above ${cfg.balance.maxDeviationPct}%`)
      })
    }
    if (checks.length > 0) {
      w.t('Automated design checks found ')
      checks.forEach((run, i) => {
        if (i > 0) w.t(listSeparator(i, checks.length))
        run()
      })
      w.t('.')
    }
  }

  const segments = w.segments
  const last = segments[segments.length - 1]
  if (last && !last.mark) last.text = last.text.trimEnd()
  return { segments, text: segments.map((seg) => seg.text).join(''), hasDesign: shape !== null }
}
