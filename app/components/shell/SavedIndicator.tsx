'use client'

import { startTransition, useEffect, useState, useSyncExternalStore } from 'react'
import { cx } from '../ui'

// A tiny store so only this indicator re-renders on save and on its clock tick.
let savedAt: number | null = null
const listeners = new Set<() => void>()

let failure: string | null = null
const EMPTY = { at: null, failure: null }
let snapshot: { at: number | null; failure: string | null } = { at: null, failure: null }

function emit() {
  snapshot = { at: savedAt, failure }
  listeners.forEach((fn) => fn())
}

export function markSaved(): void {
  savedAt = Date.now()
  failure = null
  emit()
}

export function markSaveFailed(error: string): void {
  failure = error
  emit()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function ago(ms: number): string {
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`
  return `${Math.floor(ms / 3_600_000)} h ago`
}

export function SavedIndicator({ className }: { className?: string }) {
  const { at, failure: error } = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  )
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    // A transition, so the clock never interrupts the deferred re-render of the heavier sections.
    const id = setInterval(() => startTransition(() => setNow(Date.now())), 5000)
    return () => clearInterval(id)
  }, [])

  if (error) {
    return (
      <span
        role="alert"
        title={error}
        className="inline-flex items-center gap-2 whitespace-nowrap text-13 font-medium text-risk"
      >
        <span
          aria-hidden="true"
          className="size-[7px] shrink-0 rounded-full bg-risk shadow-[0_0_0_3px_rgb(var(--risk-bg))]"
        />
        Not saved
        <span className="sr-only">: {error}</span>
      </span>
    )
  }

  if (at === null) return null

  return (
    <span
      title="Saved in this browser"
      className={cx('inline-flex items-center gap-2 whitespace-nowrap text-13 text-ink-3', className)}
    >
      <span
        aria-hidden="true"
        className="size-[7px] shrink-0 rounded-full bg-ok shadow-[0_0_0_3px_rgb(var(--ok-bg))]"
      />
      Saved · {ago(Math.max(0, now - at))}
    </span>
  )
}
