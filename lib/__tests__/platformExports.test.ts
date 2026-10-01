import { describe, expect, it } from 'vitest'
import type { Attribute, Project } from '../schema'
import { travelModeExample } from '../example'
import { buildWiringGuide, tokenFor } from '../wiringGuide'
import { exportSawtoothCsv, sawtoothColumns } from '../sawtoothExport'
import { exportTxt } from '../qualtricsExport'
import { levelDisplayText } from '../format'

const ex = () => structuredClone(travelModeExample)

function pivoted(p: Project): Attribute {
  return p.attributes.find((a) => a.pivot && a.pivot.mode !== 'none')!
}

describe('pivot wiring guide follows the platforms’ documented syntax', () => {
  it('uses tokens that are valid LimeSurvey question codes, from the attribute name by default', () => {
    const p = ex()
    const a = pivoted(p)
    a.pivot!.referenceToken = 'ref_cost-2'
    expect(tokenFor(a)).toBe('REFCOST2')
    a.pivot!.referenceToken = undefined
    a.name = 'Ticket price'
    expect(tokenFor(a)).toBe('REFTICKETPRICE')
    expect(tokenFor({ ...a, name: '2nd fare' })).toMatch(/^[A-Z][A-Z0-9]*$/)
  })

  it('writes Qualtrics math as $e{ … } and LimeSurvey math as {TOKEN.NAOK …}', () => {
    const p = ex()
    const a = pivoted(p)
    const guide = buildWiringGuide(p)
    const t = tokenFor(a)
    if (a.pivot!.mode === 'relative') {
      expect(guide).toContain(`$e{ round( e://Field/${t} * 0.5 , 2 ) }`)
      expect(guide).toContain(`{round(${t}.NAOK * 0.5, 2)}`)
    }
    // Plain piped text followed by arithmetic prints literally in Qualtrics; it must never appear.
    expect(guide).not.toMatch(/\$\{e:\/\/Field\/[A-Z0-9]+\}\s*[*+-]/)
    // LimeSurvey shows text with whitespace just inside the braces instead of calculating it.
    const limesurvey = guide.slice(guide.indexOf('## LimeSurvey'), guide.indexOf('## Values to check'))
    expect(limesurvey).toMatch(/\{(round\()?[A-Z0-9]+\.NAOK/)
    expect(limesurvey).not.toMatch(/\{\s|\s\}/)
  })

  it('names the exact text each exported cell shows', () => {
    const p = ex()
    const a = pivoted(p)
    const guide = buildWiringGuide(p)
    const txt = exportTxt(p)
    for (const l of a.levels) {
      const shown = levelDisplayText(a, l)
      expect(guide).toContain(`\`${shown}\``)
      expect(txt).toContain(shown)
    }
  })

  it('covers an alternative’s own levels', () => {
    const p = ex()
    const a = pivoted(p)
    const alt = p.alternatives.find((x) => !x.isOptOut && (a.appliesTo === 'all' || a.appliesTo.includes(x.id)))!
    a.levelsByAlternative = { [alt.id]: [{ id: 'own', value: 3, position: 0 }] }
    expect(buildWiringGuide(p)).toContain(`*${alt.label} (its own levels)*`)
  })
})

describe('Sawtooth design CSV follows the Lighthouse import format', () => {
  it('codes attributes not shown for a concept as 0, never blank', () => {
    const csv = exportSawtoothCsv(ex())
    const rows = csv.trim().split('\n').slice(1).map((l) => l.split(','))
    expect(rows.every((r) => r.every((c) => /^\d+$/.test(c)))).toBe(true)
    expect(rows.some((r) => r.slice(3).includes('0'))).toBe(true)
  })

  it('puts the alternative first as a primary attribute in a labeled design', () => {
    const p = ex()
    expect(p.experimentType).toBe('labeled')
    const cols = sawtoothColumns(p)
    expect(cols[0].name).toBe('Alternative')
    const header = exportSawtoothCsv(p).split('\n')[0]
    expect(header).toBe(['Version', 'Task', 'Concept', ...cols.map((_, i) => `Att ${i + 1}`)].join(','))
  })

  it('gives an alternative’s own levels their own column, so a code means one value', () => {
    const p = ex()
    const a = p.attributes.find((x) => x.type === 'numeric' && x.appliesTo === 'all')!
    const alt = p.alternatives.find((x) => !x.isOptOut)!
    a.levelsByAlternative = { [alt.id]: a.levels.map((l, i) => ({ ...l, id: `own${i}`, value: Number(l.value) * 2 })) }
    p.design!.rows = p.design!.rows.map((r) => ({ ...r, cells: { ...r.cells, [`${alt.id}.${a.id}`]: 'own0' } }))
    const names = sawtoothColumns(p).map((c) => c.name)
    expect(names).toContain(`${a.name} (${alt.label})`)
    expect(names.filter((n) => n.startsWith(a.name))).toHaveLength(2)
  })

  it('refuses to write a cell that names no level, instead of a silent 0 or blank', () => {
    const p = ex()
    p.design!.rows[0].cells = {}
    expect(() => exportSawtoothCsv(p)).toThrow(/Generate the design again/)
  })
})
