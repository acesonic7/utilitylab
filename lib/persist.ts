import type { Project } from './schema'
import { travelModeExample } from './example'

const KEY = 'utilitylab:project'

export function loadProject(): Project {
  if (typeof window === 'undefined') return travelModeExample
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return travelModeExample
    return JSON.parse(raw) as Project
  } catch {
    return travelModeExample
  }
}

export function saveProject(p: Project): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // ignore quota or serialization errors
  }
}

export function clearProject(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(KEY)
}
