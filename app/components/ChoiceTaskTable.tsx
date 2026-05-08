import type {
  Project,
  DesignRow,
  Alternative,
  Attribute,
  Level,
} from '@/lib/schema'
import { cellKey } from '@/lib/validation'

function getLevel(attr: Attribute, levelId: string | undefined): Level | undefined {
  if (!levelId) return undefined
  return attr.levels.find((l) => l.id === levelId)
}

function appliesToAlt(attr: Attribute, altId: string): boolean {
  return attr.appliesTo === 'all' || attr.appliesTo.includes(altId)
}

function levelText(attr: Attribute, levelId: string | undefined): string {
  const l = getLevel(attr, levelId)
  if (!l) return '—'
  if (l.displayValue) return l.displayValue
  if (attr.unit) return `${l.value} ${attr.unit}`
  return String(l.value)
}

export default function ChoiceTaskTable({
  project,
  row,
}: {
  project: Project
  row: DesignRow
}) {
  const altOrder = project.builder.alternativeOrder
    .map((id) => project.alternatives.find((a) => a.id === id))
    .filter((a): a is Alternative => !!a)
  const attrOrder = project.builder.attributeOrder
    .map((id) => project.attributes.find((a) => a.id === id))
    .filter((a): a is Attribute => !!a)

  return (
    <article className="rounded-xl bg-white ring-1 ring-neutral-200/60 shadow-sm overflow-hidden">
      <div className="flex items-baseline justify-between px-5 py-3 border-b border-neutral-100">
        <h3 className="font-semibold text-sm tracking-tight">Choice task {row.taskId}</h3>
        <span className="text-[11px] uppercase tracking-wider text-neutral-500">
          Block {row.block}
        </span>
      </div>
      <div className="p-5">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="p-2.5 text-left text-[11px] uppercase tracking-wider text-neutral-500 font-medium border-b border-neutral-200"></th>
              {altOrder.map((a) => (
                <th
                  key={a.id}
                  className={`p-2.5 text-center font-semibold text-sm border-b-2 ${
                    a.isOptOut
                      ? 'border-neutral-300 text-neutral-500'
                      : 'border-neutral-900'
                  }`}
                >
                  {a.label}
                  {a.isOptOut && (
                    <span className="block text-[10px] uppercase tracking-wider font-normal text-neutral-400 mt-0.5">
                      opt-out
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attrOrder.map((attr, ri) => (
              <tr key={attr.id} className={ri % 2 === 1 ? 'bg-neutral-50/40' : ''}>
                <th className="p-2.5 text-left font-medium text-neutral-700">
                  {attr.name}
                  {project.builder.showUnits && attr.unit && (
                    <span className="text-neutral-400 font-normal text-xs ml-1">
                      ({attr.unit})
                    </span>
                  )}
                </th>
                {altOrder.map((alt) => {
                  const empty = alt.isOptOut || !appliesToAlt(attr, alt.id)
                  if (empty) {
                    return (
                      <td
                        key={alt.id}
                        className="p-2.5 text-center text-neutral-300"
                      >
                        —
                      </td>
                    )
                  }
                  const lid = row.cells[cellKey(alt.id, attr.id)]
                  return (
                    <td
                      key={alt.id}
                      className="p-2.5 text-center text-neutral-900 tabular-nums"
                    >
                      {levelText(attr, lid)}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="border-t border-neutral-200">
              <td className="p-2.5 text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                Choice
              </td>
              {altOrder.map((alt) => (
                <td key={alt.id} className="p-2.5 text-center">
                  <input
                    type="radio"
                    name={`task-${row.taskId}`}
                    className="accent-neutral-900"
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  )
}
