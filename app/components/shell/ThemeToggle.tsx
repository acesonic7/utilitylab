'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from '../Icons'
import { IconButton } from '../ui'

type Theme = 'system' | 'light' | 'dark'

const KEY = 'utilitylab:theme'
const ORDER: Theme[] = ['system', 'light', 'dark']
const NAME: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' }
const ICON = { system: Monitor, light: Sun, dark: Moon }

function isTheme(v: unknown): v is Theme {
  return v === 'system' || v === 'light' || v === 'dark'
}

// The head script has already applied the stored theme, so the attribute is the source of truth.
function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'system'
  const t = document.documentElement.getAttribute('data-theme')
  return isTheme(t) ? t : 'system'
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return
      const t: Theme = isTheme(e.newValue) ? e.newValue : 'system'
      document.documentElement.setAttribute('data-theme', t)
      setTheme(t)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]
  const Icon = ICON[theme]

  const apply = (t: Theme) => {
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
    try {
      window.localStorage.setItem(KEY, t)
    } catch {
      // not persisted, still applied for this visit
    }
  }

  return (
    <IconButton
      label={`Color theme: ${NAME[theme]}. Switch to ${NAME[next].toLowerCase()}.`}
      onClick={() => apply(next)}
      className={className}
    >
      <Icon />
    </IconButton>
  )
}
