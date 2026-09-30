import { describe, expect, it } from 'vitest'
import { blankStudy, fileSlug } from '../library'
import { identificationIssue } from '../dOptimal'

describe('new study setup', () => {
  it('keeps the old blank study by default', () => {
    const p = blankStudy()
    expect(p.name).toBe('Untitled stated choice experiment')
    expect(p.alternatives.map((a) => a.label)).toEqual(['Alternative A', 'Alternative B'])
    expect(p.attributes).toHaveLength(1)
  })

  it('builds a labeled study with named alternatives and an opt-out', () => {
    const p = blankStudy({
      name: 'Lisbon commute study',
      experimentType: 'labeled',
      alternatives: ['Car', 'Public transport'],
      optOut: true,
      starterAttribute: false,
    })
    expect(p.slug).toBe('lisbon-commute-study')
    expect(p.experimentType).toBe('labeled')
    expect(p.alternatives.map((a) => [a.id, a.label, a.isOptOut, a.position])).toEqual([
      ['car', 'Car', false, 0],
      ['public_transport', 'Public transport', false, 1],
      ['none_of_these', 'None of these', true, 2],
    ])
    expect(p.builder.alternativeOrder).toEqual(['car', 'public_transport', 'none_of_these'])
    expect(p.attributes).toEqual([])
  })

  it('creates generic alternatives from a count', () => {
    const p = blankStudy({ name: 'Routes', alternatives: 3, starterAttribute: false })
    expect(p.alternatives.map((a) => a.label)).toEqual(['Alternative A', 'Alternative B', 'Alternative C'])
  })

  // The guided flow adds its own attribute check for this case.
  it('leaves a labeled study without attributes identified by its constants alone', () => {
    const p = blankStudy({ experimentType: 'labeled', alternatives: ['Car', 'Bus'], starterAttribute: false })
    expect(identificationIssue(p, Number.MAX_SAFE_INTEGER)).toBeNull()
  })

  it('slugs names for file names', () => {
    expect(fileSlug('Athens, Greece mode choice')).toBe('athens-greece-mode-choice')
    expect(fileSlug('  ')).toBe('untitled-study')
  })
})
