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
  it('names the D-optimal search as coordinate exchange and cites it', () => {
    const { text, references } = paragraph(generated('d-optimal'))
    expect(text).toContain(
      'It was generated in UtilityLab with a coordinate-exchange D-optimal search (Meyer & Nachtsheim, 1995), using 2 random starts and random seed 42. ',
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
