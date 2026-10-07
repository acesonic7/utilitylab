'use client'

import { memo, useCallback, useId, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import type { Design, Project } from '@/lib/schema'
import { altIdentity, altStyle } from '@/lib/altIdentity'
import { resolveValidationConfig } from '@/lib/validation'
import { formatDay } from '@/lib/formatDate'
import { plural } from '@/lib/text'
import {
  buildDesignMatrix,
  correlationBrackets,
  designMatrixCsv,
  formatR,
  TINT_CLASSES,
  tintStep,
  withTrueMinus,
  type CorrelationBracket,
  type MatrixCell,
  type MatrixGroup,
  type MatrixRow as MatrixRowModel,
} from '@/lib/designMatrix'
import type { Finding } from '@/lib/validation'
import { useDesignHealth } from '../DesignHealth'
import { useWorkspace } from '../Workspace'
import { useLatestProject } from '../ProjectStore'
import { Trash } from '../Icons'
import { AltGlyph, Button, CopyButton, SeverityPips, cx, useOverflowX } from '../ui'

const SUB_TH =
  'h-[30px] border-b border-line py-1 align-bottom font-mono text-12 font-normal uppercase leading-[14px] tracking-caps text-ink-3'

const METHOD_LABEL = { random: 'Random', balanced: 'Balanced search', 'd-optimal': 'D-efficient' } as const

// Sticky key columns: # is 36px wide, Block sits right after it.
const KEY_1 = 'sticky left-0 z-[1] w-9 min-w-9 bg-surface'
const KEY_2 = 'sticky left-9 z-[1] w-11 min-w-11 bg-surface'

const ACTIVE_MID = 'shadow-[inset_0_1.5px_0_rgb(var(--ink)),inset_0_-1.5px_0_rgb(var(--ink))]'
const ACTIVE_FIRST =
  'shadow-[inset_1.5px_1.5px_0_rgb(var(--ink)),inset_0_-1.5px_0_rgb(var(--ink))]'
const ACTIVE_LAST =
  'shadow-[inset_-1.5px_1.5px_0_rgb(var(--ink)),inset_0_-1.5px_0_rgb(var(--ink))]'
const HOVER_MID =
  'group-hover:shadow-[inset_0_1px_0_rgb(var(--ink-4)),inset_0_-1px_0_rgb(var(--ink-4))]'
const HOVER_FIRST =
  'group-hover:shadow-[inset_1px_1px_0_rgb(var(--ink-4)),inset_0_-1px_0_rgb(var(--ink-4))]'
const HOVER_LAST =
  'group-hover:shadow-[inset_-1px_1px_0_rgb(var(--ink-4)),inset_0_-1px_0_rgb(var(--ink-4))]'

function SourceLine({ design }: { design: Design }) {
  const date = formatDay(design.uploadedAt)
  const stamp = new Date(design.uploadedAt).toLocaleString()
  const sep = <span aria-hidden="true"> · </span>
  if (design.source === 'generated') {
    const g = design.generationParams
    return (
      <p className="min-w-0 text-13 text-ink-3" title={`Generated ${stamp}`}>
        <span className="font-mono text-12 text-ink-2">Generated</span>
        {g && (
          <>
            {sep}
            {METHOD_LABEL[g.method]}
            {g.method === 'd-optimal' && g.multistarts !== undefined && (
              <>
                {sep}
                {g.multistarts} multistart{g.multistarts !== 1 ? 's' : ''}
              </>
            )}
            {g.method === 'balanced' && g.iterations !== undefined && (
              <>
                {sep}
                {g.iterations} iterations
              </>
            )}
            {sep}
            {g.seed !== undefined ? (
              <>
                seed <span className="font-mono text-12 text-ink-2">{g.seed}</span>
              </>
            ) : (
              'no seed'
            )}
          </>
        )}
        {date && (
          <>
            {sep}
            {date}
          </>
        )}
      </p>
    )
  }
  const mapped = design.mapping.filter((m) => m.role !== 'ignore').length
  return (
    <p className="min-w-0 text-13 text-ink-3" title={`Uploaded ${stamp}`}>
      <span className="break-all font-mono text-12 text-ink-2">{design.filename ?? 'Uploaded CSV'}</span>
      {date && (
        <>
          {sep}uploaded {date}
        </>
      )}
      {mapped > 0 && (
        <>
          {sep}
          {mapped} column{mapped !== 1 ? 's' : ''} mapped
        </>
      )}
    </p>
  )
}

function GroupRule({ className }: { className: string }) {
  return <span aria-hidden="true" className={cx('absolute bottom-0 right-0 h-[3px]', className)} />
}

function Bracket({ b, label }: { b: CorrelationBracket; label: string }) {
  const concern = b.severity === 'concern'
  return (
    <span
      title={label}
      className={cx(
        'relative mx-2.5 block h-2 rounded-t-[2px] border-[1.5px] border-b-0',
        concern ? 'border-risk' : 'border-dashed border-caution',
      )}
    >
      <span
        className={cx(
          'absolute left-1/2 top-[-9px] -translate-x-1/2 whitespace-nowrap bg-surface px-1.5 font-mono text-12 leading-[14px]',
          concern ? 'text-risk' : 'text-caution',
        )}
      >
        r {formatR(b.r)}
      </span>
    </span>
  )
}

type Ident = { id: ReturnType<typeof altIdentity>; style: CSSProperties }

const NO_FINDINGS: Finding[] = []

function tintedCell(cell: MatrixCell, attrName: string) {
  if (cell.levelIndex === null) {
    return cell.text === '—'
      ? { className: 'text-ink-3', title: `${attrName}: no level` }
      : { className: 'text-ink', title: `${attrName}: level outside this alternative’s levels` }
  }
  return {
    className: cx('text-ink', TINT_CLASSES[tintStep(cell.levelIndex, cell.levelCount)]),
    title: `${attrName}: level ${cell.levelIndex + 1} of ${cell.levelCount}`,
  }
}

// Memoised so moving the active choice task re-renders only the rows it leaves and enters.
const MatrixRow = memo(function MatrixRow({
  r,
  groups,
  idents,
  active,
  findings,
  violations,
  onOpen,
}: {
  r: MatrixRowModel
  groups: MatrixGroup[]
  idents: Ident[]
  active: boolean
  findings: Finding[]
  /** Constraint violations in this row; each counts as a concern, as in Diagnostics. */
  violations: number
  onOpen: (block: number, taskId: number) => void
}) {
  const { row } = r
  const issues = findings.length + violations
  const concern = violations > 0 || findings.some((f) => f.severity === 'concern')
  const dominance = findings.filter((f) => f.check === 'dominance').length
  const overlap = findings.filter((f) => f.check === 'overlap').length
  const mid = active ? ACTIVE_MID : HOVER_MID
  const gapTop = r.firstInBlock && 'border-t-[10px] border-t-surface'
  const base = cx('h-9 border-b border-r border-surface', gapTop, mid)
  return (
    <tr onClick={() => onOpen(row.block, row.taskId)} className="group cursor-pointer" data-active={active || undefined}>
      <th
        scope="row"
        className={cx(
          KEY_1,
          'h-9 border-b border-r border-surface p-0 font-mono text-12 font-normal text-ink-3',
          gapTop,
          active ? ACTIVE_FIRST : HOVER_FIRST,
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpen(row.block, row.taskId)
          }}
          aria-current={active ? 'true' : undefined}
          aria-label={`Choice task ${row.taskId}, block ${row.block}: open in Choice tasks`}
          className="focus-ring tnum flex h-full w-full items-center justify-center rounded-bar text-ink-2 hover:text-ink"
        >
          {row.taskId}
        </button>
      </th>
      <td className={cx(KEY_2, base, 'tnum text-center font-mono text-12 text-ink-3')}>{row.block}</td>
      {r.cells.map((group, gi) =>
        group.map((cell, ci) => {
          const t = tintedCell(cell, groups[gi].columns[ci].attr.name)
          return (
            <td
              key={`${gi}.${ci}`}
              style={idents[gi].style}
              title={t.title}
              className={cx(
                base,
                'tnum whitespace-nowrap px-1 text-center',
                ci === 0 && 'border-l-[3px] border-l-surface',
                t.className,
              )}
            >
              {withTrueMinus(cell.text)}
            </td>
          )
        }),
      )}
      {r.context.map((cell, i) => (
        <td
          key={`ctx${i}`}
          className={cx(
            base,
            'whitespace-nowrap bg-surface-2 px-2 text-left text-ink-2',
            i === 0 && 'border-l-[3px] border-l-surface',
          )}
        >
          {withTrueMinus(cell.text)}
        </td>
      ))}
      <td
        className={cx(
          'h-9 border-b border-l-[3px] border-surface border-l-surface pr-1 text-right',
          gapTop,
          active ? ACTIVE_LAST : HOVER_LAST,
        )}
        title={
          issues > 0
            ? [
                dominance && `${dominance} dominance`,
                overlap && `${overlap} overlap`,
                violations && plural(violations, 'constraint violation'),
              ]
                .filter(Boolean)
                .join(', ')
            : 'No dominance or overlap findings and no constraint violations'
        }
      >
        {issues > 0 ? (
          <span className="tnum inline-flex items-center gap-1.5 font-semibold text-ink">
            <SeverityPips severity={concern ? 'concern' : 'warning'} />
            {issues}
            <span className="sr-only"> {issues === 1 ? 'issue' : 'issues'}</span>
          </span>
        ) : (
          <span className="tnum text-ink-3">
            0<span className="sr-only"> issues</span>
          </span>
        )}
      </td>
    </tr>
  )
})

export function DesignMatrix({ project, onClear }: { project: Project; onClear: () => void }) {
  const { byTask, violations } = useDesignHealth()
  const { activeTask, goTo } = useWorkspace()
  const titleId = useId()
  const scroller = useRef<HTMLDivElement>(null)
  const scrolls = useOverflowX(scroller)
  const design = project.design!

  // Only the fields the matrix reads, so unrelated edits (name, description, sample size) skip the rebuild.
  const { alternatives, attributes, contextVariables, builder, validationConfig } = project
  const { model, brackets, idents } = useMemo(() => {
    const model = buildDesignMatrix(project)
    return {
      model,
      brackets: correlationBrackets(project, model.groups),
      idents: model.groups.map((g): Ident => {
        const id = altIdentity(project, g.alt.id)
        return { id, style: altStyle(id) as CSSProperties }
      }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design, alternatives, attributes, contextVariables, builder, validationConfig])
  const cfg = resolveValidationConfig(project).correlation
  const getProject = useLatestProject()
  // Serialised from the latest project when pressed, like the export files.
  const copyCsv = useCallback(() => designMatrixCsv(buildDesignMatrix(getProject())), [getProject])

  const ctxCols = model.contextVariables.length
  const lanes = brackets.reduce((n, b) => Math.max(n, b.lane + 1), 0)
  const bracketLabel = (b: CorrelationBracket) => {
    const alt = model.groups.find((g) => g.alt.id === b.altId)?.alt.label ?? b.altId
    return `${alt}: ${b.a.name} × ${b.b.name}, r = ${formatR(b.r)} (${b.severity})`
  }

  const laneRow = (lane: number) => {
    const cells: ReactNode[] = []
    let c = 0
    let gap = 0
    const flushGap = () => {
      if (gap > 0) cells.push(<td key={`g${c}`} colSpan={gap} />)
      gap = 0
    }
    while (c < model.attributeColumns) {
      const b = brackets.find((x) => x.lane === lane && x.from === c)
      if (b) {
        flushGap()
        cells.push(
          <td key={`b${c}`} colSpan={b.to - b.from + 1} className="px-0 pb-[3px] pt-3.5 align-bottom">
            <Bracket b={b} label={bracketLabel(b)} />
          </td>,
        )
        c = b.to + 1
      } else {
        gap++
        c++
      }
    }
    flushGap()
    return (
      <tr key={`lane${lane}`} aria-hidden="true">
        <td colSpan={2} className="sticky left-0 z-[1] bg-surface" />
        {cells}
        {ctxCols > 0 && <td colSpan={ctxCols} />}
        <td />
      </tr>
    )
  }

  const open = useCallback(
    (block: number, taskId: number) => goTo('choice-tasks', { task: { block, taskId } }),
    [goTo],
  )

  const firstIdent = idents.find((i) => i.id.slot !== 'x')

  return (
    <div role="group" aria-labelledby={titleId} className="rounded-panel bg-surface shadow-hairline">
      <header className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-5 pt-4">
        <h3 id={titleId} className="text-16 font-semibold tracking-[-0.005em] text-ink">
          Design matrix
        </h3>
        <span
          className="tnum text-16 font-medium text-ink-3"
          title={`${model.rows.length} choice tasks × ${model.attributeColumns} attribute columns`}
        >
          <span aria-hidden="true">
            {model.rows.length} × {model.attributeColumns}
          </span>
          <span className="sr-only">
            {model.rows.length} choice tasks by {model.attributeColumns} attribute columns
          </span>
        </span>
        <div className="w-full sm:ml-auto sm:w-auto">
          <SourceLine design={design} />
        </div>
      </header>

      <div
        ref={scroller}
        role={scrolls ? 'region' : undefined}
        aria-label={scrolls ? 'Design matrix table, scrolls sideways' : undefined}
        tabIndex={scrolls ? 0 : undefined}
        className="focus-ring relative mx-4 overflow-x-auto rounded-bar pb-5 pt-3"
      >
        <table className="w-full border-separate border-spacing-0 text-13">
          <caption className="sr-only">
            Design matrix: one row per choice task, grouped by block. Select a choice task number to open it.
            {brackets.length > 0 && ` Correlated columns: ${brackets.map(bracketLabel).join('; ')}.`}
          </caption>
          <thead>
            <tr>
              <th
                scope="colgroup"
                colSpan={2}
                className="sticky left-0 z-[1] h-[34px] whitespace-nowrap bg-surface pl-1 text-left text-13 font-medium text-ink-2"
              >
                Choice task
                <GroupRule className="left-0 bg-line-2" />
              </th>
              {model.groups.map((g, gi) => (
                <th
                  key={g.alt.id}
                  scope="colgroup"
                  colSpan={g.columns.length}
                  style={idents[gi].style}
                  className="relative h-[34px] pl-3.5 text-left text-13 font-semibold text-ink"
                >
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <AltGlyph identity={idents[gi].id} size={11} />
                    {g.alt.label}
                  </span>
                  <GroupRule className="left-1 bg-alt" />
                </th>
              ))}
              {ctxCols > 0 && (
                <th
                  scope="colgroup"
                  colSpan={ctxCols}
                  className="relative h-[34px] whitespace-nowrap pl-3.5 text-left text-13 font-medium text-ink-2"
                >
                  Context variables
                  <GroupRule className="left-1 bg-line-2" />
                </th>
              )}
              <th scope="col" className="relative h-[34px] pl-3 pr-1 text-right text-13 font-medium text-ink-2">
                Issues
                <GroupRule className="left-1 bg-line-2" />
              </th>
            </tr>
            {Array.from({ length: lanes }, (_, i) => laneRow(lanes - 1 - i))}
            <tr>
              <th scope="col" className={cx(KEY_1, SUB_TH, 'text-center')}>
                #
              </th>
              <th
                scope="col"
                className={cx(KEY_2, SUB_TH, 'text-center')}
              >
                Block
              </th>
              {model.groups.map((g) =>
                g.columns.map((c, ci) => (
                  <th
                    key={`${g.alt.id}.${c.attr.id}`}
                    scope="col"
                    title={`${g.alt.label}: ${c.attr.name}`}
                    className={cx(
                      SUB_TH,
                      'px-1 text-center',
                      ci === 0 && 'border-l-[3px] border-l-surface',
                    )}
                  >
                    <span className="sr-only">{g.alt.label}: </span>
                    <span className="mx-auto line-clamp-2 max-w-[8rem] break-words">{c.attr.name}</span>
                  </th>
                )),
              )}
              {model.contextVariables.map((cv, i) => (
                <th
                  key={cv.id}
                  scope="col"
                  title={cv.name}
                  className={cx(SUB_TH, 'px-2 text-left', i === 0 && 'border-l-[3px] border-l-surface')}
                >
                  <span className="line-clamp-2 max-w-[8rem] break-words">{cv.name}</span>
                </th>
              ))}
              <th scope="col" className={cx(SUB_TH, 'w-14 border-l-[3px] border-l-surface')}>
                <span className="sr-only">Issues</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((r) => (
              <MatrixRow
                key={r.index}
                r={r}
                groups={model.groups}
                idents={idents}
                active={!!activeTask && activeTask.block === r.row.block && activeTask.taskId === r.row.taskId}
                findings={byTask[r.index]?.findings ?? NO_FINDINGS}
                violations={violations.byRow[r.index] ?? 0}
                onOpen={open}
              />
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center gap-x-[18px] gap-y-2.5 border-t border-line px-5 pb-4 pt-3 text-12 text-ink-3">
        <span className="inline-flex flex-wrap items-center gap-x-1.5">
          Tint = level position, in each alternative&rsquo;s own color
          {firstIdent && (
            <span aria-hidden="true" style={firstIdent.style} className="mx-1 inline-flex gap-0.5 align-middle">
              <span className="bg-alt-tint-8 block h-2.5 w-3.5 rounded-[2px] shadow-hairline" />
              <span className="bg-alt-tint-22 block h-2.5 w-3.5 rounded-[2px]" />
              <span className="bg-alt-tint-34 block h-2.5 w-3.5 rounded-[2px]" />
            </span>
          )}
          lowest → highest level
        </span>
        {ctxCols > 0 && <span>Context variable columns are nominal and stay untinted</span>}
        {brackets.length > 0 && (
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-[7px] w-7 rounded-t-[2px] border-[1.5px] border-b-0 border-risk" />
              linked columns |r| &gt; {cfg.concernThreshold}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-[7px] w-7 rounded-t-[2px] border-[1.5px] border-b-0 border-dashed border-caution"
              />
              |r| &gt; {cfg.warnThreshold}
            </span>
          </span>
        )}
        <span className="ml-auto inline-flex flex-wrap gap-2">
          <Button variant="danger" size="sm" icon={<Trash />} onClick={onClear}>
            Clear design
          </Button>
          <CopyButton text={copyCsv} label="Copy as CSV" />
        </span>
      </footer>
    </div>
  )
}
