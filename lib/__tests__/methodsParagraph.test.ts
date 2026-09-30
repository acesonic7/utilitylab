import { describe, expect, it } from 'vitest'
import type { GenerationMethod, Project } from '../schema'
import { travelModeExample } from '../example'
import { buildPriorVector, computeDError, paramLayout } from '../dOptimal'
import { generateDesign } from '../designGenerator'
import { diagnosticsByTask } from '../diagnostics'
import { buildMethodsParagraph } from '../methodsParagraph'
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

function paragraph(project: Project): string {
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
  }).text
}

describe('methods paragraph', () => {
  it('names the D-optimal search as coordinate exchange', () => {
    const text = paragraph(generated('d-optimal'))
    expect(text).toContain('It was generated in UtilityLab with a coordinate-exchange D-optimal search (2 random starts, random seed 42). ')
    expect(text).not.toMatch(/fed[eo]rov/i)
  })

  it('does not name a search algorithm for the other methods', () => {
    for (const method of ['balanced', 'random'] as const) {
      expect(paragraph(generated(method))).not.toMatch(/coordinate-exchange|fed[eo]rov/i)
    }
  })
})
