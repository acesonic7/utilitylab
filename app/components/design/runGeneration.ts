import type { Project } from '@/lib/schema'
import { generateDesign, type GenerateInput, type GenerationProgress, type GenerationResult } from '@/lib/designGenerator'
import type { GenerateMessage, GenerateRequest } from './generate.worker'

export type GenerationRun = { promise: Promise<GenerationResult | null>; cancel: () => void }

/**
 * Runs the search in a web worker; resolves with the result, or null when cancelled. Where
 * workers aren't available it falls back to the main thread (no progress, no cancel).
 */
export function runGeneration(
  project: Project,
  input: Omit<GenerateInput, 'onProgress'>,
  onProgress: (p: GenerationProgress) => void,
): GenerationRun {
  if (typeof Worker === 'undefined') {
    return { promise: Promise.resolve().then(() => generateDesign(project, input)), cancel: () => {} }
  }
  const worker = new Worker(new URL('./generate.worker.ts', import.meta.url))
  let settle: (r: GenerationResult | null) => void = () => {}
  let fail: (e: Error) => void = () => {}
  const promise = new Promise<GenerationResult | null>((resolve, reject) => {
    settle = resolve
    fail = reject
  })
  worker.onmessage = (e: MessageEvent<GenerateMessage>) => {
    const m = e.data
    if (m.type === 'progress') return onProgress({ fraction: m.fraction, label: m.label })
    worker.terminate()
    if (m.type === 'done') settle(m.result)
    else fail(new Error(m.message))
  }
  worker.onerror = (e) => {
    worker.terminate()
    fail(new Error(e.message || 'The search failed.'))
  }
  const request: GenerateRequest = { project, input }
  worker.postMessage(request)
  return {
    promise,
    cancel: () => {
      worker.terminate()
      settle(null)
    },
  }
}
