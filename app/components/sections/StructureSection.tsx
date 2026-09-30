'use client'

import { useId, useRef, useState } from 'react'
import type { Project } from '@/lib/schema'
import { Button, SectionHeader, cx } from '../ui'
import { ChevronDown } from '../Icons'
import ProjectInfoEditor from '../editors/ProjectInfoEditor'
import AlternativesEditor from '../editors/AlternativesEditor'
import AttributesEditor from '../editors/AttributesEditor'
import ContextVariablesEditor from '../editors/ContextVariablesEditor'
import ConstraintsEditor from '../editors/ConstraintsEditor'
import { NextStep } from '../shell/NextStep'

export default function StructureSection({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const constraintsRef = useRef<HTMLDivElement>(null)
  const studyToggleRef = useRef<HTMLButtonElement>(null)
  const studyId = useId()
  // Open from the start only when the required name is missing.
  const [study, setStudy] = useState<{ open: boolean; focus: boolean }>(() => ({
    open: !project.name.trim(),
    focus: false,
  }))
  const nConstraints = project.constraints?.length ?? 0

  const closeStudy = () => {
    studyToggleRef.current?.focus()
    setStudy({ open: false, focus: false })
  }
  const toggleStudy = () => {
    if (study.open) closeStudy()
    else setStudy({ open: true, focus: true })
  }

  const showConstraints = () => {
    const el = constraintsRef.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    const target = el.querySelector<HTMLElement>('h3') ?? el
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
  }

  return (
    <>
      <SectionHeader
        index="01"
        title="Structure"
        lede="Alternatives, attributes, levels and the context variables each choice task is set in."
        actions={
          <>
            <Button
              ref={studyToggleRef}
              size="sm"
              aria-expanded={study.open}
              aria-controls={study.open ? studyId : undefined}
              onClick={toggleStudy}
              icon={
                <ChevronDown
                  className={cx(
                    'transition-transform motion-reduce:transition-none',
                    study.open && 'rotate-180',
                  )}
                />
              }
            >
              Study details
            </Button>
            <Button size="sm" onClick={showConstraints}>
              Constraints · {nConstraints === 0 ? 'none' : nConstraints}
            </Button>
          </>
        }
      />
      <div className="min-w-0 space-y-6">
        {study.open && (
          <ProjectInfoEditor
            id={studyId}
            project={project}
            setProject={setProject}
            autoFocus={study.focus}
            onClose={closeStudy}
          />
        )}
        <AlternativesEditor project={project} setProject={setProject} />
        <AttributesEditor project={project} setProject={setProject} />
        <ContextVariablesEditor project={project} setProject={setProject} />
        <div
          ref={constraintsRef}
          className="scroll-mt-[120px] lg:scroll-mt-20 [&_h3:focus]:outline-none"
        >
          <ConstraintsEditor project={project} setProject={setProject} />
        </div>
      </div>
      <NextStep after="structure" />
    </>
  )
}
