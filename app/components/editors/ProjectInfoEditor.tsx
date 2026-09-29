'use client'

import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { Project } from '@/lib/schema'
import { Button, Field, Input, Panel, Textarea } from '../ui'
import { RequiredMark } from './structure/RequiredMark'

// Study details: name, slug, description and the choice row label. The experiment type
// (Labeled / Unlabeled) sits beside the alternatives, where its effect is shown.
export default function ProjectInfoEditor({
  project,
  setProject,
  id,
  autoFocus,
  onClose,
}: {
  project: Project
  setProject: (p: Project) => void
  id?: string
  /** Move focus to the Name field when mounted. */
  autoFocus?: boolean
  onClose?: () => void
}) {
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) nameRef.current?.focus()
  }, [autoFocus])

  const stamp = (changes: Partial<Project>) =>
    setProject({ ...project, ...changes, updatedAt: new Date().toISOString() })

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && onClose) {
      e.stopPropagation()
      onClose()
    }
  }

  return (
    <div id={id} onKeyDown={onKeyDown}>
      <Panel
        title="Study details"
        actions={
          onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )
        }
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 md:grid-cols-2">
          <Field
            label={
              <>
                Name
                <RequiredMark />
              </>
            }
          >
            {(fid, describedBy) => (
              <Input
                ref={nameRef}
                id={fid}
                aria-describedby={describedBy}
                aria-required="true"
                value={project.name}
                placeholder="e.g. Urban Commute Mode Choice"
                onChange={(e) => stamp({ name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Slug" hint="Used in exported file names.">
            {(fid, describedBy) => (
              <Input
                id={fid}
                aria-describedby={describedBy}
                mono
                spellCheck={false}
                value={project.slug}
                placeholder="auto-generated-from-name"
                onChange={(e) => stamp({ slug: e.target.value })}
              />
            )}
          </Field>
          <Field label="Description" optional className="md:col-span-2">
            {(fid, describedBy) => (
              <Textarea
                id={fid}
                aria-describedby={describedBy}
                rows={2}
                value={project.description ?? ''}
                placeholder="What is this stated choice experiment about?"
                onChange={(e) => stamp({ description: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Choice row label"
            optional
            className="md:col-span-2"
            hint={
              <>
                Heads the “pick one” row in the preview, useful for surveys in other languages (e.g.
                “Επιλογή”). Qualtrics and LimeSurvey draw their own radio buttons, so this only
                changes the preview here.
              </>
            }
          >
            {(fid, describedBy) => (
              <Input
                id={fid}
                aria-describedby={describedBy}
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
                className="md:max-w-[calc(50%-0.5rem)]"
              />
            )}
          </Field>
        </div>
      </Panel>
    </div>
  )
}
