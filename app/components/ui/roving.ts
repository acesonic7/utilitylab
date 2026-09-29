import type { KeyboardEvent } from 'react'

// Arrow/Home/End navigation shared by radiogroup and tablist.
export function rovingIndex(e: KeyboardEvent, current: number, count: number): number | null {
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % count
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
