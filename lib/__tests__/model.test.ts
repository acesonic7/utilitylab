import { describe, expect, it } from 'vitest'
import type { Attribute, DesignRow, Project } from '../schema'
import { travelModeExample } from '../example'
import { logDetSPD } from '../linalg'
import {
  buildPriorVector,
  computeDError,
  encodeChoiceTask,
  identificationIssue,
  paramLayout,
  priorLabels,
} from '../dOptimal'
import { generateDesign, normalizeSeed } from '../designGenerator'

function numericAttr(id: string, values: number[]): Attribute {
  return {
    id,
    name: id,
    type: 'numeric',
    appliesTo: 'all',
    position: 0,
    levels: values.map((v, i) => ({ id: `${id}_${i}`, value: v, position: i })),
  }
}

function tinyProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 't',
    slug: 't',
    name: 't',
    createdAt: '',
    updatedAt: '',
    experimentType: 'unlabeled',
    alternatives: [
      { id: 'a', label: 'A', isOptOut: false, position: 0 },
      { id: 'b', label: 'B', isOptOut: false, position: 1 },
    ],
    attributes: [numericAttr('x', [1, 2, 3])],
    design: null,
    builder: { attributeOrder: ['x'], alternativeOrder: ['a', 'b'], layout: 'attributes-as-rows', showUnits: true, optOutPosition: 'last' },
    ...overrides,
  }
}

const row = (taskId: number, cells: Record<string, string>): DesignRow => ({ taskId, block: 1, cells, context: {} })

describe('logDetSPD', () => {
  it('matches det for a well-conditioned matrix', () => {
    expect(logDetSPD([[4, 2], [2, 3]])).toBeCloseTo(Math.log(8), 12)
  })
  it('treats singular and relatively near-singular matrices as singular', () => {
    expect(logDetSPD([[1, 1], [1, 1]])).toBe(-Infinity)
    expect(logDetSPD([[1e6, 1e6], [1e6, 1e6 + 1e-6]])).toBe(-Infinity)
  })
})

describe('D-error', () => {
  it('matches the closed form for two alternatives and one numeric attribute', () => {
    // Zero priors: F = Σ_t ¼ (x_a − x_b)², D-error = 1 / F for K = 1.
    const p = tinyProject()
    const rows = [row(1, { 'a.x': 'x_0', 'b.x': 'x_2' }), row(2, { 'a.x': 'x_1', 'b.x': 'x_0' })]
    const F = 0.25 * (1 - 3) ** 2 + 0.25 * (2 - 1) ** 2
    expect(computeDError(p, rows)).toBeCloseTo(1 / F, 12)
  })

  it('does not depend on the order of choice tasks', () => {
    const p = travelModeExample
    const rows = p.design!.rows
    expect(computeDError(p, [...rows].reverse())).toBeCloseTo(computeDError(p, rows), 12)
  })

  it('is infinite for a design that cannot identify every parameter', () => {
    const p = tinyProject()
    const same = [row(1, { 'a.x': 'x_0', 'b.x': 'x_0' })]
    expect(computeDError(p, same)).toBe(Infinity)
  })
})

describe('dummy coding and prior labels', () => {
  const cat: Attribute = {
    id: 'c',
    name: 'Comfort',
    type: 'categorical',
    appliesTo: 'all',
    position: 0,
    levels: [
      { id: 'hi', value: 'High', position: 2 },
      { id: 'lo', value: 'Low', position: 0 },
      { id: 'md', value: 'Medium', position: 1 },
    ],
  }
  const p = tinyProject({ attributes: [cat] })

  it('codes the first level as the base (all zeros)', () => {
    const X = (lvl: string) => encodeChoiceTask(p, row(1, { 'a.c': lvl, 'b.c': 'lo' })).X[0]
    expect(X('lo')).toEqual([0, 0])
    expect(X('md')).toEqual([1, 0])
    expect(X('hi')).toEqual([0, 1])
  })

  it('labels each parameter against the base level', () => {
    expect(priorLabels(cat)).toEqual(['Medium vs Low', 'High vs Low'])
  })

  it('labels booleans by position, matching the coding', () => {
    const bool: Attribute = {
      id: 'w',
      name: 'Wifi',
      type: 'boolean',
      appliesTo: 'all',
      position: 0,
      levels: [
        { id: 't', value: true, displayValue: 'Yes', position: 0 },
        { id: 'f', value: false, displayValue: 'No', position: 1 },
      ],
    }
    expect(priorLabels(bool)).toEqual(['No vs Yes'])
    const q = tinyProject({ attributes: [bool] })
    expect(encodeChoiceTask(q, row(1, { 'a.w': 'f', 'b.w': 't' })).X).toEqual([[1], [0]])
  })
})

describe('opt-out and constants', () => {
  const optOut = { id: 'none', label: 'None of these', isOptOut: true, position: 2 }

  it('adds one shared constant to an unlabeled design with an opt-out', () => {
    const p = tinyProject({ alternatives: [...tinyProject().alternatives, optOut] })
    const layout = paramLayout(p)
    expect(layout.sharedConstant).toBe(true)
    expect(layout.totalK).toBe(2)
    const { altIds, X } = encodeChoiceTask(p, row(1, { 'a.x': 'x_0', 'b.x': 'x_2' }))
    expect(altIds).toEqual(['a', 'b', 'none'])
    expect(X).toEqual([[1, 1], [1, 3], [0, 0]])
  })

  it('gives every designed alternative a constant in a labeled design with an opt-out', () => {
    const p = tinyProject({ experimentType: 'labeled', alternatives: [...tinyProject().alternatives, optOut] })
    expect(paramLayout(p).ascAltIds).toEqual(['a', 'b'])
    const p2 = tinyProject({ experimentType: 'labeled' })
    expect(paramLayout(p2).ascAltIds).toEqual(['a'])
  })

  it('includes the opt-out in the D-error', () => {
    const base = tinyProject()
    const withOpt = tinyProject({ alternatives: [...base.alternatives, optOut] })
    const rows = [
      row(1, { 'a.x': 'x_0', 'b.x': 'x_2' }),
      row(2, { 'a.x': 'x_1', 'b.x': 'x_0' }),
      row(3, { 'a.x': 'x_2', 'b.x': 'x_1' }),
    ]
    const d = computeDError(withOpt, rows)
    expect(Number.isFinite(d)).toBe(true)
    expect(d).not.toBeCloseTo(computeDError(base, rows), 6)
  })
})

describe('identification', () => {
  it('reports the minimum number of choice tasks', () => {
    const p = travelModeExample // K = 8, J = 4 → at least 3 choice tasks
    expect(identificationIssue(p, 2)).toMatch(/at least 3 choice tasks/)
    expect(identificationIssue(p, 3)).toBeNull()
  })
  it('needs two levels for every applicable attribute', () => {
    const p = tinyProject({ attributes: [numericAttr('x', [1])] })
    expect(identificationIssue(p, 10)).toMatch(/at least two levels/)
  })
})

describe('seeds', () => {
  it('reproduces a design from the returned seed', () => {
    const input = { numTasks: 6, numBlocks: 2, method: 'random' as const }
    const first = generateDesign(travelModeExample, input)
    const again = generateDesign(travelModeExample, { ...input, seed: first.seed })
    expect(again.rows).toEqual(first.rows)
    expect(first.seed).toBeGreaterThanOrEqual(1)
  })
  it('folds any number into a valid seed', () => {
    expect(normalizeSeed(0)).toBe(1)
    expect(normalizeSeed(-42.7)).toBe(42)
    expect(normalizeSeed(NaN)).toBe(1)
  })
  it('never returns an empty D-optimal design', () => {
    const p = tinyProject()
    const r = generateDesign(p, { numTasks: 1, numBlocks: 1, method: 'd-optimal', multistarts: 1, seed: 7 })
    expect(r.rows.length).toBe(1)
  })
})

describe('priors', () => {
  it('leave constants at zero and map attribute priors in order', () => {
    const p = { ...travelModeExample, attributes: travelModeExample.attributes.map((a, i) => (i === 0 ? { ...a, priors: [-0.05] } : a)) }
    const layout = paramLayout(p)
    const beta = buildPriorVector(p, layout)
    expect(beta.slice(0, layout.ascCount).every((v) => v === 0)).toBe(true)
    expect(beta[layout.offsets[p.attributes[0].id]]).toBe(-0.05)
  })
})
