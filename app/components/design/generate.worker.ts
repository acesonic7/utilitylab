// Runs a design search off the main thread, so a long D-optimal or balanced search no longer
// freezes the page and can be cancelled (the page terminates this worker).
import type { Project } from '@/lib/schema'
import { generateDesign, type GenerateInput, type GenerationResult } from '@/lib/designGenerator'

export type GenerateRequest = { project: Project; input: Omit<GenerateInput, 'onProgress'> }
export type GenerateMessage =
  | { type: 'progress'; fraction: number; label: string }
  | { type: 'done'; result: GenerationResult }
  | { type: 'error'; message: string }

const post = (m: GenerateMessage) => (self as unknown as Worker).postMessage(m)

self.onmessage = (e: MessageEvent<GenerateRequest>) => {
  const { project, input } = e.data
  let last = 0
  try {
    const result = generateDesign(project, {
      ...input,
      // Progress fires per choice task; a few updates a second are plenty.
      onProgress: ({ fraction, label }) => {
        const now = performance.now()
        if (now - last < 100) return
        last = now
        post({ type: 'progress', fraction, label })
      },
    })
    post({ type: 'done', result })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : 'The search failed.' })
  }
}
