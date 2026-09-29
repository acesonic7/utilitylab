'use client'

import { useEffect, useState } from 'react'
import type { Project } from '@/lib/schema'
import { altIdentities } from '@/lib/altIdentity'
import { Logo, Wordmark } from './Logo'
import { Eye } from './Icons'
import { useWorkspaceActions } from './Workspace'
import { AltGlyph, Button, IconButton, Tag } from './ui'
import { SavedIndicator } from './shell/SavedIndicator'
import { ThemeToggle } from './shell/ThemeToggle'

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return t.isContentEditable || t.closest('input, textarea, select') !== null
}

export function BrandCell() {
  return (
    <div className="flex h-full shrink-0 items-center gap-2.5 pl-4 sm:pl-[18px] lg:w-[232px]">
      <Logo size={28} />
      <Wordmark className="hidden sm:inline" />
    </div>
  )
}

export default function TopBar({ project }: { project: Project }) {
  const { goTo } = useWorkspaceActions()
  const [mac, setMac] = useState(true)
  const ids = altIdentities(project)

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      if (e.key.toLowerCase() !== 'e' || isTypingTarget(e.target)) return
      e.preventDefault()
      goTo('export')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo])

  const preview = () => goTo('choice-tasks', { lens: false })

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-line bg-paper/85 backdrop-blur-md backdrop-saturate-150">
      <BrandCell />

      <div className="flex h-full min-w-0 flex-1 items-center gap-3 pr-4 sm:pr-5">
        <span aria-hidden="true" className="ml-1 h-5 w-px shrink-0 rotate-[20deg] bg-line-2 lg:hidden" />

        <div className="flex min-w-0 items-center gap-2.5">
          {ids.length > 0 && (
            <span aria-hidden="true" className="hidden shrink-0 gap-[3px] sm:inline-flex">
              {ids.map((id) => (
                <AltGlyph key={id.altId} identity={id} size={8} />
              ))}
            </span>
          )}
          <span className="truncate text-14 font-semibold text-ink" title={project.name}>
            {project.name || 'Untitled stated choice experiment'}
          </span>
          <Tag className="hidden md:inline-flex">
            {project.experimentType === 'labeled' ? 'Labeled' : 'Unlabeled'}
          </Tag>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <SavedIndicator className="mr-1.5 hidden lg:inline-flex" />
          <ThemeToggle />
          <IconButton
            label="Preview as respondent"
            variant="secondary"
            className="hidden sm:inline-flex xl:hidden"
            onClick={preview}
          >
            <Eye />
          </IconButton>
          <Button variant="secondary" icon={<Eye />} className="hidden xl:inline-flex" onClick={preview}>
            Preview as respondent
          </Button>
          <Button
            variant="primary"
            kbd={mac ? '⌘E' : 'Ctrl E'}
            aria-keyshortcuts={mac ? 'Meta+E' : 'Control+E'}
            className="[&>kbd]:hidden md:[&>kbd]:inline"
            onClick={() => goTo('export')}
          >
            Export…
          </Button>
        </div>
      </div>
    </header>
  )
}
