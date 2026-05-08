import type { Project } from '@/lib/schema'

export default function ProjectHeader({ project }: { project: Project }) {
  const stats = [
    { label: 'Alternatives', value: project.alternatives.length },
    { label: 'Attributes', value: project.attributes.length },
    { label: 'Tasks', value: project.design?.numTasks ?? 0 },
    { label: 'Blocks', value: project.design?.numBlocks ?? 0 },
  ]

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-flex items-center text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${
            project.experimentType === 'labeled'
              ? 'bg-neutral-900 text-white'
              : 'bg-neutral-200 text-neutral-700'
          }`}
        >
          {project.experimentType}
        </span>
        <span className="font-mono text-[11px] text-neutral-400">{project.slug}</span>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
        {project.name}
      </h1>
      {project.description && (
        <p className="text-neutral-600 mt-1.5 text-sm leading-relaxed max-w-2xl">
          {project.description}
        </p>
      )}
      <dl className="flex gap-8 mt-5 text-sm">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[11px] uppercase tracking-wider text-neutral-500">
              {s.label}
            </dt>
            <dd className="font-semibold text-neutral-900 mt-0.5 tabular-nums">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
