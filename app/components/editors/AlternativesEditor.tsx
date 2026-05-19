'use client'

import type { Project, Alternative } from '@/lib/schema'
import { createAlternative } from '@/lib/defaults'
import { Plus, XMark, ChevronUp, ChevronDown } from '../Icons'
import ImageUrlInput from './ImageUrlInput'

export default function AlternativesEditor({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const stamp = (changes: Partial<Project>) =>
    setProject({ ...project, ...changes, updatedAt: new Date().toISOString() })

  const update = (id: string, changes: Partial<Alternative>) => {
    stamp({
      alternatives: project.alternatives.map((a) =>
        a.id === id ? { ...a, ...changes } : a,
      ),
    })
  }

  const remove = (id: string) => {
    stamp({
      alternatives: project.alternatives.filter((a) => a.id !== id),
      builder: {
        ...project.builder,
        alternativeOrder: project.builder.alternativeOrder.filter((aid) => aid !== id),
      },
      attributes: project.attributes.map((attr) =>
        attr.appliesTo === 'all'
          ? attr
          : { ...attr, appliesTo: attr.appliesTo.filter((aid) => aid !== id) },
      ),
    })
  }

  const add = () => {
    const newAlt = createAlternative(project)
    stamp({
      alternatives: [...project.alternatives, newAlt],
      builder: {
        ...project.builder,
        alternativeOrder: [...project.builder.alternativeOrder, newAlt.id],
      },
    })
  }

  const move = (id: string, direction: -1 | 1) => {
    const idx = project.alternatives.findIndex((a) => a.id === id)
    const target = idx + direction
    if (idx < 0 || target < 0 || target >= project.alternatives.length) return
    const reordered = [...project.alternatives]
    ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
    const withPositions = reordered.map((a, i) => ({ ...a, position: i }))
    const orderIds = withPositions.map((a) => a.id)
    stamp({
      alternatives: withPositions,
      builder: { ...project.builder, alternativeOrder: orderIds },
    })
  }

  return (
    <div className="rounded-xl bg-white ring-1 ring-neutral-200/60 shadow-sm p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Alternatives ({project.alternatives.length})
            <span className="text-rose-500 ml-1 normal-case font-normal" title="Required">
              *
            </span>
          </h3>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Each row is one option respondents can choose. Mark "opt-out" for any
            "neither / status quo" option.
          </p>
        </div>
        <button
          onClick={add}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md ring-1 ring-neutral-200 hover:ring-neutral-300 hover:bg-neutral-50 transition"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      <ul className="space-y-2">
        {project.alternatives.map((a, i) => (
          <li key={a.id} className="flex items-center gap-3">
            <div className="flex flex-col -space-y-0.5">
              <button
                onClick={() => move(a.id, -1)}
                disabled={i === 0}
                className="text-neutral-400 hover:text-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded transition"
                aria-label="Move up"
                title="Move up"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => move(a.id, 1)}
                disabled={i === project.alternatives.length - 1}
                className="text-neutral-400 hover:text-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded transition"
                aria-label="Move down"
                title="Move down"
              >
                <ChevronDown size={14} />
              </button>
            </div>
            <input
              type="text"
              value={a.label}
              placeholder="Label (e.g. Car, Bus)"
              onChange={(e) => update(a.id, { label: e.target.value })}
              className="flex-1 bg-white rounded-md px-3 py-1.5 text-sm ring-1 ring-neutral-200 hover:ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition"
            />
            <ImageUrlInput
              value={a.imageUrl}
              onChange={(v) => update(a.id, { imageUrl: v })}
            />
            <label className="text-xs text-neutral-600 flex items-center gap-1.5 whitespace-nowrap select-none cursor-pointer hover:text-neutral-900 transition">
              <input
                type="checkbox"
                checked={a.isOptOut}
                onChange={(e) => update(a.id, { isOptOut: e.target.checked })}
                className="rounded accent-neutral-900"
              />
              opt-out
            </label>
            <span className="text-[11px] text-neutral-400 font-mono w-28 text-right truncate">
              {a.id}
            </span>
            <button
              onClick={() => remove(a.id)}
              disabled={project.alternatives.length <= 2}
              className="text-neutral-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded transition"
              aria-label="Remove alternative"
              title={
                project.alternatives.length <= 2
                  ? 'At least 2 alternatives required'
                  : 'Remove'
              }
            >
              <XMark size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
