'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from '../Icons'
import { IconButton } from '../ui'

type Mode = 'light' | 'dark'

// Only a choice that differs from the system is stored; without one the page follows the system.
const THEME_KEY = 'utilitylab:theme-override'
const QUERY = '(prefers-color-scheme: dark)'

function isMode(v: unknown): v is Mode {
  return v === 'light' || v === 'dark'
}

function systemMode(): Mode {
  return window.matchMedia?.(QUERY).matches ? 'dark' : 'light'
}

// The head script has already applied a stored override, so the attribute is the source of truth.
function overrideMode(): Mode | null {
  const t = document.documentElement.getAttribute('data-theme')
  return isMode(t) ? t : null
}

function applyOverride(m: Mode | null) {
  const root = document.documentElement
  if (m) root.setAttribute('data-theme', m)
  else root.removeAttribute('data-theme')
}

// Mounted only on the client (the shell skeleton renders before it), so it can read the page directly.
export function ThemeToggle({ className }: { className?: string }) {
  const [system, setSystem] = useState<Mode>(systemMode)
  const [override, setOverride] = useState<Mode | null>(overrideMode)

  useEffect(() => {
    const mq = window.matchMedia?.(QUERY)
    const onSystem = () => setSystem(mq.matches ? 'dark' : 'light')
    mq?.addEventListener('change', onSystem)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return
      const m = isMode(e.newValue) ? e.newValue : null
      applyOverride(m)
      setOverride(m)
    }
    window.addEventListener('storage', onStorage)
    return () => {
      mq?.removeEventListener('change', onSystem)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const mode = override ?? system
  const target: Mode = mode === 'dark' ? 'light' : 'dark'

  const toggle = () => {
    // Read the system afresh in case a change event was missed.
    const sys = systemMode()
    setSystem(sys)
    const to: Mode = (override ?? sys) === 'dark' ? 'light' : 'dark'
    // Switching back to the system's mode drops the override, so the page follows the system again.
    const next = to === sys ? null : to
    applyOverride(next)
    setOverride(next)
    try {
      if (next) window.localStorage.setItem(THEME_KEY, next)
      else window.localStorage.removeItem(THEME_KEY)
    } catch {
      // not persisted, still applied for this visit
    }
  }

  const Icon = mode === 'dark' ? Moon : Sun
  const now = `${mode === 'dark' ? 'Dark' : 'Light'} mode${override ? '' : ' (system)'}`
  const then = target === system ? `${target}, following the system` : target

  return (
    <IconButton label={`${now}. Switch to ${then}.`} onClick={toggle} className={className}>
      <Icon />
    </IconButton>
  )
}
