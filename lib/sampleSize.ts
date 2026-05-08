import type { Project } from './schema'
import { paramLayout } from './dOptimal'

// Sweet-spot tasks per respondent in DCE practice (Orme, Sawtooth conventions).
const TARGET_TASKS_PER_RESPONDENT = 12

// Heuristic: roughly one block per 150 respondents, capped at 8.
// Logic: more respondents → can support a larger total design (more tasks)
// without inflating per-respondent burden.
function suggestBlocks(n: number): number {
  if (n <= 0) return 1
  return Math.max(1, Math.min(8, Math.ceil(n / 150)))
}

export type SampleStatus = 'good' | 'borderline' | 'low' | 'unset'

export type SampleAnalysis = {
  parameters: number
  status: SampleStatus
  tasksPerRespondent: number
  totalObservations: number
  observationsPerParameter: number
  suggestion: { tasks: number; blocks: number; tasksPerRespondent: number } | null
}

export function analyzeSample(
  project: Project,
  numTasks: number,
  numBlocks: number,
): SampleAnalysis {
  const layout = paramLayout(project)
  const K = layout.totalK
  const N = project.targetSampleSize ?? 0
  const tasksPerRespondent = numBlocks > 0 ? numTasks / numBlocks : numTasks
  const totalObservations = N * tasksPerRespondent
  const obsPerParam = K > 0 && N > 0 ? totalObservations / K : 0

  let status: SampleStatus = 'unset'
  if (N > 0 && K > 0) {
    if (obsPerParam >= 50) status = 'good'
    else if (obsPerParam >= 25) status = 'borderline'
    else status = 'low'
  }

  let suggestion: SampleAnalysis['suggestion'] = null
  if (N > 0) {
    const blocks = suggestBlocks(N)
    suggestion = {
      tasks: TARGET_TASKS_PER_RESPONDENT * blocks,
      blocks,
      tasksPerRespondent: TARGET_TASKS_PER_RESPONDENT,
    }
  }

  return {
    parameters: K,
    status,
    tasksPerRespondent,
    totalObservations,
    observationsPerParameter: obsPerParam,
    suggestion,
  }
}
