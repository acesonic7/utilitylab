'use client'

import { useEffect, useState } from 'react'
import type { Project } from '@/lib/schema'
import { loadProject, saveProject, clearProject } from '@/lib/persist'
import { travelModeExample } from '@/lib/example'

import TopBar from './TopBar'
import ProjectHeader from './ProjectHeader'
import Section from './Section'
import ProjectInfoEditor from './editors/ProjectInfoEditor'
import AlternativesEditor from './editors/AlternativesEditor'
import AttributesEditor from './editors/AttributesEditor'
import ConstraintsEditor from './editors/ConstraintsEditor'
import DesignSource from './DesignSource'
import ChoiceTaskTable from './ChoiceTaskTable'
import ValidationPanel from './ValidationPanel'
import ExportTabs from './ExportTabs'
import { GitHub, Refresh } from './Icons'

export default function Designer() {
  const [project, setProject] = useState<Project | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(Date.now())

  useEffect(() => {
    setProject(loadProject())
  }, [])

  useEffect(() => {
    if (project) {
      saveProject(project)
      setSavedAt(Date.now())
    }
  }, [project])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [])

  if (!project) {
    return (
      <>
        <TopBar />
        <div className="max-w-5xl mx-auto px-6 py-12 text-neutral-500 text-sm">
          Loading…
        </div>
      </>
    )
  }

  const rows = project.design?.rows ?? []

  const handleReset = () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Reset to the travel mode example? Your current edits will be lost.')
    ) {
      return
    }
    clearProject()
    setProject({ ...travelModeExample })
  }

  return (
    <>
      <div className="h-0.5 bg-gradient-to-r from-indigo-500/0 via-indigo-500/70 to-indigo-500/0" />
      <TopBar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-6 mb-10">
          <ProjectHeader project={project} />
          <div className="flex flex-col items-end gap-1.5 mt-2">
            <SavedIndicator savedAt={savedAt} now={now} />
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 whitespace-nowrap transition"
            >
              <Refresh size={13} />
              Reset to example
            </button>
          </div>
        </div>

        <Section
          number={1}
          title="Structure"
          hint="Define alternatives, attributes, and their levels."
        >
          <div className="space-y-3">
            <ProjectInfoEditor project={project} setProject={setProject} />
            <AlternativesEditor project={project} setProject={setProject} />
            <AttributesEditor project={project} setProject={setProject} />
            <ConstraintsEditor project={project} setProject={setProject} />
          </div>
        </Section>

        <Section
          number={2}
          title="Design source"
          hint="Upload an existing design CSV, or generate one from your structure."
        >
          <DesignSource project={project} setProject={setProject} />
        </Section>

        <Section
          number={3}
          title="Choice tasks"
          hint="Live preview of what respondents will see."
          action={
            <span className="text-sm text-neutral-500 tabular-nums">
              {rows.length} choice task{rows.length !== 1 ? 's' : ''}
            </span>
          }
        >
          {rows.length === 0 ? (
            <div className="rounded-xl bg-white ring-1 ring-neutral-200/60 shadow-sm p-12 text-center bg-dot-grid">
              <p className="text-sm text-neutral-500">
                Upload a design CSV above to render choice tasks here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <ChoiceTaskTable
                  key={`${row.block}-${row.taskId}`}
                  project={project}
                  row={row}
                />
              ))}
            </div>
          )}
        </Section>

        <Section
          number={4}
          title="Validation"
          hint="Heuristic checks. Configurable, advisory only."
        >
          <ValidationPanel project={project} />
        </Section>

        <Section
          number={5}
          title="Export"
          hint="Download files for Qualtrics, or push directly to LimeSurvey."
        >
          <ExportTabs project={project} setProject={setProject} />
        </Section>

        <footer className="border-t border-neutral-200 pt-6 mt-12 text-center text-xs text-neutral-500 space-y-1.5">
          <div className="text-neutral-400">UtilityLab · MVP preview</div>
          <div className="inline-flex items-center gap-1.5">
            <span>Made by</span>
            <a
              href="https://github.com/acesonic7"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-neutral-700 hover:text-indigo-600 transition underline-offset-4 hover:underline"
            >
              Ioannis Tsouros
            </a>
            <span className="text-neutral-300">·</span>
            <a
              href="https://github.com/acesonic7"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-neutral-500 hover:text-indigo-600 transition"
              aria-label="GitHub: acesonic7"
            >
              <GitHub size={11} />
              acesonic7
            </a>
          </div>
        </footer>
      </main>
    </>
  )
}

function SavedIndicator({ savedAt, now }: { savedAt: number | null; now: number }) {
  if (!savedAt) return null
  const ago = Math.max(0, now - savedAt)
  let label: string
  if (ago < 3000) label = 'Saved just now'
  else if (ago < 60_000) label = `Saved ${Math.floor(ago / 1000)}s ago`
  else if (ago < 3_600_000) label = `Saved ${Math.floor(ago / 60_000)}m ago`
  else label = `Saved ${Math.floor(ago / 3_600_000)}h ago`
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      {label}
    </span>
  )
}
