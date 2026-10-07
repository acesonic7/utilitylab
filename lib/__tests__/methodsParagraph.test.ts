import { describe, expect, it } from 'vitest'
import type { GenerationMethod, Project } from '../schema'
import { travelModeExample } from '../example'
import { buildPriorVector, computeDError, paramLayout } from '../dOptimal'
import { generateDesign } from '../designGenerator'
import { diagnosticsByTask } from '../diagnostics'
import { buildMethodsParagraph, COORDINATE_EXCHANGE_REFERENCE } from '../methodsParagraph'
import { validate } from '../validation'

function generated(method: GenerationMethod): Project {
  const result = generateDesign(travelModeExample, { numTasks: 12, numBlocks: 2, method, iterations: 50, multistarts: 2, seed: 42 })
  return {
    ...travelModeExample,
    design: {
      source: 'generated',
      uploadedAt: '',
      numTasks: result.rows.length,
      numBlocks: result.numBlocks,
      rows: result.rows,
      mapping: [],
      rawHeaders: [],
      generationParams: { method, multistarts: method === 'd-optimal' ? 2 : undefined, seed: result.seed },
    },
  }
}

function paragraph(project: Project) {
  const report = validate(project)
  const layout = paramLayout(project)
  const priors = buildPriorVector(project, layout)
  const d = computeDError(project, project.design!.rows, priors, layout)
  return buildMethodsParagraph(project, {
    report,
    byTask: diagnosticsByTask(project, report),
    dError: Number.isFinite(d) ? d : null,
    K: layout.totalK,
    priorsNonZero: priors.some((b) => b !== 0),
  })
}

describe('methods paragraph', () => {
  it('names the D-efficient design and its coordinate-exchange search, and cites it', () => {
    const { text, references } = paragraph(generated('d-optimal'))
    expect(text).toContain(
      'It was generated in UtilityLab as a D-efficient design, by a coordinate-exchange search that minimises the D-error (Meyer & Nachtsheim, 1995), using 2 random starts and random seed 42. ',
    )
    expect(text).not.toMatch(/fed[eo]rov/i)
    expect(references).toEqual([COORDINATE_EXCHANGE_REFERENCE])
  })

  it('does not name or cite a search algorithm for the other methods', () => {
    for (const method of ['balanced', 'random'] as const) {
      const { text, references } = paragraph(generated(method))
      expect(text).not.toMatch(/coordinate-exchange|Nachtsheim|fed[eo]rov/i)
      expect(references).toEqual([])
    }
  })

  it('cites nothing for an uploaded design', () => {
    expect(paragraph(travelModeExample).references).toEqual([])
  })
})

describe('methods paragraph: response requirement', () => {
  const withRequirement = (r: Project['builder']['responseRequirement']) => ({
    ...travelModeExample,
    builder: { ...travelModeExample.builder, responseRequirement: r },
  })
  it('says respondents were prompted by default', () => {
    expect(paragraph(travelModeExample).text).toContain('Respondents were prompted to answer every choice task but could skip one after the prompt.')
  })
  it('names a required or optional answer', () => {
    expect(paragraph(withRequirement('require')).text).toContain('An answer was required for every choice task.')
    expect(paragraph(withRequirement('optional')).text).toContain('Answering each choice task was optional.')
  })
})

describe('methods paragraph: D-error notation', () => {
  it('reports a Dz-error with zero priors and a Dp-error with fixed, non-zero priors', () => {
    expect(paragraph(travelModeExample).text).toContain('with all priors set to zero')
    expect(paragraph(travelModeExample).text).toContain('Dz-error was')
    const withPriors = {
      ...travelModeExample,
      attributes: travelModeExample.attributes.map((a, i) => (i === 0 ? { ...a, priors: [-0.05] } : a)),
    }
    const text = paragraph(withPriors).text
    expect(text).toContain('with fixed, non-zero priors')
    expect(text).toContain('Dp-error was')
  })
})
