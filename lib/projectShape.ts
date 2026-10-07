import type { Attribute, Constraint, ContextVariable, Design, DesignRow, Level, Project } from './schema'

// A study read from a project file or from browser storage is untrusted: a hand-edited or
// truncated file used to pass a shallow check, get stored and made active, and then crash every
// render, so the app could not open again. This checks every field the app reads, fills in the
// optional ones it can default, and otherwise names the first problem.

export type ProjectCheck = { ok: true; project: Project } | { ok: false; error: string }

class Invalid extends Error {}

type Obj = Record<string, unknown>

function fail(where: string, what: string): never {
  throw new Invalid(`${where} ${what}`)
}

function obj(v: unknown, where: string): Obj {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(where, 'is missing or not an object')
  return v as Obj
}

function arr(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) fail(where, 'is missing or not a list')
  return v
}

function str(v: unknown, where: string): string {
  if (typeof v !== 'string') fail(where, 'must be text')
  return v
}

function num(v: unknown, where: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(where, 'must be a number')
  return v
}

function optStr(v: unknown, where: string): string | undefined {
  return v === undefined || v === null ? undefined : str(v, where)
}

function optNum(v: unknown, where: string): number | undefined {
  return v === undefined || v === null ? undefined : num(v, where)
}

function oneOf<T extends string>(v: unknown, options: readonly T[], where: string): T {
  if (!options.includes(v as T)) fail(where, `must be one of ${options.join(', ')}`)
  return v as T
}

function optOneOf<T extends string>(v: unknown, options: readonly T[], where: string): T | undefined {
  return v === undefined || v === null ? undefined : oneOf(v, options, where)
}

function strMap(v: unknown, where: string): Record<string, string> {
  const o = obj(v, where)
  for (const [k, x] of Object.entries(o)) str(x, `${where} "${k}"`)
  return o as Record<string, string>
}

function uniqueIds(items: { id: string }[], where: string) {
  const seen = new Set<string>()
  for (const it of items) {
    if (seen.has(it.id)) fail(where, `has the id "${it.id}" twice`)
    seen.add(it.id)
  }
}

const TYPES = ['numeric', 'categorical', 'boolean'] as const
const FORMATS = ['plain', 'currency', 'percent', 'duration'] as const

function level(v: unknown, i: number, where: string): Level {
  const o = obj(v, `${where} level ${i + 1}`)
  const value = o.value
  if (typeof value !== 'string' && typeof value !== 'boolean' && !(typeof value === 'number' && Number.isFinite(value))) {
    fail(`${where} level ${i + 1}`, 'needs a value (text, a number or true/false)')
  }
  return {
    ...(o as unknown as Level),
    id: str(o.id, `${where} level ${i + 1} id`),
    value,
    position: optNum(o.position, `${where} level ${i + 1} position`) ?? i,
    displayValue: optStr(o.displayValue, `${where} level ${i + 1} display value`),
    imageUrl: optStr(o.imageUrl, `${where} level ${i + 1} image`),
  }
}

function levels(v: unknown, where: string): Level[] {
  const out = arr(v, `${where} levels`).map((l, i) => level(l, i, where))
  uniqueIds(out, `${where} levels`)
  return out
}

function attribute(v: unknown, i: number): Attribute {
  const where = `Attribute ${i + 1}`
  const o = obj(v, where)
  const name = str(o.name, `${where} name`)
  const at = `Attribute "${name}"`
  let appliesTo: Attribute['appliesTo'] = 'all'
  if (o.appliesTo !== undefined && o.appliesTo !== 'all') {
    appliesTo = arr(o.appliesTo, `${at} "applies to"`).map((x) => str(x, `${at} "applies to"`))
  }
  let levelsByAlternative: Attribute['levelsByAlternative']
  if (o.levelsByAlternative !== undefined && o.levelsByAlternative !== null) {
    levelsByAlternative = {}
    for (const [altId, ls] of Object.entries(obj(o.levelsByAlternative, `${at} per-alternative levels`))) {
      levelsByAlternative[altId] = levels(ls, `${at} (own levels of ${altId})`)
    }
  }
  let pivot: Attribute['pivot']
  if (o.pivot !== undefined && o.pivot !== null) {
    const p = obj(o.pivot, `${at} pivot`)
    pivot = {
      mode: oneOf(p.mode, ['none', 'absolute', 'relative'] as const, `${at} pivot mode`),
      previewReference: optNum(p.previewReference, `${at} preview reference`),
      referenceToken: optStr(p.referenceToken, `${at} reference token`),
    }
  }
  let priors: number[] | undefined
  if (o.priors !== undefined && o.priors !== null) priors = arr(o.priors, `${at} priors`).map((x) => num(x, `${at} priors`))
  return {
    ...(o as unknown as Attribute),
    id: str(o.id, `${where} id`),
    name,
    type: oneOf(o.type, TYPES, `${at} type`),
    unit: optStr(o.unit, `${at} unit`),
    displayFormat: optOneOf(o.displayFormat, FORMATS, `${at} display format`),
    preferenceDirection: optOneOf(o.preferenceDirection, ['higher', 'lower', 'none'] as const, `${at} preference direction`),
    levels: levels(o.levels, at),
    levelsByAlternative,
    appliesTo,
    position: optNum(o.position, `${at} position`) ?? i,
    priors,
    pivot,
    imageUrl: optStr(o.imageUrl, `${at} image`),
  }
}

function contextVariable(v: unknown, i: number): ContextVariable {
  const where = `Context variable ${i + 1}`
  const o = obj(v, where)
  const name = str(o.name, `${where} name`)
  const at = `Context variable "${name}"`
  return {
    ...(o as unknown as ContextVariable),
    id: str(o.id, `${where} id`),
    name,
    type: oneOf(o.type, TYPES, `${at} type`),
    unit: optStr(o.unit, `${at} unit`),
    displayFormat: optOneOf(o.displayFormat, FORMATS, `${at} display format`),
    levels: levels(o.levels, at),
    position: optNum(o.position, `${at} position`) ?? i,
  }
}

function constraint(v: unknown, i: number): Constraint {
  const where = `Constraint ${i + 1}`
  const o = obj(v, where)
  return {
    ...(o as unknown as Constraint),
    id: str(o.id, `${where} id`),
    type: oneOf(o.type, ['forbidden_combination'] as const, `${where} type`),
    alternativeId: str(o.alternativeId, `${where} alternative`),
    clauses: arr(o.clauses, `${where} conditions`).map((c, k) => {
      const cl = obj(c, `${where} condition ${k + 1}`)
      return {
        attributeId: str(cl.attributeId, `${where} condition ${k + 1} attribute`),
        levelId: str(cl.levelId, `${where} condition ${k + 1} level`),
      }
    }),
    enabled: o.enabled === undefined ? true : o.enabled === true,
    label: optStr(o.label, `${where} label`),
  }
}

function designRow(v: unknown, i: number, where: string): DesignRow {
  const o = obj(v, `${where} choice task ${i + 1}`)
  const at = `${where} choice task ${i + 1}`
  return {
    taskId: num(o.taskId, `${at} number`),
    block: num(o.block, `${at} block`),
    cells: strMap(o.cells, `${at} cells`),
    ...(o.context === undefined || o.context === null ? {} : { context: strMap(o.context, `${at} context`) }),
  }
}

/** A design (or an earlier design): rows must be readable; counts are taken from the rows. */
export function checkDesign(v: unknown, where = 'The design'): Design {
  const o = obj(v, where)
  const rows = arr(o.rows, `${where} rows`).map((r, i) => designRow(r, i, where))
  const blocks = new Set(rows.map((r) => r.block)).size
  return {
    ...(o as unknown as Design),
    source: o.source === 'generated' ? 'generated' : 'csv',
    uploadedAt: typeof o.uploadedAt === 'string' ? o.uploadedAt : new Date(0).toISOString(),
    filename: optStr(o.filename, `${where} file name`),
    numTasks: rows.length,
    numBlocks: Math.max(1, blocks),
    rows,
    mapping: Array.isArray(o.mapping) ? (o.mapping as Design['mapping']) : [],
    rawHeaders: Array.isArray(o.rawHeaders) ? (o.rawHeaders as string[]).filter((h) => typeof h === 'string') : [],
    generationParams:
      o.generationParams && typeof o.generationParams === 'object' ? (o.generationParams as Design['generationParams']) : undefined,
  }
}

function orderOf(v: unknown, ids: string[], where: string): string[] {
  const given = v === undefined ? [] : arr(v, where).map((x) => str(x, where))
  // Keep the saved order for ids that exist, then append any the order is missing.
  const known = given.filter((id) => ids.includes(id))
  return [...new Set([...known, ...ids])]
}

export function checkProject(raw: unknown): ProjectCheck {
  try {
    const o = obj(raw, 'The study')
    const name = str(o.name, 'The study name')
    const alternatives = arr(o.alternatives, 'The alternatives').map((v, i) => {
      const a = obj(v, `Alternative ${i + 1}`)
      return {
        ...(a as unknown as Project['alternatives'][number]),
        id: str(a.id, `Alternative ${i + 1} id`),
        label: str(a.label, `Alternative ${i + 1} label`),
        isOptOut: a.isOptOut === true,
        position: optNum(a.position, `Alternative ${i + 1} position`) ?? i,
        imageUrl: optStr(a.imageUrl, `Alternative ${i + 1} image`),
        identitySlot: optNum(a.identitySlot, `Alternative ${i + 1} colour slot`),
      }
    })
    uniqueIds(alternatives, 'The alternatives')
    const attributes = arr(o.attributes, 'The attributes').map(attribute)
    uniqueIds(attributes, 'The attributes')
    const contextVariables = o.contextVariables == null ? [] : arr(o.contextVariables, 'The context variables').map(contextVariable)
    uniqueIds(contextVariables, 'The context variables')
    const constraints = o.constraints == null ? [] : arr(o.constraints, 'The constraints').map(constraint)

    const b = o.builder == null ? {} : obj(o.builder, 'The choice-task layout')
    let labels: Project['builder']['labels']
    if (b.labels !== undefined && b.labels !== null) {
      const l = obj(b.labels, 'The survey labels')
      labels = {
        choiceColumn: optStr(l.choiceColumn, 'The choice column label'),
        questionStem: optStr(l.questionStem, 'The question text'),
      }
    }
    const builder: Project['builder'] = {
      ...(b as Partial<Project['builder']>),
      attributeOrder: orderOf(b.attributeOrder, attributes.map((a) => a.id), 'The attribute order'),
      alternativeOrder: orderOf(b.alternativeOrder, alternatives.map((a) => a.id), 'The alternative order'),
      layout: b.layout === 'attributes-as-columns' ? 'attributes-as-columns' : 'attributes-as-rows',
      showUnits: b.showUnits !== false,
      optOutPosition: b.optOutPosition === 'first' || b.optOutPosition === 'inline' ? b.optOutPosition : 'last',
      labels,
    }

    let limesurvey: Project['limesurvey']
    if (o.limesurvey !== undefined && o.limesurvey !== null) {
      const l = obj(o.limesurvey, 'The LimeSurvey settings')
      limesurvey = {
        url: optStr(l.url, 'The LimeSurvey address'),
        surveyId: optNum(l.surveyId, 'The LimeSurvey survey ID'),
        username: optStr(l.username, 'The LimeSurvey username'),
      }
    }
    if (o.validationConfig !== undefined && o.validationConfig !== null) obj(o.validationConfig, 'The check settings')

    const now = new Date().toISOString()
    const project: Project = {
      ...(o as unknown as Project),
      id: str(o.id, 'The study id'),
      slug: typeof o.slug === 'string' ? o.slug : '',
      name,
      description: optStr(o.description, 'The study description'),
      createdAt: typeof o.createdAt === 'string' ? o.createdAt : now,
      updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : now,
      experimentType: oneOf(o.experimentType, ['unlabeled', 'labeled'] as const, 'The experiment type'),
      alternatives,
      attributes,
      ...(o.contextVariables == null ? {} : { contextVariables }),
      ...(o.constraints == null ? {} : { constraints }),
      design: o.design == null ? null : checkDesign(o.design),
      builder,
      targetSampleSize: optNum(o.targetSampleSize, 'The target sample size'),
      limesurvey,
    }
    return { ok: true, project }
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: `${e.message}.` }
    return { ok: false, error: 'The study could not be read.' }
  }
}
