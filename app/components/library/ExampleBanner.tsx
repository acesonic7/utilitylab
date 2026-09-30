'use client'

import { useEffect, useState } from 'react'
import { Plus, XMark } from '../Icons'
import { Button, IconButton, Tag } from '../ui'
import { useLibrary } from './LibraryContext'

const HIDDEN_KEY = 'utilitylab:example-banner'

function hiddenFor(): string | null {
  try {
    return window.localStorage.getItem(HIDDEN_KEY)
  } catch {
    return null
  }
}

/** Says the open study is the example, a sandbox, and points to starting one's own. */
export function ExampleBanner({ onOpenTour }: { onOpenTour: () => void }) {
  const lib = useLibrary()
  const isExample = lib.studies.some((s) => s.id === lib.activeId && s.fromExample)
  // Hidden per example study, so a fresh example from Studies shows it again.
  const [hidden, setHidden] = useState<string | null>(null)
  useEffect(() => setHidden(hiddenFor()), [])

  if (!isExample || hidden === lib.activeId) return null

  const hide = () => {
    setHidden(lib.activeId)
    try {
      window.localStorage.setItem(HIDDEN_KEY, lib.activeId)
    } catch {
      // hidden for this visit only
    }
  }

  return (
    <aside
      aria-label="Example study"
      className="relative mb-8 flex flex-col gap-4 rounded-panel border border-accent-edge/60 bg-accent/15 py-4 pl-5 pr-12 sm:flex-row sm:items-center sm:gap-6"
    >
      <IconButton label="Hide this note" size="sm" onClick={hide} className="absolute right-2.5 top-2.5">
        <XMark />
      </IconButton>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="ink">Example</Tag>
          <p className="text-14 font-semibold text-ink">This is an example study to explore</p>
        </div>
        <p className="mt-1.5 max-w-[68ch] text-13 text-ink-2">
          Change anything, generate designs, preview the choice tasks and try the exports: it’s a
          sandbox, and you can open a fresh copy from Studies any time. When you’re ready, start
          your own study and the numbered steps walk you through it.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onOpenTour}>
          Take the tour
        </Button>
        <Button variant="primary" icon={<Plus />} onClick={lib.startNew}>
          Start your own study
        </Button>
      </div>
    </aside>
  )
}
