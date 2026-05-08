import type { Project, Attribute, Level, DesignRow, Design } from './schema'
import { cellKey } from './validation'

export type ParsedCsv = {
  headers: string[]
  rows: string[][]
}

export type ColumnRole = 'task' | 'block' | 'cell' | 'context' | 'ignore'
export type MatchMode = 'value' | 'index'

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

const TASK_ALIASES = ['task', 'taskid', 'task_id', 'choice', 'situation', 'scenario', 'cs']
const BLOCK_ALIASES = ['block', 'group', 'version', 'set']

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[._\-\s/]+/)
    .filter(Boolean)
}

function attrTokens(attr: Attribute): string[] {
  return [...tokens(attr.id), ...tokens(attr.name)]
}

function altTokens(alt: { id: string; label: string }): string[] {
  return [...tokens(alt.id), ...tokens(alt.label)]
}

export function autoDetectMapping(parsed: ParsedCsv, project: Project): DraftMapping[] {
  return parsed.headers.map((header, idx) => {
    const sample = parsed.rows
      .slice(0, 8)
      .map((r) => r[idx] ?? '')
      .filter((v) => v !== '')
    const lower = header.toLowerCase().trim()

    if (TASK_ALIASES.includes(lower)) {
      return { csvColumn: header, role: 'task', sampleValues: sample }
    }
    if (BLOCK_ALIASES.includes(lower)) {
      return { csvColumn: header, role: 'block', sampleValues: sample }
    }

    const headerTokens = tokens(header)

    // Scenario context: column whose tokens match a context variable's id/name
    // and which doesn't reference any alternative (otherwise it would be a cell).
    const contextMatch = (project.contextVariables ?? []).find((cv) => {
      const cvTokens = [...tokens(cv.id), ...tokens(cv.name)]
      return cvTokens.some((t) => headerTokens.includes(t))
    })
    const altMatch = project.alternatives.find((a) =>
      altTokens(a).some((t) => headerTokens.includes(t)),
    )

    if (contextMatch && !altMatch) {
      return {
        csvColumn: header,
        role: 'context',
        contextVariableId: contextMatch.id,
        matchMode: detectMatchMode(
          {
            ...contextMatch,
            appliesTo: 'all',
            position: 0,
          } as Attribute,
          sample,
        ),
        sampleValues: sample,
      }
    }

    const attrMatch = project.attributes.find((a) =>
      attrTokens(a).some((t) => headerTokens.includes(t)),
    )

    if (altMatch && attrMatch) {
      return {
        csvColumn: header,
        role: 'cell',
        alternativeId: altMatch.id,
        attributeId: attrMatch.id,
        matchMode: detectMatchMode(attrMatch, sample),
        sampleValues: sample,
      }
    }

    return { csvColumn: header, role: 'ignore', sampleValues: sample }
  })
}

function detectMatchMode(attr: Attribute, sample: string[]): MatchMode {
  if (sample.length === 0) return 'value'
  // If every sample value parses as an integer in 1..levels.length, it's likely level-coded
  const allIntegerInRange = sample.every((v) => {
    const n = Number(v)
    return Number.isInteger(n) && n >= 1 && n <= attr.levels.length
  })
  if (!allIntegerInRange) return 'value'
  // If the attribute is numeric and the level values are themselves integers in that same range,
  // we can't distinguish — default to value mode and let the user toggle.
  if (attr.type === 'numeric') {
    const levelValues = attr.levels.map((l) => Number(l.value))
    const sortedLevels = [...levelValues].sort((a, b) => a - b)
    const looksLikeLevels = sortedLevels.every((v, i) => v === i + 1)
    return looksLikeLevels ? 'value' : 'index'
  }
  return 'index'
}

export function matchLevel(
  attr: Attribute,
  csvValue: string,
  mode: MatchMode,
): Level | null {
  const trimmed = csvValue.trim()
  if (mode === 'index') {
    const idx = parseInt(trimmed, 10) - 1
    if (idx >= 0 && idx < attr.levels.length) return attr.levels[idx]
    return null
  }
  for (const level of attr.levels) {
    if (attr.type === 'numeric') {
      const a = Number(level.value)
      const b = Number(trimmed)
      if (!Number.isNaN(a) && !Number.isNaN(b) && a === b) return level
      continue
    }
    if (attr.type === 'boolean') {
      const lv = Boolean(level.value)
      const cv = trimmed.toLowerCase() === 'true' || trimmed === '1'
      if (lv === cv) return level
      continue
    }
    if (String(level.value).toLowerCase() === trimmed.toLowerCase()) return level
    if (level.displayValue && level.displayValue.toLowerCase() === trimmed.toLowerCase()) {
      return level
    }
  }
  return null
}

export type MappingValidation = {
  errors: string[]
  warnings: string[]
}

export function validateMappings(
  parsed: ParsedCsv,
  mappings: DraftMapping[],
  project: Project,
): MappingValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const cellMappings = mappings.filter((m) => m.role === 'cell')

  for (const m of cellMappings) {
    if (!m.alternativeId || !m.attributeId) {
      errors.push(`Column "${m.csvColumn}" is set to Cell but missing alternative or attribute`)
    }
  }

  const seen = new Set<string>()
  for (const m of cellMappings) {
    if (!m.alternativeId || !m.attributeId) continue
    const k = cellKey(m.alternativeId, m.attributeId)
    if (seen.has(k)) {
      errors.push(
        `Multiple columns mapped to ${m.alternativeId}.${m.attributeId} — only one allowed`,
      )
    }
    seen.add(k)
  }

  // Match preview: count unmatched values per cell mapping
  const headerIndex: Record<string, number> = {}
  parsed.headers.forEach((h, i) => (headerIndex[h] = i))
  for (const m of cellMappings) {
    if (!m.alternativeId || !m.attributeId) continue
    const attr = project.attributes.find((a) => a.id === m.attributeId)
    if (!attr) continue
    let total = 0
    let unmatched = 0
    for (const row of parsed.rows) {
      const v = row[headerIndex[m.csvColumn]] ?? ''
      if (v === '') continue
      total++
      if (!matchLevel(attr, v, m.matchMode ?? 'value')) unmatched++
    }
    if (unmatched > 0) {
      warnings.push(
        `Column "${m.csvColumn}": ${unmatched} of ${total} values do not match any level on attribute "${attr.name}"`,
      )
    }
  }

  // Validate context mappings
  const contextMappings = mappings.filter((m) => m.role === 'context')
  for (const m of contextMappings) {
    if (!m.contextVariableId) {
      errors.push(`Column "${m.csvColumn}" is set to Context but missing variable`)
      continue
    }
    const cv = (project.contextVariables ?? []).find(
      (c) => c.id === m.contextVariableId,
    )
    if (!cv) continue
    const cvAsAttr = { ...cv, appliesTo: 'all' as const, position: 0 } as Attribute
    let total = 0
    let unmatched = 0
    for (const row of parsed.rows) {
      const v = row[headerIndex[m.csvColumn]] ?? ''
      if (v === '') continue
      total++
      if (!matchLevel(cvAsAttr, v, m.matchMode ?? 'value')) unmatched++
    }
    if (unmatched > 0) {
      warnings.push(
        `Column "${m.csvColumn}": ${unmatched} of ${total} values do not match any level on context "${cv.name}"`,
      )
    }
  }

  return { errors, warnings }
}

export function buildDesign(plan: ImportPlan, project: Project): ImportResult {
  const { parsed, mappings, filename } = plan
  const headerIndex: Record<string, number> = {}
  parsed.headers.forEach((h, i) => (headerIndex[h] = i))

  const taskCol = mappings.find((m) => m.role === 'task')
  const blockCol = mappings.find((m) => m.role === 'block')
  const cellCols = mappings.filter(
    (m) => m.role === 'cell' && m.alternativeId && m.attributeId,
  )
  const contextCols = mappings.filter(
    (m) => m.role === 'context' && m.contextVariableId,
  )

  const warnings: string[] = []
  const designRows: DesignRow[] = []

  parsed.rows.forEach((csvRow, i) => {
    const taskRaw = taskCol ? csvRow[headerIndex[taskCol.csvColumn]] : ''
    const taskId = Number(taskRaw) || i + 1
    const blockRaw = blockCol ? csvRow[headerIndex[blockCol.csvColumn]] : ''
    const block = Number(blockRaw) || 1

    const cells: Record<string, string> = {}
    for (const cm of cellCols) {
      const attr = project.attributes.find((a) => a.id === cm.attributeId)
      if (!attr) continue
      const csvVal = csvRow[headerIndex[cm.csvColumn]] ?? ''
      if (csvVal === '') continue
      const level = matchLevel(attr, csvVal, cm.matchMode ?? 'value')
      if (!level) {
        warnings.push(
          `Choice task ${taskId}: value "${csvVal}" in column "${cm.csvColumn}" did not match any level`,
        )
        continue
      }
      cells[cellKey(cm.alternativeId!, cm.attributeId!)] = level.id
    }

    const context: Record<string, string> = {}
    for (const cm of contextCols) {
      const cv = (project.contextVariables ?? []).find(
        (c) => c.id === cm.contextVariableId,
      )
      if (!cv) continue
      const csvVal = csvRow[headerIndex[cm.csvColumn]] ?? ''
      if (csvVal === '') continue
      const cvAsAttr = { ...cv, appliesTo: 'all' as const, position: 0 } as Attribute
      const level = matchLevel(cvAsAttr, csvVal, cm.matchMode ?? 'value')
      if (!level) {
        warnings.push(
          `Choice task ${taskId}: context value "${csvVal}" in column "${cm.csvColumn}" did not match any level of "${cv.name}"`,
        )
        continue
      }
      context[cv.id] = level.id
    }

    designRows.push({ taskId, block, cells, context })
  })

  const numBlocks = Math.max(1, ...designRows.map((r) => r.block))

  return {
    design: {
      source: 'csv',
      uploadedAt: new Date().toISOString(),
      filename,
      numTasks: designRows.length,
      numBlocks,
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
      const applies = attr.appliesTo === 'all' || attr.appliesTo.includes(alt.id)
      if (!applies) continue
      headers.push(`${alt.id}_${attr.id}`)
    }
  }
  for (const cv of project.contextVariables ?? []) {
    headers.push(cv.id)
  }
  return headers.join(',') + '\n'
}
