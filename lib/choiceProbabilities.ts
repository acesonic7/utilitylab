import type { DesignRow, Project } from './schema'
import { buildPriorVector, encodeChoiceTask, paramLayout, type ParamLayout } from './dOptimal'
import { dot } from './linalg'

export type ChoiceProbability = { altId: string; p: number }

// MNL choice probabilities for one choice task under the project's priors, using
// the same coding, priors and alternative set as computeDError.
export function choiceProbabilities(
  project: Project,
  row: DesignRow,
  priors?: number[],
  layoutIn?: ParamLayout,
): ChoiceProbability[] {
  const layout = layoutIn ?? paramLayout(project)
  const beta = priors ?? buildPriorVector(project, layout)
  const { altIds, X } = encodeChoiceTask(project, row, layout)
  if (altIds.length === 0) return []
  const V = X.map((x) => dot(beta, x))
  const maxV = Math.max(...V)
  const expV = V.map((v) => Math.exp(v - maxV))
  const sum = expV.reduce((s, v) => s + v, 0)
  return altIds.map((altId, i) => ({ altId, p: expV[i] / sum }))
}
