import { describe, expect, it } from 'vitest'
import type { Attribute } from '../schema'
import {
  buildLevels,
  defaultFillInput,
  fillNotes,
  fillValues,
  mergeValues,
  roundTo,
  roundingKind,
  roundingOptions,
  type FillInput,
} from '../levelFill'

const time: Attribute = {
  id: 'tt',
  name: 'Travel time',
  type: 'numeric',
  unit: 'min',
  displayFormat: 'duration',
  appliesTo: 'all',
  position: 0,
  levels: [15, 30, 45].map((v, i) => ({ id: `tt${i}`, value: v, position: i })),
}
const cost: Attribute = { ...time, id: 'c', name: 'Cost', unit: 'EUR', displayFormat: 'currency' }

const base = (over: Partial<FillInput>): FillInput => ({ ...defaultFillInput(time, time.levels), ...over })

describe('fillValues', () => {
  it('fills a range by step', () => {
    expect(fillValues(base({ method: 'step', from: 10, to: 60, step: 10, round: 0 })).values).toEqual([10, 20, 30, 40, 50, 60])
  })
  it('fills a range by count', () => {
    expect(fillValues(base({ method: 'count', from: 15, to: 75, count: 5, round: 0 })).values).toEqual([15, 30, 45, 60, 75])
  })
  it('fills around a reference', () => {
    expect(fillValues(base({ method: 'reference', reference: 30, percent: 20, stepsEachSide: 2, round: 0 })).values).toEqual([18, 24, 30, 36, 42])
  })
  it('fills a geometric series', () => {
    expect(fillValues(base({ method: 'geometric', start: 5, ratio: 2, count: 4, round: 0 })).values).toEqual([5, 10, 20, 40])
  })
  it('rounds and reports merged levels', () => {
    const r = fillValues(base({ method: 'count', from: 10, to: 12, count: 5, round: 5 }))
    expect(r.values).toEqual([10])
    expect(r.merged).toBe(4)
  })
  it('rounds money without float noise', () => {
    expect(roundTo(2.3, 0.1)).toBe(2.3)
    expect(roundTo(1.2345, 0.5)).toBe(1)
    expect(fillValues(base({ method: 'reference', reference: 4, percent: 25, stepsEachSide: 2, round: 0.5 })).values).toEqual([2, 3, 4, 5, 6])
  })
  it('refuses impossible inputs with a reason', () => {
    expect(fillValues(base({ method: 'step', from: 10, to: 60, step: 0 })).error).toMatch(/more than 0/)
    expect(fillValues(base({ method: 'step', from: 0, to: 100, step: 1 })).error).toMatch(/bigger step/)
    expect(fillValues(base({ method: 'geometric', start: 5, ratio: 1, count: 4 })).error).toMatch(/not 1/)
    expect(fillValues(base({ method: 'count', from: 1, to: 2, count: 1 })).error).toMatch(/at least 2/)
  })
})

describe('rounding by unit', () => {
  it('picks the rounding kind from the unit and pivot', () => {
    expect(roundingKind(time)).toBe('minutes')
    expect(roundingKind(cost)).toBe('currency')
    expect(roundingKind({ ...time, displayFormat: undefined, unit: '€' })).toBe('currency')
    expect(roundingKind({ ...time, displayFormat: undefined, unit: 'hours' })).toBe('hours')
    expect(roundingKind({ ...cost, pivot: { mode: 'relative' } })).toBe('multiplier')
    expect(roundingKind({ ...time, displayFormat: undefined, unit: 'km' })).toBe('plain')
  })
  it('offers cost steps of 0.10, 0.50 and 1 and defaults to 0.50', () => {
    const { options, fallback } = roundingOptions('currency', 'EUR')
    expect(options.map((o) => o.value)).toEqual([0, 0.01, 0.1, 0.5, 1])
    expect(fallback).toBe(0.5)
    expect(defaultFillInput(cost, cost.levels).round).toBe(0.5)
    expect(defaultFillInput(time, time.levels).round).toBe(5)
  })
})

describe('defaults and notes', () => {
  it('starts from the current levels', () => {
    const d = defaultFillInput(time, time.levels)
    expect(fillValues(d).values).toEqual([15, 30, 45])
  })
  it('warns about many levels, negatives and suggests pivots', () => {
    const many = fillNotes(time, base({ method: 'count', count: 7 }), fillValues(base({ method: 'count', from: 10, to: 70, count: 7, round: 0 })))
    expect(many.some((n) => /7 levels/.test(n.text))).toBe(true)
    const neg = fillNotes(time, base({}), { values: [-5, 5], merged: 0 })
    expect(neg.some((n) => /negative/.test(n.text))).toBe(true)
    const ref = fillNotes(time, base({ method: 'reference' }), { values: [24, 30, 36], merged: 0 })
    expect(ref.some((n) => /Multiplier/.test(n.text))).toBe(true)
    const delta = fillNotes({ ...time, pivot: { mode: 'absolute' } }, base({}), { values: [-10, 0, 10], merged: 0 })
    expect(delta.some((n) => /negative/.test(n.text))).toBe(false)
  })
})

describe('building levels', () => {
  it('keeps existing levels for values that stay, and creates the rest', () => {
    const out = buildLevels([15, 20, 45], (i) => `new${i}`, time.levels)
    expect(out.map((l) => l.id)).toEqual(['tt0', 'new1', 'tt2'])
    expect(out.map((l) => l.position)).toEqual([0, 1, 2])
  })
  it('merges values when adding to existing levels', () => {
    expect(mergeValues(time.levels, [20, 30, 60])).toEqual([15, 20, 30, 45, 60])
  })
})
