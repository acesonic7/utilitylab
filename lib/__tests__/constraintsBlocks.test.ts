import { describe, expect, it } from 'vitest'
import type { Constraint, Project } from '../schema'
import { travelModeExample } from '../example'
import { generateDesign } from '../designGenerator'
import { computeDError } from '../dOptimal'
import { constraintLabel, constraintProblem, countViolations } from '../constraints'
import { exportBlocks } from '../blocks'
import { exportQsf, exportTxt } from '../qualtricsExport'
import { buildSurveyLss } from '../limesurveyExport'
import { exportSawtoothCsv } from '../sawtoothExport'

const ex = () => structuredClone(travelModeExample)
const alt = (p: Project, i: number) => p.alternatives.filter((a) => !a.isOptOut)[i]

function forbid(altId: string, clauses: [string, string][]): Constraint {
  return {
    id: `c-${altId}-${clauses.map((c) => c.join('=')).join('-')}`,
    type: 'forbidden_combination',
    alternativeId: altId,
    clauses: clauses.map(([attributeId, levelId]) => ({ attributeId, levelId })),
    enabled: true,
  }
}

describe('constraints that can never match are reported', () => {
  it('accepts a constraint that can match', () => {
    const p = ex()
    const a = p.attributes[0]
    expect(constraintProblem(forbid(alt(p, 0).id, [[a.id, a.levels[0].id]]), p)).toBeNull()
  })

  it('flags a deleted alternative, attribute or level, and labels them as deleted', () => {
    const p = ex()
    const a = p.attributes[0]
    const c = forbid(alt(p, 0).id, [[a.id, a.levels[0].id]])
    const noAlt = { ...p, alternatives: p.alternatives.filter((x) => x.id !== alt(p, 0).id) }
    expect(constraintProblem(c, noAlt)).toMatch(/alternative was deleted/)
    expect(constraintLabel(c, noAlt)).toContain('a deleted alternative')
    const noLevel = { ...p, attributes: p.attributes.map((x) => (x.id === a.id ? { ...x, levels: x.levels.slice(1) } : x)) }
    expect(constraintProblem(c, noLevel)).toMatch(/level it names for .* was deleted/)
    expect(constraintLabel(c, noLevel)).toContain('a deleted level')
    expect(constraintProblem(c, { ...p, attributes: p.attributes.slice(1) })).toMatch(/attributes was deleted/)
  })

  it('flags a default level on an alternative that has its own levels', () => {
    const p = ex()
    const a = p.attributes.find((x) => x.type === 'numeric')!
    const car = alt(p, 0)
    a.levelsByAlternative = { [car.id]: [{ id: 'own1', value: 10, position: 0 }, { id: 'own2', value: 20, position: 1 }] }
    expect(constraintProblem(forbid(car.id, [[a.id, a.levels[0].id]]), p)).toMatch(/has its own levels/)
    expect(constraintProblem(forbid(car.id, [[a.id, 'own1']]), p)).toBeNull()
  })

  it('flags an attribute not shown for the alternative', () => {
    const p = ex()
    const a = p.attributes.find((x) => x.appliesTo !== 'all')
    if (!a) return
    const other = p.alternatives.find((x) => !x.isOptOut && !(a.appliesTo as string[]).includes(x.id))!
    expect(constraintProblem(forbid(other.id, [[a.id, a.levels[0].id]]), p)).toMatch(/isn't shown for/)
  })
})

describe('generators honour constraints', () => {
  // 5 alternatives; x × y forbidden off the diagonal, so a random row passes about 1 time in 243
  // and starts run out of retries. The old search froze those rows and returned 326 violations
  // over these 20 seeds while reporting none.
  function diagonal(): Project {
    const lv = (id: string) => [0, 1, 2].map((i) => ({ id: `${id}${i}`, value: i + 1, position: i }))
    const p = structuredClone(travelModeExample)
    p.experimentType = 'unlabeled'
    p.alternatives = [1, 2, 3, 4, 5].map((i) => ({ id: `a${i}`, label: `A${i}`, isOptOut: false, position: i }))
    p.attributes = ['x', 'y', 'z'].map((id, i) => ({ id, name: id, type: 'numeric' as const, appliesTo: 'all' as const, position: i, levels: lv(id) }))
    p.contextVariables = []
    p.constraints = []
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) if (i !== j) p.constraints.push(forbid('all', [['x', `x${i}`], ['y', `y${j}`]]))
    return p
  }

  it('D-optimal never returns a forbidden combination, even when random starts cannot avoid them', () => {
    const p = diagonal()
    for (let seed = 1; seed <= 20; seed++) {
      const r = generateDesign(p, { numTasks: 12, numBlocks: 1, method: 'd-optimal', multistarts: 5, seed })
      expect(countViolations(r.rows, p, p.constraints)).toEqual([])
      expect(r.constraintFailures).toBeUndefined()
      // x and y can only move together, so no design honouring the constraints is identified.
      expect(Number.isFinite(r.dError!)).toBe(false)
    }
  })

  it('reports, and still optimises around, a constraint one alternative cannot meet', () => {
    const p = ex()
    const t = p.attributes[0]
    const car = alt(p, 0)
    p.constraints = t.levels.map((l) => forbid(car.id, [[t.id, l.id]]))
    const r = generateDesign(p, { numTasks: 12, numBlocks: 2, method: 'd-optimal', multistarts: 2, seed: 7 })
    expect(r.constraintFailures).toBe(12)
    const random = generateDesign(p, { numTasks: 12, numBlocks: 2, method: 'random', seed: 7 })
    expect(r.dError!).toBeLessThan(computeDError(p, random.rows))
  })

  it('balanced search prefers a candidate that honours the constraints', () => {
    const p = ex()
    const t = p.attributes[0]
    p.constraints = [forbid(alt(p, 0).id, [[t.id, t.levels[0].id]])]
    const r = generateDesign(p, { numTasks: 12, numBlocks: 2, method: 'balanced', iterations: 50, seed: 3 })
    expect(countViolations(r.rows, p, p.constraints)).toEqual([])
    expect(r.constraintFailures).toBeUndefined()
  })
})

describe('blocks are never empty', () => {
  it('caps blocks at the number of choice tasks, and fills every block', () => {
    for (const method of ['random', 'balanced', 'd-optimal'] as const) {
      const r = generateDesign(ex(), { numTasks: 4, numBlocks: 10, method, iterations: 5, multistarts: 1, seed: 1 })
      expect(r.numBlocks).toBe(4)
      expect(new Set(r.rows.map((x) => x.block))).toEqual(new Set([1, 2, 3, 4]))
    }
  })

  it('exports only blocks that have choice tasks, numbered 1…B', () => {
    const p = ex()
    const rows = p.design!.rows.map((r) => ({ ...r, block: r.block === 2 ? 5 : r.block }))
    p.design = { ...p.design!, rows, numBlocks: 7 }
    expect(exportBlocks(p.design).numBlocks).toBe(2)
    expect(new Set(exportBlocks(p.design).rows.map((r) => r.block))).toEqual(new Set([1, 2]))

    const qsf = JSON.parse(exportQsf(p))
    const blocks = qsf.SurveyElements.find((e: { Element: string }) => e.Element === 'BL').Payload
    const standard = Object.values(blocks).filter((b) => (b as { Type: string }).Type === 'Standard')
    expect(standard.every((b) => (b as { BlockElements: unknown[] }).BlockElements.length > 0)).toBe(true)
    expect(standard).toHaveLength(2)

    expect(exportTxt(p).match(/\[\[Block:Block \d+\]\]/g)).toEqual(['[[Block:Block 1]]', '[[Block:Block 2]]'])
    expect(buildSurveyLss(p)).toContain('rand(1, 2)')
    expect(exportSawtoothCsv(p).split('\n').slice(1).filter(Boolean).every((l) => /^[12],/.test(l))).toBe(true)
  })
})
