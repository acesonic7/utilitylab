import { describe, expect, it } from 'vitest'
import { travelModeExample } from '../example'
import { computeDError } from '../dOptimal'
import { searchTrace } from '../searchTrace'

// Small deterministic generator, so the trace is the same on every run.
function lcg(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('search trace', () => {
  const trace = searchTrace(travelModeExample, { numTasks: 6, numBlocks: 2, rng: lcg(7) })

  it('has one column per alternative-attribute pair of the example', () => {
    expect(trace.columns.map((c) => `${c.altId}.${c.attrId}`)).toEqual([
      'car.travel_time',
      'car.cost',
      'car.comfort',
      'pt.travel_time',
      'pt.cost',
      'pt.comfort',
      'pt.service_frequency',
      'bike.travel_time',
      'bike.comfort',
      'walk.travel_time',
      'walk.comfort',
    ])
  })

  it('records all six choice tasks with a level in every cell', () => {
    expect(trace.blocks).toEqual([1, 2, 1, 2, 1, 2])
    expect(trace.frames.length).toBeGreaterThan(1)
    for (const f of trace.frames) {
      expect(f.levels).toHaveLength(6)
      for (const row of f.levels) {
        expect(row).toHaveLength(11)
        row.forEach((l, c) => {
          expect(l).toBeGreaterThanOrEqual(0)
          expect(l).toBeLessThan(trace.columns[c].levelCount)
        })
      }
    }
  })

  it('never gets worse and ends better than the example design', () => {
    const ds = trace.frames.map((f) => f.dError)
    for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeLessThan(ds[i - 1])
    const example = computeDError(travelModeExample, travelModeExample.design!.rows)
    expect(ds[ds.length - 1]).toBeLessThan(example)
  })

  // Coordinate exchange: one attribute level of one alternative in one choice task per step.
  it('changes exactly one cell at every accepted step', () => {
    for (let i = 1; i < trace.frames.length; i++) {
      const prev = trace.frames[i - 1].levels
      const changed = trace.frames[i].levels.flatMap((row, t) => row.filter((l, c) => l !== prev[t][c]))
      expect(changed).toHaveLength(1)
    }
  })

  it('ends on the design it returns', () => {
    expect(trace.rows).toHaveLength(6)
    expect(computeDError(travelModeExample, trace.rows)).toBeCloseTo(trace.frames[trace.frames.length - 1].dError, 10)
  })
})
