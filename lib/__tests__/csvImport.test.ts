import { describe, expect, it } from 'vitest'
import Papa from 'papaparse'
import type { Attribute, Project } from '../schema'
import { travelModeExample } from '../example'
import { blankStudy } from '../library'
import { createAttribute } from '../defaults'
import { generateDesign } from '../designGenerator'
import { buildDesignMatrix, designMatrixCsv } from '../designMatrix'
import { designFit } from '../designFit'
import { findLevelInAttr } from '../levelLookup'
import { cellKey } from '../validation'
import {
  CSV_PARSE_OPTIONS,
  autoDetectMapping,
  buildDesign,
  generateTemplateCsv,
  toParsedCsv,
  validateMappings,
  type DraftMapping,
  type ParsedCsv,
} from '../csvImport'

function parse(text: string): ParsedCsv {
  const res = Papa.parse<Record<string, string>>(text, CSV_PARSE_OPTIONS)
  return toParsedCsv(res.meta.fields ?? [], res.data)
}

function load(project: Project, text: string) {
  const parsed = parse(text)
  const mappings = autoDetectMapping(parsed, project)
  const validation = validateMappings(parsed, mappings, project)
  return { parsed, mappings, validation }
}

function cell(mappings: DraftMapping[], column: string) {
  return mappings.find((m) => m.csvColumn === column)!
}

function attr(id: string, type: Attribute['type'], values: (number | string | boolean)[]): Attribute {
  return {
    id,
    name: id[0].toUpperCase() + id.slice(1),
    type,
    appliesTo: 'all',
    position: 0,
    levels: values.map((v, i) => ({ id: `${id}${i}`, value: v, position: i })),
  }
}

// Unlabeled "Alt 1" / "Alt 2" with price 5/10/15, quality Low/Medium/High, delivery 1/3/7 days.
function ngeneStudy(): Project {
  const p = blankStudy({ alternatives: ['Alt 1', 'Alt 2'], starterAttribute: false })
  return {
    ...p,
    attributes: [
      attr('price', 'numeric', [5, 10, 15]),
      attr('quality', 'categorical', ['Low', 'Medium', 'High']),
      { ...attr('delivery', 'numeric', [1, 3, 7]), name: 'Delivery days' },
    ],
  }
}

const NGENE_HEADER = 'Choice situation,alt1.price,alt1.quality,alt1.delivery,alt2.price,alt2.quality,alt2.delivery,Block'

describe('CSV import: auto-detection', () => {
  it('maps every column of the template back to its own alternative and attribute', () => {
    const p = structuredClone(travelModeExample)
    const { mappings } = load(p, generateTemplateCsv(p) + '1,1' + ',x'.repeat(30) + '\n')
    for (const m of mappings.filter((m) => m.role === 'cell')) {
      expect(m.csvColumn).toBe(`${m.alternativeId}_${m.attributeId}`)
    }
    for (const m of mappings.filter((m) => m.role === 'context')) expect(m.csvColumn).toBe(m.contextVariableId)
  })

  it('tells look-alike default names apart in a new study', () => {
    let p = blankStudy({ alternatives: 3, starterAttribute: false })
    for (let i = 0; i < 3; i++) p = { ...p, attributes: [...p.attributes, createAttribute(p)] }
    const { mappings } = load(p, generateTemplateCsv(p))
    const cells = mappings.filter((m) => m.role === 'cell')
    expect(cells).toHaveLength(9)
    expect(new Set(cells.map((m) => cellKey(m.alternativeId!, m.attributeId!))).size).toBe(9)
  })

  it('reads Ngene headers: choice situation, block and alternatives by position', () => {
    const p = ngeneStudy()
    const { mappings } = load(p, `${NGENE_HEADER}\n1,5,Low,1,10,High,7,1\n`)
    expect(cell(mappings, 'Choice situation').role).toBe('task')
    expect(cell(mappings, 'Block').role).toBe('block')
    expect(cell(mappings, 'alt2.delivery')).toMatchObject({ role: 'cell', alternativeId: p.alternatives[1].id, attributeId: 'delivery' })
  })

  it('keeps real values as values and spots 0-based level numbers', () => {
    const p = ngeneStudy()
    // Delivery 1/3/7 written as values: must not be reread as level numbers (3 days → 7).
    const asValues = load(p, `${NGENE_HEADER}\n1,5,Low,1,10,High,3,1\n2,15,Medium,3,5,Low,7,1\n`)
    expect(cell(asValues.mappings, 'alt1.delivery').matchMode).toBe('value')
    // Ngene's 0-based codes.
    const coded = load(p, `${NGENE_HEADER}\n1,0,0,0,2,2,2,1\n2,1,1,2,0,0,0,1\n`)
    expect(cell(coded.mappings, 'alt1.quality').matchMode).toBe('index0')
    expect(coded.validation.errors).toEqual([])
    // 0/1 for levels 1/3/7 could be either; it is flagged with a hint, never guessed.
    const ambiguous = load(p, `${NGENE_HEADER}\n1,0,0,0,2,2,2,1\n2,1,1,1,0,0,0,1\n`)
    expect(ambiguous.validation.errors.join(' ')).toMatch(/set Match to “Level number, from 0”/)
    const { design } = buildDesign({ filename: 'x.csv', parsed: coded.parsed, mappings: coded.mappings }, p)
    expect(design.rows[0].cells[cellKey(p.alternatives[1].id, 'quality')]).toBe('quality2')
  })
})

describe('CSV import: validation blocks bad designs', () => {
  it('rejects a value that matches no level, naming the line', () => {
    const { validation } = load(ngeneStudy(), `${NGENE_HEADER}\n1,5,Low,1,10,High,7,1\n2,20,Low,1,10,High,7,1\n`)
    expect(validation.errors.join(' ')).toMatch(/"20" does not match any level of Alt 1 · Price \(1 line: 3\)/)
  })

  it('rejects a missing column and blank cells', () => {
    const p = ngeneStudy()
    const missing = load(p, 'Choice situation,alt1.price,alt1.quality,alt2.price,alt2.quality,alt2.delivery,Block\n1,5,Low,10,High,7,1\n')
    expect(missing.validation.errors.join(' ')).toMatch(/No column is mapped to Alt 1 · Delivery days/)
    const blank = load(p, `${NGENE_HEADER}\n1,5,,1,10,High,7,1\n`)
    expect(blank.validation.errors.join(' ')).toMatch(/"alt1.quality" is blank on 1 line \(2\)/)
  })

  it('reads yes/no booleans and rejects anything else', () => {
    const p = { ...ngeneStudy(), attributes: [attr('fiveg', 'boolean', [true, false])] }
    const ok = load(p, 'task,alt1.fiveg,alt2.fiveg\n1,yes,no\n2,Y,N\n')
    expect(ok.validation.errors).toEqual([])
    const { design } = buildDesign({ filename: 'x.csv', parsed: ok.parsed, mappings: ok.mappings }, p)
    expect(design.rows[0].cells[cellKey(p.alternatives[0].id, 'fiveg')]).toBe('fiveg0')
    const bad = load(p, 'task,alt1.fiveg,alt2.fiveg\n1,maybe,no\n')
    expect(bad.validation.errors.join(' ')).toMatch(/"maybe" does not match/)
  })

  it('renumbers 0-based and lettered blocks instead of merging them', () => {
    const p = ngeneStudy()
    for (const [a, b] of [['0', '1'], ['A', 'B'], ['1', '3']]) {
      const { parsed, mappings, validation } = load(p, `${NGENE_HEADER}\n1,5,Low,1,10,High,7,${a}\n2,15,Medium,3,5,Low,1,${b}\n`)
      expect(validation.errors).toEqual([])
      const { design } = buildDesign({ filename: 'x.csv', parsed, mappings }, p)
      expect(design.rows.map((r) => r.block)).toEqual([1, 2])
      expect(design.numBlocks).toBe(2)
    }
  })

  it('rejects the same choice task twice in a block', () => {
    const { validation } = load(ngeneStudy(), `${NGENE_HEADER}\n1,5,Low,1,10,High,7,1\n1,15,Medium,3,5,Low,1,1\n`)
    expect(validation.errors.join(' ')).toMatch(/Choice task 1 \(lines 2 and 3\) appears twice/)
  })

  it('skips the empty rows a spreadsheet leaves at the end', () => {
    const { parsed } = load(ngeneStudy(), `${NGENE_HEADER}\n1,5,Low,1,10,High,7,1\n,,,,,,,\n,,,,,,,\n`)
    expect(parsed.rows).toHaveLength(1)
  })

  it('explains long format instead of applying an empty design', () => {
    const { validation } = load(ngeneStudy(), 'Set,Alt,price,quality,delivery\n1,1,5,Low,1\n1,2,10,High,7\n')
    expect(validation.errors.join(' ')).toMatch(/long format/)
  })

  it('reads semicolons and decimal commas from European spreadsheets', () => {
    const p = { ...ngeneStudy(), attributes: [attr('fare', 'numeric', [1.5, 2.5])] }
    const { validation } = load(p, 'task;alt1.fare;alt2.fare\n1;1,50;2,50\n')
    expect(validation.errors).toEqual([])
  })
})

describe('CSV import: round trips', () => {
  it('re-imports the design matrix the app copies as CSV, unchanged', () => {
    const p = structuredClone(travelModeExample)
    const { rows } = generateDesign(p, { numTasks: 12, numBlocks: 2, method: 'random', seed: 3 })
    const withDesign = { ...p, design: { ...p.design!, rows, numTasks: 12, numBlocks: 2 } }
    const csv = designMatrixCsv(buildDesignMatrix(withDesign))
    const { parsed, mappings, validation } = load(p, csv)
    expect(validation.errors).toEqual([])
    const { design } = buildDesign({ filename: 'matrix.csv', parsed, mappings }, p)
    const byKey = (r: { block: number; taskId: number }) => `${r.block}:${r.taskId}`
    const original = new Map(rows.map((r) => [byKey(r), r]))
    for (const r of design.rows) {
      expect(r.cells).toEqual(original.get(byKey(r))!.cells)
      expect(r.context).toEqual(original.get(byKey(r))!.context)
    }
    expect(designFit({ ...p, design })).toBeNull()
  })

  it('imports a filled-in template as a design that fits the structure', () => {
    const p = structuredClone(travelModeExample)
    const { rows } = generateDesign(p, { numTasks: 6, numBlocks: 2, method: 'random', seed: 9 })
    const headers = generateTemplateCsv(p).trim().split(',')
    const lines = rows.map((r) =>
      headers
        .map((h) => {
          if (h === 'task') return r.taskId
          if (h === 'block') return r.block
          const cv = p.contextVariables!.find((c) => c.id === h)
          if (cv) return cv.levels.find((l) => l.id === r.context![cv.id])!.value
          const a = p.attributes.find((x) => h.endsWith(`_${x.id}`))!
          return findLevelInAttr(a, r.cells[`${h.slice(0, -a.id.length - 1)}.${a.id}`])!.value
        })
        .join(','),
    )
    const { parsed, mappings, validation } = load(p, [headers.join(','), ...lines].join('\n'))
    expect(validation.errors).toEqual([])
    const { design } = buildDesign({ filename: 't.csv', parsed, mappings }, p)
    expect(design.rows.map((r) => r.cells)).toEqual(rows.map((r) => r.cells))
    expect(designFit({ ...p, design })).toBeNull()
  })
})
