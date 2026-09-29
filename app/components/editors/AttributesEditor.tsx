'use client'

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Project, Attribute } from '@/lib/schema'
import { createAttribute } from '@/lib/defaults'
import { paramLayout } from '@/lib/dOptimal'
import { altIdentities } from '@/lib/altIdentity'
import { Button, EmptyState, Panel, cx } from '../ui'
import { AttributeRow } from './attributes/AttributeRow'
import { AttributeDetail } from './attributes/AttributeDetail'
import { PlusIcon } from './attributes/icons'
import { ATTR_GRID, COL_HEAD, PARAMS_CELL, appliesWidth } from './attributes/grid'

export default function AttributesEditor({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [focusName, setFocusName] = useState<string | null>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const baseId = useId()

  // autoFocus fires on the mount that follows an add; clear it so reopening doesn't steal focus.
  useEffect(() => {
    if (focusName) setFocusName(null)
  }, [focusName])

  const labeled = project.experimentType === 'labeled'
  const active = useMemo(
    () => altIdentities(project).filter((_, i) => !project.alternatives[i].isOptOut),
    [project],
  )
  const layout = useMemo(() => paramLayout(project), [project])

  const stamp = (changes: Partial<Project>) =>
    setProject({ ...project, ...changes, updatedAt: new Date().toISOString() })

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const update = (id: string, changes: Partial<Attribute>) => {
    stamp({
      attributes: project.attributes.map((a) => (a.id === id ? { ...a, ...changes } : a)),
    })
  }

  const remove = (id: string) => {
    stamp({
      attributes: project.attributes.filter((a) => a.id !== id),
      builder: {
        ...project.builder,
        attributeOrder: project.builder.attributeOrder.filter((aid) => aid !== id),
      },
    })
    const next = new Set(expanded)
    next.delete(id)
    setExpanded(next)
    requestAnimationFrame(() => addButton.current?.focus())
  }

  const add = () => {
    const a = createAttribute(project)
    stamp({
      attributes: [...project.attributes, a],
      builder: {
        ...project.builder,
        attributeOrder: [...project.builder.attributeOrder, a.id],
      },
    })
    setExpanded(new Set([...Array.from(expanded), a.id]))
    setFocusName(a.id)
  }

  const n = project.attributes.length
  const attrK = layout.totalK - layout.ascCount

  return (
    <Panel
      title="Attributes"
      count={n}
      actions={<span className="hidden sm:inline">Levels shown to scale</span>}
      flush
    >
      {n === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState
            title="No attributes yet"
            body="Add at least one attribute to describe the alternatives, for example travel time or cost."
            action={
              <Button ref={addButton} size="sm" icon={<PlusIcon />} onClick={add}>
                Add attribute
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div
            className="px-1 pb-1"
            style={{ ['--applies-w' as string]: `${appliesWidth(active.length)}px` } as CSSProperties}
          >
            <div
              aria-hidden="true"
              className={cx('hidden h-[34px] items-center border-b border-line px-4 xl:grid', ATTR_GRID, COL_HEAD)}
            >
              <span>Attribute</span>
              <span>Type</span>
              <span>Preference</span>
              <span>Applies to</span>
              <span>Levels</span>
              <span className={PARAMS_CELL}>Parameters</span>
              <span>ID</span>
            </div>
            <ul>
              {project.attributes.map((attr) => {
                const open = expanded.has(attr.id)
                const detailId = `${baseId}-${attr.id}`
                return (
                  <li
                    key={attr.id}
                    className={cx(
                      'border-b border-line last:border-b-0',
                      open && 'rounded-well bg-surface-2',
                    )}
                  >
                    <AttributeRow
                      attribute={attr}
                      active={active}
                      labeled={labeled}
                      open={open}
                      detailId={detailId}
                      onToggle={() => toggle(attr.id)}
                      onUpdate={(changes) => update(attr.id, changes)}
                    />
                    {open && (
                      <AttributeDetail
                        id={detailId}
                        attribute={attr}
                        active={active}
                        labeled={labeled}
                        autoFocusName={focusName === attr.id}
                        onUpdate={(changes) => update(attr.id, changes)}
                        onRemove={() => remove(attr.id)}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line px-4 py-3">
            <Button ref={addButton} size="sm" icon={<PlusIcon />} onClick={add}>
              Add attribute
            </Button>
            <p className="text-13 text-ink-3">
              <span className="font-mono text-ink-2">K = {layout.totalK}</span>
              {layout.ascCount > 0
                ? ` parameters: ${layout.ascCount} alternative-specific ${layout.ascCount === 1 ? 'constant' : 'constants'} + ${attrK} for attributes`
                : ` ${layout.totalK === 1 ? 'parameter' : 'parameters'}, all for attributes`}
            </p>
          </div>
        </>
      )}
    </Panel>
  )
}
