'use client'

import type { Project } from '@/lib/schema'
import Field, { inputCls } from './Field'

export default function ProjectInfoEditor({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const stamp = (changes: Partial<Project>) =>
    setProject({ ...project, ...changes, updatedAt: new Date().toISOString() })

  return (
    <div className="rounded-xl bg-white ring-1 ring-neutral-200/60 shadow-sm p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" required>
          <input
            type="text"
            value={project.name}
            placeholder="e.g. Urban Commute Mode Choice"
            onChange={(e) => stamp({ name: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Slug" hint="Used in exported file names.">
          <input
            type="text"
            value={project.slug}
            placeholder="auto-generated-from-name"
            onChange={(e) => stamp({ slug: e.target.value })}
            className={`${inputCls} font-mono text-neutral-700`}
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          value={project.description ?? ''}
          placeholder="What is this experiment about? (optional)"
          onChange={(e) => stamp({ description: e.target.value })}
          rows={2}
          className={inputCls}
        />
      </Field>
      <Field label="Experiment type" required>
        <div className="flex gap-2">
          <TypeChip
            active={project.experimentType === 'unlabeled'}
            onClick={() => stamp({ experimentType: 'unlabeled' })}
          >
            Generic
            <span className="text-[10px] text-neutral-500 ml-1.5">Option A / B / …</span>
          </TypeChip>
          <TypeChip
            active={project.experimentType === 'labeled'}
            onClick={() => stamp({ experimentType: 'labeled' })}
          >
            Labeled
            <span className="text-[10px] text-neutral-500 ml-1.5">Car, Bus, …</span>
          </TypeChip>
        </div>
      </Field>
      <Field
        label="Choice column label"
        hint='Header for the "pick one" row in the preview. Useful for non-English surveys (e.g. "Επιλογή"). Qualtrics and LimeSurvey render their own radio UI, so this label only changes what you see here.'
      >
        <input
          type="text"
          value={project.builder.labels?.choiceColumn ?? ''}
          placeholder="Choice"
          onChange={(e) =>
            stamp({
              builder: {
                ...project.builder,
                labels: { ...project.builder.labels, choiceColumn: e.target.value },
              },
            })
          }
          className={inputCls}
        />
      </Field>
    </div>
  )
}

function TypeChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition ring-1 ${
        active
          ? 'bg-neutral-900 text-white ring-neutral-900'
          : 'bg-white text-neutral-700 ring-neutral-200 hover:ring-neutral-300 hover:bg-neutral-50'
      }`}
    >
      {children}
    </button>
  )
}
