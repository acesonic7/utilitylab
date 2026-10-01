import { describe, expect, it } from 'vitest'
import type { Attribute, ContextVariable, DesignRow, Project } from '../schema'
import { travelModeExample } from '../example'
import { changeAttributeType, changeContextType } from '../typeChange'
import { dominance, validate } from '../validation'
import { levelDisplayText } from '../format'
import { designFit } from '../designFit'

const lv = (values: (number | string | boolean)[]) => values.map((v, i) => ({ id: `l${i}`, value: v, position: i }))
const attr = (over: Partial<Attribute>): Attribute => ({
  id: 'a', name: 'A', type: 'numeric', appliesTo: 'all', position: 0, levels: lv([1, 2, 3]), ...over,
})

describe('changing an attribute type rebuilds its levels', () => {
  it('numeric 1/2/3 → boolean gives two levels, Yes and No, reusing the first two ids', () => {
    const b = changeAttributeType(attr({ priors: [0.2], pivot: { mode: 'absolute', previewReference: 5 } }), 'boolean')
    expect(b.levels.map((l) => [l.id, l.value, levelDisplayText(b, l)])).toEqual([['l0', true, 'Yes'], ['l1', false, 'No']])
    expect(b.pivot).toBeUndefined()
    expect(b.priors).toBeUndefined()
  })

  it('numeric → categorical keeps what respondents saw as the labels, and drops per-alternative levels and pivots', () => {
    const c = changeAttributeType(
      attr({ unit: 'min', levels: lv([15, 30]), levelsByAlternative: { car: lv([5, 10]) }, pivot: { mode: 'relative', previewReference: 2 } }),
      'categorical',
    )
    expect(c.levels.map((l) => l.value)).toEqual(['15 min', '30 min'])
    expect(c.levelsByAlternative).toBeUndefined()
    expect(c.pivot).toBeUndefined()
  })

  it('categorical → numeric reads numbers from the labels, or numbers the levels and keeps the labels', () => {
    expect(changeAttributeType(attr({ type: 'categorical', levels: lv(['10', '20', '30']) }), 'numeric').levels.map((l) => l.value)).toEqual([10, 20, 30])
    const n = changeAttributeType(attr({ type: 'categorical', levels: lv(['5 GB', '20 GB', 'Unlimited']) }), 'numeric')
    expect(n.levels.map((l) => [l.value, l.displayValue])).toEqual([[1, '5 GB'], [2, '20 GB'], [3, 'Unlimited']])
  })

  it('boolean → numeric gives 1 and 0, labelled as before', () => {
    const n = changeAttributeType(attr({ type: 'boolean', levels: lv([true, false]) }), 'numeric')
    expect(n.levels.map((l) => [l.value, l.displayValue])).toEqual([[1, 'Yes'], [0, 'No']])
  })

  it('context variables convert the same way', () => {
    const cv: ContextVariable = { id: 'w', name: 'Weather', type: 'categorical', position: 0, levels: lv(['Sunny', 'Rain', 'Snow']) }
    expect(changeContextType(cv, 'boolean').levels).toHaveLength(2)
  })

  it('flags the design when the change removes a level it uses', () => {
    const p = structuredClone(travelModeExample)
    const i = p.attributes.findIndex((a) => a.type === 'numeric' && a.levels.length === 3)
    p.attributes[i] = changeAttributeType(p.attributes[i], 'boolean')
    expect(designFit(p)?.issues.map((x) => x.kind)).toContain('unknown-level')
  })
})

describe('dominance', () => {
  function study(attributes: Attribute[], experimentType: Project['experimentType'] = 'unlabeled'): Project {
    const p = structuredClone(travelModeExample)
    return {
      ...p,
      experimentType,
      alternatives: [
        { id: 'x', label: 'X', isOptOut: false, position: 0 },
        { id: 'y', label: 'Y', isOptOut: false, position: 1 },
      ],
      attributes,
      contextVariables: [],
      constraints: [],
    }
  }
  const row = (cells: Record<string, string>): DesignRow => ({ taskId: 1, block: 1, cells })
  const [X, Y] = [{ id: 'x', label: 'X', isOptOut: false, position: 0 }, { id: 'y', label: 'Y', isOptOut: false, position: 1 }]

  it('treats Yes as better than No under "higher is better", whatever the level order', () => {
    for (const levels of [lv([true, false]), lv([false, true])]) {
      const fiveG = attr({ id: 'g', type: 'boolean', levels, preferenceDirection: 'higher' })
      const p = study([fiveG])
      const yes = levels.find((l) => l.value === true)!.id
      const no = levels.find((l) => l.value === false)!.id
      const r = row({ 'x.g': yes, 'y.g': no })
      expect(dominance(p, r, X, Y)).toEqual(['g'])
      expect(dominance(p, r, Y, X)).toBeNull()
    }
  })

  it('does not call it dominance when an attribute without a direction differs', () => {
    const price = attr({ id: 'p', preferenceDirection: 'lower' })
    const brand = attr({ id: 'b', type: 'categorical', levels: lv(['Acme', 'Zeta']) })
    const p = study([price, brand])
    expect(dominance(p, row({ 'x.p': 'l0', 'y.p': 'l2', 'x.b': 'l0', 'y.b': 'l1' }), X, Y)).toBeNull()
    expect(dominance(p, row({ 'x.p': 'l0', 'y.p': 'l2', 'x.b': 'l0', 'y.b': 'l0' }), X, Y)).toEqual(['p', 'b'])
  })

  it('does not judge alternatives that show different attributes, or labeled alternatives', () => {
    const price = attr({ id: 'p', preferenceDirection: 'lower' })
    const parking = attr({ id: 'k', preferenceDirection: 'lower', appliesTo: ['x'] })
    const cells = { 'x.p': 'l0', 'y.p': 'l2', 'x.k': 'l0' }
    expect(dominance(study([price, parking]), row(cells), X, Y)).toBeNull()
    expect(dominance(study([price], 'labeled'), row(cells), X, Y)).toBeNull()
  })

  it('reports fewer, real findings on the example', () => {
    const p = structuredClone(travelModeExample)
    const found = validate(p).findings.filter((f) => f.check === 'dominance')
    for (const f of found) {
      const r = p.design!.rows.find((x) => x.taskId === f.details.taskId)!
      const A = p.alternatives.find((a) => a.id === f.details.dominantAltId)!
      const B = p.alternatives.find((a) => a.id === f.details.dominatedAltId)!
      expect(dominance(p, r, A, B)).not.toBeNull()
    }
  })
})
