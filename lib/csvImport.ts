import type { Project, Attribute, Level, DesignRow, Design, ContextVariable } from './schema'
import { appliesToAlt, cellKey } from './validation'
import { getLevelsForAlt } from './levelLookup'
import { levelDisplayText } from './format'
import { joinNames, plural } from './text'

export type ParsedCsv = {
  headers: string[]
  rows: string[][]
}

// PapaParse options for a design CSV, shared by the upload and the tests.
export const CSV_PARSE_OPTIONS = {
  header: true,
  // 'greedy' also skips the ",,,," rows spreadsheets leave at the end of a file.
  skipEmptyLines: 'greedy' as const,
  transformHeader: (h: string) => h.replace(/^\uFEFF/, '').trim(),
}

/** The parsed rows as strings, in header order. */
export function toParsedCsv(headers: string[], data: Record<string, unknown>[]): ParsedCsv {
  return { headers, rows: data.map((r) => headers.map((h) => String(r[h] ?? ''))) }
}

export type ColumnRole = 'task' | 'block' | 'cell' | 'context' | 'ignore'
// 'index' = level numbers from 1 (1, 2, 3…); 'index0' = level numbers from 0 (Ngene's usual coding).
export type MatchMode = 'value' | 'index' | 'index0'

export type DraftMapping = {
  csvColumn: string
  role: ColumnRole
  alternativeId?: string
  attributeId?: string
  contextVariableId?: string
  matchMode?: MatchMode
  sampleValues: string[]
}

export type ImportPlan = {
  filename: string
  parsed: ParsedCsv
  mappings: DraftMapping[]
}

export type ImportResult = {
  design: Design
  warnings: string[]
}

// Header names compared with every non-alphanumeric character removed ("Choice situation" → "choicesituation").
const TASK_ALIASES = new Set([
  'task', 'taskid', 'choicetask', 'choicetaskid', 'choice', 'choicesituation', 'situation', 'scenario',
  'cs', 'set', 'choiceset', 'question',
])
const BLOCK_ALIASES = new Set(['block', 'blocks', 'blk', 'group', 'version'])
// A column with one of these names means one row per alternative (long format), which isn't supported.
const LONG_FORMAT_ALIASES = new Set(['alt', 'alternative', 'altid', 'alternativeid', 'concept', 'option'])

function squash(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

function contextAsAttribute(cv: ContextVariable): Attribute {
  return { ...cv, appliesTo: 'all', position: cv.position }
}

function columnValues(parsed: ParsedCsv, idx: number): string[] {
  return parsed.rows.map((r) => (r[idx] ?? '').trim())
}

// ── level matching ──────────────────────────────────────────────────────────

const TRUE_WORDS = new Set(['true', '1', 'yes', 'y', 't'])
const FALSE_WORDS = new Set(['false', '0', 'no', 'n', 'f'])

function levelIsTrue(level: Level): boolean {
  const v = level.value
  return v === true || v === 1 || (typeof v === 'string' && TRUE_WORDS.has(v.trim().toLowerCase()))
}

// "15", "15.0", "2,50", "€2.00", "15 min", "−3" → number; anything with more than one number → NaN.
function parseNumber(raw: string): number {
  let s = raw.trim().replace(/−/g, '-')
  if (/^[-+]?\d+,\d+$/.test(s)) s = s.replace(',', '.')
  const direct = Number(s)
  if (s !== '' && Number.isFinite(direct)) return direct
  const m = s.match(/^[^\d+\-.]*([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s*[^\d]*$/i)
  return m ? Number(m[1]) : NaN
}

function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
}

function normalText(s: string): string {
  return s.trim().replace(/−/g, '-').replace(/\s+/g, ' ').toLowerCase()
}

function levelNumber(raw: string): number | null {
  const n = Number(raw.trim())
  return raw.trim() !== '' && Number.isInteger(n) ? n : null
}

export function matchLevel(
  attr: Attribute,
  csvValue: string,
  mode: MatchMode,
  altId?: string,
): Level | null {
  const trimmed = csvValue.trim()
  if (trimmed === '') return null
  // Use the per-alt override level set when available, else the default.
  const levels = altId ? getLevelsForAlt(attr, altId) : attr.levels
  if (mode === 'index' || mode === 'index0') {
    const n = levelNumber(trimmed)
    if (n === null) return null
    const idx = mode === 'index' ? n - 1 : n
    return idx >= 0 && idx < levels.length ? levels[idx] : null
  }
  if (attr.type === 'boolean') {
    const word = trimmed.toLowerCase()
    const want = TRUE_WORDS.has(word) ? true : FALSE_WORDS.has(word) ? false : null
    if (want !== null) {
      const hit = levels.find((l) => levelIsTrue(l) === want)
      if (hit) return hit
    }
  }
  if (attr.type === 'numeric') {
    const b = parseNumber(trimmed)
    if (Number.isFinite(b)) {
      const hit = levels.find((l) => {
        const a = Number(l.value)
        return Number.isFinite(a) && sameNumber(a, b)
      })
      if (hit) return hit
    }
  }
  // The level as entered, its display value, or the text the app itself shows (e.g. "€2.00").
  const want = normalText(trimmed)
  for (const level of levels) {
    if (normalText(String(level.value)) === want) return level
    if (level.displayValue && normalText(level.displayValue) === want) return level
    if (normalText(levelDisplayText(attr, level)) === want) return level
  }
  return null
}

// Level values first; level numbers only when no value in the column reads as a level, so a
// numeric attribute with levels 1/3/7 is never silently reread as positions.
function detectMatchMode(attr: Attribute, values: string[], altId?: string): MatchMode {
  const present = values.filter((v) => v !== '')
  if (present.length === 0) return 'value'
  const byValue = present.filter((v) => matchLevel(attr, v, 'value', altId)).length
  if (byValue > 0) return 'value'
  const n = (altId ? getLevelsForAlt(attr, altId) : attr.levels).length
  const nums = present.map(levelNumber)
  if (nums.some((x) => x === null)) return 'value'
  const ints = nums as number[]
  if (ints.every((x) => x >= 1 && x <= n)) return 'index'
  if (ints.every((x) => x >= 0 && x <= n - 1)) return 'index0'
  return 'value'
}

// ── auto-detection ──────────────────────────────────────────────────────────

type Named = { id: string; name: string }

// How specifically a header names an item: all of its id or name tokens present (score = token
// count), else 0. The caller picks the single best item, so "alt-2_price" finds Alt 2, not Alt 1.
function fullScore(item: Named, headerTokens: Set<string>): number {
  let best = 0
  for (const src of [item.id, item.name]) {
    const t = tokens(src)
    if (t.length > 0 && t.every((x) => headerTokens.has(x))) best = Math.max(best, t.length)
  }
  return best
}

function uniqueBest<T>(items: T[], score: (x: T) => number): T | undefined {
  let best: T | undefined
  let top = 0
  let tie = false
  for (const x of items) {
    const s = score(x)
    if (s > top) {
      top = s
      best = x
      tie = false
    } else if (s === top && s > 0) tie = true
  }
  return top > 0 && !tie ? best : undefined
}

// "alt1", "alternative2", "option3", or "alt 1": the n-th designed alternative (Ngene, R output).
function positionalAlt(headerTokens: string[], count: number): number | null {
  for (let i = 0; i < headerTokens.length; i++) {
    const t = headerTokens[i]
    const joined = t.match(/^(?:alt|alternative|option|opt)(\d+)$/)?.[1]
    const split = /^(?:alt|alternative|option|opt)$/.test(t) && /^\d+$/.test(headerTokens[i + 1] ?? '') ? headerTokens[i + 1] : undefined
    const digits = joined ?? split
    if (digits !== undefined) {
      const n = Number(digits)
      return n >= 1 && n <= count ? n - 1 : null
    }
  }
  return null
}

export function autoDetectMapping(parsed: ParsedCsv, project: Project): DraftMapping[] {
  const designed = project.alternatives.filter((a) => !a.isOptOut)
  const alts: Named[] = designed.map((a) => ({ id: a.id, name: a.label }))
  const contextVars = project.contextVariables ?? []

  // Exact headers this app writes: the template ("<alt id>_<attr id>", context "<id>") and the
  // design matrix copy ("<alt label>: <attr name>", context "<name>").
  const exact = new Map<string, { alt?: string; attr?: string; cv?: string } | null>()
  const put = (key: string, v: { alt?: string; attr?: string; cv?: string }) => {
    const k = squash(key)
    if (!k) return
    exact.set(k, exact.has(k) ? null : v) // a collision is ambiguous
  }
  for (const alt of designed) {
    for (const attr of project.attributes) {
      if (!appliesToAlt(attr, alt.id)) continue
      put(`${alt.id}_${attr.id}`, { alt: alt.id, attr: attr.id })
      put(`${alt.label}: ${attr.name}`, { alt: alt.id, attr: attr.id })
    }
  }
  for (const cv of contextVars) {
    put(cv.id, { cv: cv.id })
    put(cv.name, { cv: cv.id })
  }

  return parsed.headers.map((header, idx) => {
    const values = columnValues(parsed, idx)
    const sample = values.filter((v) => v !== '').slice(0, 8)
    const key = squash(header)
    const base = { csvColumn: header, sampleValues: sample }

    const cellOf = (altId: string, attrId: string): DraftMapping => {
      const attr = project.attributes.find((a) => a.id === attrId)!
      return { ...base, role: 'cell', alternativeId: altId, attributeId: attrId, matchMode: detectMatchMode(attr, values, altId) }
    }
    const contextOf = (cvId: string): DraftMapping => {
      const cv = contextVars.find((c) => c.id === cvId)!
      return { ...base, role: 'context', contextVariableId: cvId, matchMode: detectMatchMode(contextAsAttribute(cv), values) }
    }

    const hit = exact.get(key)
    if (hit?.alt && hit.attr) return cellOf(hit.alt, hit.attr)
    if (hit?.cv) return contextOf(hit.cv)

    if (TASK_ALIASES.has(key)) return { ...base, role: 'task' }
    if (BLOCK_ALIASES.has(key)) return { ...base, role: 'block' }

    const headerTokenList = tokens(header)
    const headerTokens = new Set(headerTokenList)
    let alt = uniqueBest(alts, (a) => fullScore(a, headerTokens))
    if (!alt) {
      const pos = positionalAlt(headerTokenList, designed.length)
      if (pos !== null) alt = alts[pos]
    }

    if (!alt) {
      const cv = uniqueBest(contextVars.map((c) => ({ id: c.id, name: c.name })), (c) => fullScore(c, headerTokens))
      return cv ? contextOf(cv.id) : { ...base, role: 'ignore' }
    }

    // The attribute is named by what the alternative didn't use up.
    const altTokens = new Set([...tokens(alt.id), ...tokens(alt.name)])
    const rest = new Set(headerTokenList.filter((t) => !altTokens.has(t) && !/^(?:alt|alternative|option|opt)\d*$/.test(t)))
    const candidates = project.attributes.filter((a) => appliesToAlt(a, alt!.id))
    const named = candidates.map((a) => ({ id: a.id, name: a.name }))
    const attr =
      uniqueBest(named, (a) => fullScore(a, rest)) ??
      uniqueBest(named, (a) => [...new Set([...tokens(a.id), ...tokens(a.name)])].filter((t) => rest.has(t)).length)
    return attr ? cellOf(alt.id, attr.id) : { ...base, role: 'ignore' }
  })
}

// ── validation ──────────────────────────────────────────────────────────────

export type MappingValidation = {
  errors: string[]
  warnings: string[]
}

function listCapped(items: string[], max = 4): string {
  return joinNames(items.length > max ? [...items.slice(0, max - 1), `${items.length - (max - 1)} more`] : items)
}

// CSV line numbers as a spreadsheet shows them: the header is line 1.
function lineList(rowIdx: number[]): string {
  return listCapped(rowIdx.map((i) => String(i + 2)))
}

type BlockPlan = { blockOf: number[]; renumbered: string | null; blank: number[] }

// Whatever the file calls its blocks (0/1, A/B, 1/3), number them 1…B: numerically when every
// label is a number, else in order of first appearance.
function planBlocks(parsed: ParsedCsv, blockIdx: number | null): BlockPlan {
  if (blockIdx === null) return { blockOf: parsed.rows.map(() => 1), renumbered: null, blank: [] }
  const raw = columnValues(parsed, blockIdx)
  const blank = raw.flatMap((v, i) => (v === '' ? [i] : []))
  const labels = Array.from(new Set(raw.filter((v) => v !== '')))
  const numeric = labels.every((l) => Number.isFinite(Number(l)))
  if (numeric) labels.sort((a, b) => Number(a) - Number(b))
  const number = new Map(labels.map((l, i) => [l, i + 1]))
  const identity = labels.every((l, i) => numeric && Number(l) === i + 1)
  return {
    blockOf: raw.map((v) => number.get(v) ?? 1),
    renumbered: identity
      ? null
      : `The blocks in the file (${listCapped(labels, 6)}) are numbered ${labels.length === 1 ? '1' : `1 to ${labels.length}`} in UtilityLab.`,
    blank,
  }
}

export function validateMappings(
  parsed: ParsedCsv,
  mappings: DraftMapping[],
  project: Project,
): MappingValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const headerIndex = new Map(parsed.headers.map((h, i) => [h, i]))
  const altName = (id?: string) => project.alternatives.find((a) => a.id === id)?.label ?? id ?? ''
  const attrById = new Map(project.attributes.map((a) => [a.id, a]))

  if (parsed.rows.length === 0) errors.push('The file has no rows below the header.')

  const taskCols = mappings.filter((m) => m.role === 'task')
  const blockCols = mappings.filter((m) => m.role === 'block')
  if (taskCols.length > 1) errors.push(`Only one column can be the choice task number (${joinNames(taskCols.map((m) => `"${m.csvColumn}"`))}).`)
  if (blockCols.length > 1) errors.push(`Only one column can be the block (${joinNames(blockCols.map((m) => `"${m.csvColumn}"`))}).`)

  const cellMappings = mappings.filter((m) => m.role === 'cell')
  if (cellMappings.length === 0) {
    const long = parsed.headers.some((h) => LONG_FORMAT_ALIASES.has(squash(h)))
    errors.push(
      long
        ? 'This looks like long format, with one row per alternative. UtilityLab needs one row per choice task, with a column for each alternative × attribute (e.g. car_travel_time). Download the template to see the layout.'
        : 'No column is mapped to an alternative and attribute. Pick them in the table, or download the template to see the layout.',
    )
  }

  for (const m of cellMappings) {
    if (!m.alternativeId || !m.attributeId) {
      errors.push(`Column "${m.csvColumn}" is set to Cell but has no alternative or attribute picked.`)
      continue
    }
    const attr = attrById.get(m.attributeId)
    if (attr && !appliesToAlt(attr, m.alternativeId)) {
      errors.push(`Column "${m.csvColumn}": ${attr.name} is not shown for ${altName(m.alternativeId)}. Pick another alternative or attribute, or set the column to Ignore.`)
    }
  }

  const seen = new Map<string, string>()
  for (const m of cellMappings) {
    if (!m.alternativeId || !m.attributeId) continue
    const k = cellKey(m.alternativeId, m.attributeId)
    const first = seen.get(k)
    if (first) {
      errors.push(`Columns "${first}" and "${m.csvColumn}" are both mapped to ${altName(m.alternativeId)} · ${attrById.get(m.attributeId)?.name ?? m.attributeId}. Only one is allowed.`)
    } else seen.set(k, m.csvColumn)
  }

  // Every alternative × attribute the respondents will see needs a column.
  const missing: string[] = []
  for (const alt of project.alternatives.filter((a) => !a.isOptOut)) {
    for (const attr of project.attributes) {
      if (!appliesToAlt(attr, alt.id) || getLevelsForAlt(attr, alt.id).length === 0) continue
      if (!seen.has(cellKey(alt.id, attr.id))) missing.push(`${alt.label} · ${attr.name}`)
    }
  }
  if (missing.length > 0 && cellMappings.length > 0) {
    errors.push(`No column is mapped to ${listCapped(missing, 6)}. Every alternative needs a level for each attribute shown for it; map a column, or remove the attribute from that alternative in 01 Structure.`)
  }

  // Values: every cell must name a level, with nothing blank.
  const checkValues = (m: DraftMapping, attr: Attribute, label: string, altId?: string) => {
    const idx = headerIndex.get(m.csvColumn)
    if (idx === undefined) return
    const values = columnValues(parsed, idx)
    const mode = m.matchMode ?? 'value'
    const blank: number[] = []
    const bad: number[] = []
    values.forEach((v, i) => {
      if (v === '') blank.push(i)
      else if (!matchLevel(attr, v, mode, altId)) bad.push(i)
    })
    if (blank.length > 0) {
      errors.push(`Column "${m.csvColumn}" is blank on ${plural(blank.length, 'line')} (${lineList(blank)}). Every choice task needs a level for ${label}.`)
    }
    if (bad.length > 0) {
      const levels = altId ? getLevelsForAlt(attr, altId) : attr.levels
      const examples = Array.from(new Set(bad.map((i) => `"${values[i]}"`))).slice(0, 3)
      let hint = ''
      if (mode === 'value') {
        const nums = bad.map((i) => levelNumber(values[i]))
        if (nums.every((n) => n !== null && n >= 0 && n <= levels.length)) {
          hint = nums.some((n) => n === 0)
            ? ' If the column holds level numbers counted from 0, set Match to “Level number, from 0”.'
            : ' If the column holds level numbers, set Match to “Level number”.'
        }
      } else {
        hint = ` ${label} has ${plural(levels.length, 'level')}, so level numbers run from ${mode === 'index' ? `1 to ${levels.length}` : `0 to ${levels.length - 1}`}.`
      }
      errors.push(`Column "${m.csvColumn}": ${examples.join(', ')} ${bad.length === 1 ? 'does' : 'do'} not match any level of ${label} (${plural(bad.length, 'line')}: ${lineList(bad)}).${hint}`)
    }
  }

  for (const m of cellMappings) {
    if (!m.alternativeId || !m.attributeId) continue
    const attr = attrById.get(m.attributeId)
    if (attr) checkValues(m, attr, `${altName(m.alternativeId)} · ${attr.name}`, m.alternativeId)
  }

  const contextVars = project.contextVariables ?? []
  const contextMappings = mappings.filter((m) => m.role === 'context')
  const cvSeen = new Map<string, string>()
  for (const m of contextMappings) {
    if (!m.contextVariableId) {
      errors.push(`Column "${m.csvColumn}" is set to Context variable but has no context variable picked.`)
      continue
    }
    const cv = contextVars.find((c) => c.id === m.contextVariableId)
    if (!cv) continue
    const first = cvSeen.get(cv.id)
    if (first) errors.push(`Columns "${first}" and "${m.csvColumn}" are both mapped to the context variable ${cv.name}. Only one is allowed.`)
    else cvSeen.set(cv.id, m.csvColumn)
    checkValues(m, contextAsAttribute(cv), `the context variable ${cv.name}`)
  }
  const cvMissing = contextVars.filter((cv) => cv.levels.length > 0 && !cvSeen.has(cv.id)).map((cv) => cv.name)
  if (cvMissing.length > 0 && cellMappings.length > 0) {
    errors.push(`No column is mapped to the context variable${cvMissing.length === 1 ? '' : 's'} ${listCapped(cvMissing, 6)}. Map a column, or remove the context variable in 01 Structure.`)
  }

  // Choice task numbers and blocks.
  const taskIdx = taskCols.length === 1 ? headerIndex.get(taskCols[0].csvColumn) ?? null : null
  const blockIdx = blockCols.length === 1 ? headerIndex.get(blockCols[0].csvColumn) ?? null : null
  const blocks = planBlocks(parsed, blockIdx)
  if (blocks.blank.length > 0) {
    errors.push(`The block column "${blockCols[0].csvColumn}" is blank on ${plural(blocks.blank.length, 'line')} (${lineList(blocks.blank)}).`)
  }
  if (blocks.renumbered) warnings.push(blocks.renumbered)
  if (taskIdx !== null) {
    const raw = columnValues(parsed, taskIdx)
    const bad = raw.flatMap((v, i) => (levelNumber(v) === null || Number(v) < 1 ? [i] : []))
    if (bad.length > 0) {
      errors.push(`The choice task column "${taskCols[0].csvColumn}" needs whole numbers from 1; ${plural(bad.length, 'line')} ${bad.length === 1 ? 'has' : 'have'} something else (${lineList(bad)}).`)
    } else {
      const firstLine = new Map<string, number>()
      const dupes: string[] = []
      raw.forEach((v, i) => {
        const k = `${blocks.blockOf[i]}:${Number(v)}`
        if (firstLine.has(k)) dupes.push(`${Number(v)} (lines ${firstLine.get(k)! + 2} and ${i + 2})`)
        else firstLine.set(k, i)
      })
      if (dupes.length > 0) {
        errors.push(`Choice task ${listCapped(dupes, 3)} ${dupes.length === 1 ? 'appears' : 'appear'} twice in the same block. Each choice task needs its own number within its block.`)
      }
    }
  }

  return { errors, warnings }
}

// ── design ──────────────────────────────────────────────────────────────────

// Builds the design from a mapping that passed validateMappings (which the UI requires before Apply).
export function buildDesign(plan: ImportPlan, project: Project): ImportResult {
  const { parsed, mappings, filename } = plan
  const headerIndex = new Map(parsed.headers.map((h, i) => [h, i]))

  const taskCol = mappings.find((m) => m.role === 'task')
  const blockCol = mappings.find((m) => m.role === 'block')
  const cellCols = mappings.filter((m) => m.role === 'cell' && m.alternativeId && m.attributeId)
  const contextCols = mappings.filter((m) => m.role === 'context' && m.contextVariableId)

  const warnings: string[] = []
  const blocks = planBlocks(parsed, blockCol ? headerIndex.get(blockCol.csvColumn) ?? null : null)
  if (blocks.renumbered) warnings.push(blocks.renumbered)
  const designRows: DesignRow[] = []

  parsed.rows.forEach((csvRow, i) => {
    const taskRaw = taskCol ? (csvRow[headerIndex.get(taskCol.csvColumn)!] ?? '').trim() : ''
    const taskId = levelNumber(taskRaw) ?? i + 1
    const block = blocks.blockOf[i]

    const cells: Record<string, string> = {}
    for (const cm of cellCols) {
      const attr = project.attributes.find((a) => a.id === cm.attributeId)
      if (!attr) continue
      const csvVal = csvRow[headerIndex.get(cm.csvColumn)!] ?? ''
      const level = matchLevel(attr, csvVal, cm.matchMode ?? 'value', cm.alternativeId)
      if (!level) {
        if (csvVal.trim() !== '') warnings.push(`Line ${i + 2}: "${csvVal}" in column "${cm.csvColumn}" did not match any level`)
        continue
      }
      cells[cellKey(cm.alternativeId!, cm.attributeId!)] = level.id
    }

    const context: Record<string, string> = {}
    for (const cm of contextCols) {
      const cv = (project.contextVariables ?? []).find((c) => c.id === cm.contextVariableId)
      if (!cv) continue
      const csvVal = csvRow[headerIndex.get(cm.csvColumn)!] ?? ''
      const level = matchLevel(contextAsAttribute(cv), csvVal, cm.matchMode ?? 'value')
      if (!level) {
        if (csvVal.trim() !== '') warnings.push(`Line ${i + 2}: context value "${csvVal}" in column "${cm.csvColumn}" did not match any level of "${cv.name}"`)
        continue
      }
      context[cv.id] = level.id
    }

    designRows.push({ taskId, block, cells, context })
  })

  return {
    design: {
      source: 'csv',
      uploadedAt: new Date().toISOString(),
      filename,
      numTasks: designRows.length,
      numBlocks: Math.max(1, new Set(designRows.map((r) => r.block)).size),
      rows: designRows,
      mapping: mappings.map((m) => ({
        csvColumn: m.csvColumn,
        role: m.role,
        alternativeId: m.alternativeId,
        attributeId: m.attributeId,
        contextVariableId: m.contextVariableId,
      })),
      rawHeaders: parsed.headers,
    },
    warnings,
  }
}

export function generateTemplateCsv(project: Project): string {
  const headers = ['task', 'block']
  for (const alt of project.alternatives) {
    if (alt.isOptOut) continue
    for (const attr of project.attributes) {
      if (!appliesToAlt(attr, alt.id)) continue
      headers.push(`${alt.id}_${attr.id}`)
    }
  }
  for (const cv of project.contextVariables ?? []) {
    headers.push(cv.id)
  }
  return headers.join(',') + '\n'
}
