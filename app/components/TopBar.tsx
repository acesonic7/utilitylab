'use client'

import { useEffect, useState } from 'react'
import type { Project } from '@/lib/schema'
import { altIdentities } from '@/lib/altIdentity'
import { Logo, Wordmark } from './Logo'
import { ChevronDown, ChevronRight, Eye, Plus } from './Icons'
import { useLibrary } from './library/LibraryContext'
import { useWorkspaceActions, type GoToOptions, type SectionId } from './Workspace'
import { useProgress } from './shell/Progress'
import { AltGlyph, Button, IconButton, Tag, cx } from './ui'
import { SavedIndicator } from './shell/SavedIndicator'
import { ThemeToggle } from './shell/ThemeToggle'

// The primary action follows the first step not done yet; Export takes over at the end.
const NEXT_ACTION: Partial<Record<SectionId, { label: string; opts?: GoToOptions }>> = {
  structure: { label: 'Finish structure' },
  design: { label: 'Generate design', opts: { panel: 'generate' } },
  'choice-tasks': { label: 'Preview choice tasks', opts: { lens: false } },
  diagnostics: { label: 'Check diagnostics' },
}

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
  const lib = useLibrary()
  const progress = useProgress()
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
  const nextStep = progress.next
  const next = nextStep ? NEXT_ACTION[nextStep] : undefined
  // Nothing to preview without a design, and a Preview choice tasks step already says it.
  const showPreview = progress.hasDesign && nextStep !== 'choice-tasks'
  const kbd = mac ? '⌘E' : 'Ctrl E'

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-line bg-paper/85 backdrop-blur-md backdrop-saturate-150">
      <BrandCell />

      <div className="flex h-full min-w-0 flex-1 items-center gap-3 pr-4 sm:pr-5">
        <span aria-hidden="true" className="ml-1 h-5 w-px shrink-0 rotate-[20deg] bg-line-2 lg:hidden" />

        <button
          type="button"
          onClick={lib.openLibrary}
          aria-haspopup="dialog"
          title="Switch study"
          className="focus-ring -ml-1.5 flex min-w-0 items-center gap-2.5 rounded-well px-1.5 py-1 hover:bg-surface-3"
        >
          {ids.length > 0 && (
            <span aria-hidden="true" className="hidden shrink-0 gap-[3px] sm:inline-flex">
              {ids.map((id) => (
                <AltGlyph key={id.altId} identity={id} size={8} />
              ))}
            </span>
          )}
          <span className="truncate text-14 font-semibold text-ink">
            {project.name || 'Untitled stated choice experiment'}
          </span>
          <Tag className="hidden md:inline-flex">
            {project.experimentType === 'labeled' ? 'Labeled' : 'Unlabeled'}
          </Tag>
          <ChevronDown size={14} className="shrink-0 text-ink-3" />
          <span className="sr-only">, open studies</span>
        </button>
        <IconButton label="New study" size="sm" className="-ml-1.5 hidden sm:inline-flex" onClick={lib.startNew}>
          <Plus />
        </IconButton>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <SavedIndicator className="mr-1.5 hidden lg:inline-flex" />
          <ThemeToggle />
          {showPreview && (
            <>
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
            </>
          )}
          <Button
            variant={next ? 'secondary' : 'primary'}
            kbd={kbd}
            aria-keyshortcuts={mac ? 'Meta+E' : 'Control+E'}
            className={cx('[&>kbd]:hidden md:[&>kbd]:inline', next && 'hidden md:inline-flex')}
            onClick={() => goTo('export')}
          >
            Export…
          </Button>
          {next && nextStep && (
            <Button
              variant="primary"
              aria-label={`Next step: ${next.label}`}
              onClick={() => goTo(nextStep, next.opts)}
            >
              <span className="hidden font-medium opacity-70 lg:inline">Next:</span>
              {next.label}
              <ChevronRight size={14} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
