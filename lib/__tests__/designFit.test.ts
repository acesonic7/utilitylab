import { describe, expect, it } from 'vitest'
import type { Project } from '../schema'
import { travelModeExample } from '../example'
import { designFit } from '../designFit'
import { generateDesign } from '../designGenerator'

// The example with a freshly generated design, so every cell fits the structure.
function fresh(): Project {
  const p = structuredClone(travelModeExample)
  const { rows } = generateDesign(p, { numTasks: 12, numBlocks: 2, method: 'random', seed: 7 })
  return { ...p, design: { ...p.design!, rows, numTasks: 12, numBlocks: 2 } }
}

describe('designFit', () => {
  it('is null for a design that fits and for no design', () => {
    expect(designFit(fresh())).toBeNull()
    expect(designFit({ ...fresh(), design: null })).toBeNull()
  })

  it('flags choice tasks that use a deleted level', () => {
    const p = fresh()
    const attr = p.attributes[0]
    const used = p.design!.rows[0].cells[`${p.alternatives[0].id}.${attr.id}`]
    attr.levels = attr.levels.filter((l) => l.id !== used)
    const fit = designFit(p)!
    expect(fit.issues.map((i) => i.kind)).toContain('unknown-level')
    expect(fit.affectedRows).toBeGreaterThan(0)
    expect(fit.issues[0].message).toContain(attr.name)
  })

  it('flags a deleted attribute and a deleted alternative as removed', () => {
    const p = fresh()
    p.attributes = p.attributes.slice(1)
    const fit = designFit(p)!
    expect(fit.issues.map((i) => i.kind)).toEqual(['removed'])
    expect(fit.affectedRows).toBe(fit.totalRows)

    const q = fresh()
    q.alternatives = q.alternatives.filter((a) => a.id !== q.alternatives[0].id)
    expect(designFit(q)!.issues.map((i) => i.kind)).toEqual(['removed'])
  })

  it('flags a new attribute or alternative the design has no levels for', () => {
    const p = fresh()
    p.attributes = [
      ...p.attributes,
      { id: 'noise', name: 'Noise', type: 'categorical', appliesTo: 'all', position: 99, levels: [
        { id: 'n1', value: 'Quiet', position: 0 },
        { id: 'n2', value: 'Loud', position: 1 },
      ] },
    ]
    const fit = designFit(p)!
    expect(fit.issues[0].kind).toBe('missing-cell')
    expect(fit.issues[0].message).toContain('Noise')
  })

  it('ignores an added level and an added opt-out, which leave the design valid', () => {
    const p = fresh()
    p.attributes[0].levels = [...p.attributes[0].levels, { id: 'extra', value: 99, position: 9 }]
    p.alternatives = [...p.alternatives, { id: 'none', label: 'None', isOptOut: true, position: 9 }]
    expect(designFit(p)).toBeNull()
  })

  it('flags context levels that no longer exist or are missing', () => {
    const p = fresh()
    const cv = p.contextVariables![0]
    const used = p.design!.rows[0].context![cv.id]
    cv.levels = cv.levels.filter((l) => l.id !== used)
    expect(designFit(p)!.issues.map((i) => i.kind)).toContain('unknown-context')

    const q = fresh()
    q.design!.rows = q.design!.rows.map((r) => ({ ...r, context: {} }))
    expect(designFit(q)!.issues.map((i) => i.kind)).toEqual(['missing-context'])
  })
})
