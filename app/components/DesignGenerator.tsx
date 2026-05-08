'use client'

import { useState } from 'react'
import type { Project, GenerationMethod, ScoreWeights } from '@/lib/schema'
import {
  defaultScoreWeights,
  generateDesign,
  suggestNumTasks,
  type GenerationResult,
} from '@/lib/designGenerator'
import { paramCount, priorLabels } from '@/lib/dOptimal'
import { analyzeSample, type SampleStatus } from '@/lib/sampleSize'
import { ChevronDown, ChevronRight, Refresh } from './Icons'
import Field, { inputCls } from './editors/Field'

export default function DesignGenerator({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const [numTasks, setNumTasks] = useState(12)
  const [numBlocks, setNumBlocks] = useState(1)
  const [method, setMethod] = useState<GenerationMethod>('balanced')
  const [iterations, setIterations] = useState(1000)
  const [multistarts, setMultistarts] = useState(5)
  const [seed, setSeed] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [weights, setWeights] = useState<ScoreWeights>(defaultScoreWeights)
  const [generating, setGenerating] = useState(false)
  const [lastResult, setLastResult] = useState<GenerationResult | null>(null)

  const suggestions = suggestNumTasks(project)

  const run = () => {
    setGenerating(true)
    // Defer to next frame so the spinner shows
    requestAnimationFrame(() => {
      const result = generateDesign(project, {
        numTasks,
        numBlocks,
        method,
        iterations,
        multistarts,
        seed: seed.trim() === '' ? undefined : Number(seed),
        weights,
      })
      const design = {
        source: 'generated' as const,
        uploadedAt: new Date().toISOString(),
        numTasks: result.rows.length,
        numBlocks: result.numBlocks,
        rows: result.rows,
        mapping: [],
        rawHeaders: [],
        generationParams: {
          method,
          iterations: method === 'balanced' ? iterations : undefined,
          multistarts: method === 'd-optimal' ? multistarts : undefined,
          seed: seed.trim() === '' ? undefined : Number(seed),
          scoreWeights: weights,
        },
      }
      setProject({ ...project, design, updatedAt: new Date().toISOString() })
      setLastResult(result)
      setGenerating(false)
    })
  }

  return (
    <div className="rounded-xl bg-white ring-1 ring-neutral-200/60 shadow-sm p-5 space-y-5">
      <SampleSizePanel
        project={project}
        setProject={setProject}
        numTasks={numTasks}
        numBlocks={numBlocks}
        setNumTasks={setNumTasks}
        setNumBlocks={setNumBlocks}
      />

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Choice tasks"
          required
          hint={`Total across all blocks. = ${(numTasks / Math.max(1, numBlocks)).toFixed(numTasks % numBlocks === 0 ? 0 : 1)} per respondent.`}
        >
          <input
            type="number"
            min={4}
            max={200}
            value={numTasks}
            onChange={(e) => setNumTasks(Math.max(4, Math.min(200, Number(e.target.value))))}
            className={inputCls}
          />
          {suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-neutral-500">Suggested:</span>
              {suggestions.map((n) => (
                <button
                  key={n}
                  onClick={() => setNumTasks(n)}
                  className={`text-[11px] px-2 py-0.5 rounded-md ring-1 transition tabular-nums ${
                    numTasks === n
                      ? 'bg-neutral-900 text-white ring-neutral-900'
                      : 'bg-white ring-neutral-200 text-neutral-700 hover:ring-neutral-300 hover:bg-neutral-50'
                  }`}
                  title={`${n} choice tasks (multiple of attribute level counts — perfect balance possible)`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field
          label="Blocks"
          required
          hint="Choice tasks split evenly across blocks; each respondent sees one block."
        >
          <input
            type="number"
            min={1}
            max={20}
            value={numBlocks}
            onChange={(e) => setNumBlocks(Math.max(1, Math.min(20, Number(e.target.value))))}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Method" required>
        <div className="flex gap-2">
          <MethodChip
            active={method === 'd-optimal'}
            onClick={() => setMethod('d-optimal')}
            title="D-optimal"
            subtitle="Maximizes statistical efficiency for an MNL model"
          />
          <MethodChip
            active={method === 'balanced'}
            onClick={() => setMethod('balanced')}
            title="Balanced search"
            subtitle="Best of K random candidates by validation score"
          />
          <MethodChip
            active={method === 'random'}
            onClick={() => setMethod('random')}
            title="Random"
            subtitle="One-shot uniform random sampling"
          />
        </div>
      </Field>

      {method === 'balanced' && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Iterations">
            <input
              type="number"
              min={10}
              max={50000}
              step={100}
              value={iterations}
              onChange={(e) =>
                setIterations(Math.max(10, Math.min(50000, Number(e.target.value))))
              }
              className={inputCls}
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              More iterations → better designs but slower. 1000 is fast and usually enough.
            </p>
          </Field>
          <Field label="Random seed (optional)">
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value.replace(/[^0-9-]/g, ''))}
              placeholder="auto"
              className={`${inputCls} font-mono`}
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              Use the same seed to reproduce a design exactly.
            </p>
          </Field>
        </div>
      )}

      {method === 'd-optimal' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Multistarts">
              <input
                type="number"
                min={1}
                max={50}
                value={multistarts}
                onChange={(e) =>
                  setMultistarts(Math.max(1, Math.min(50, Number(e.target.value))))
                }
                className={inputCls}
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Independent random starts. Each runs a Federov local search to
                convergence; the best result wins.
              </p>
            </Field>
            <Field label="Random seed (optional)">
              <input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value.replace(/[^0-9-]/g, ''))}
                placeholder="auto"
                className={`${inputCls} font-mono`}
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Same seed + same priors → identical design.
              </p>
            </Field>
          </div>
          <PriorsPanel project={project} setProject={setProject} />
        </>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition"
        >
          {showAdvanced ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Score weights (advanced)
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-4 gap-3 mt-3 p-3 rounded-lg bg-neutral-50/60 ring-1 ring-neutral-200/60">
            {(['balance', 'correlation', 'dominance', 'overlap'] as const).map((k) => (
              <div key={k}>
                <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-1">
                  {k}
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={weights[k]}
                  onChange={(e) =>
                    setWeights({ ...weights, [k]: Number(e.target.value) })
                  }
                  className={`${inputCls} text-xs`}
                />
              </div>
            ))}
            <div className="col-span-4 text-[11px] text-neutral-500">
              Higher weight = the search penalizes that issue more strongly. Defaults
              treat 1 dominated/overlapping choice task as roughly equal to 50% balance
              deviation or |r|=0.5.
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-neutral-100">
        <button
          onClick={run}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {generating && <Refresh size={14} className="animate-spin" />}
          {generating ? 'Generating…' : project.design ? 'Re-generate' : 'Generate design'}
        </button>
        {lastResult && !generating && (
          <ResultSummary
            result={lastResult}
            method={method}
            iterations={iterations}
            multistarts={multistarts}
          />
        )}
      </div>
    </div>
  )
}

function ResultSummary({
  result,
  method,
  iterations,
  multistarts,
}: {
  result: GenerationResult
  method: GenerationMethod
  iterations: number
  multistarts: number
}) {
  const m = result.metrics
  return (
    <div className="text-xs text-neutral-600 leading-relaxed">
      <span className="font-medium text-neutral-900 tabular-nums">
        {result.rows.length} choice tasks
      </span>{' '}
      generated
      {result.dError !== undefined && (
        <>
          {' '}
          · D-error{' '}
          <span className="font-mono tabular-nums text-neutral-900">
            {result.dError.toFixed(4)}
          </span>
        </>
      )}{' '}
      · score{' '}
      <span className="font-mono tabular-nums text-neutral-900">
        {result.score.toFixed(1)}
      </span>
      {method === 'balanced' && (
        <span>
          {' '}
          (best of {iterations}, found at #{result.iterationsRun})
        </span>
      )}
      {method === 'd-optimal' && (
        <span>
          {' '}
          ({multistarts} multistart{multistarts !== 1 ? 's' : ''},{' '}
          {result.iterationsRun} Federov passes total)
        </span>
      )}
      {result.constraintFailures !== undefined && result.constraintFailures > 0 && (
        <span className="text-amber-700">
          {' '}
          · {result.constraintFailures} constraint retr
          {result.constraintFailures !== 1 ? 'ies' : 'y'} hit max
        </span>
      )}
      <div className="text-[11px] text-neutral-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
        <span>
          Balance{' '}
          <span className="tabular-nums">{m.maxBalanceDeviationPct.toFixed(1)}%</span>
        </span>
        <span>
          Correlation{' '}
          <span className="tabular-nums">{m.maxAbsCorrelation.toFixed(2)}</span>
        </span>
        <span>
          Dominance <span className="tabular-nums">{m.dominanceCount}</span>
        </span>
        <span>
          Overlap <span className="tabular-nums">{m.overlapCount}</span>
        </span>
      </div>
    </div>
  )
}

function PriorsPanel({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const [open, setOpen] = useState(false)

  const updateAttrPriors = (attrId: string, priors: number[]) => {
    setProject({
      ...project,
      attributes: project.attributes.map((a) =>
        a.id === attrId ? { ...a, priors } : a,
      ),
      updatedAt: new Date().toISOString(),
    })
  }

  const totalParams = project.attributes.reduce((s, a) => s + paramCount(a), 0)
  const filledCount = project.attributes.reduce(
    (s, a) =>
      s +
      (a.priors ?? []).filter((v, i) => i < paramCount(a) && v !== 0 && !Number.isNaN(v))
        .length,
    0,
  )

  return (
    <div className="rounded-lg ring-1 ring-neutral-200 bg-neutral-50/40">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-neutral-100/60 transition rounded-lg"
      >
        <span className="inline-flex items-center gap-1.5 font-medium text-neutral-700">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Priors (β coefficients)
        </span>
        <span className="text-[11px] text-neutral-500">
          {filledCount > 0
            ? `${filledCount} of ${totalParams} non-zero`
            : `uninformative (all zero) — ${totalParams} parameters`}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Expected coefficients per parameter. Leave at 0 if unknown — the search
            then optimizes for designs robust under any β. Effects coding: the first
            level of each categorical attribute is the reference.
          </p>
          {project.attributes.map((attr) => (
            <PriorRow
              key={attr.id}
              attr={attr}
              onChange={(priors) => updateAttrPriors(attr.id, priors)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PriorRow({
  attr,
  onChange,
}: {
  attr: import('@/lib/schema').Attribute
  onChange: (priors: number[]) => void
}) {
  const labels = priorLabels(attr)
  const k = paramCount(attr)
  const values: number[] = []
  for (let i = 0; i < k; i++) {
    values.push(attr.priors?.[i] ?? 0)
  }

  return (
    <div className="grid grid-cols-12 gap-2 items-center text-xs">
      <div className="col-span-3 truncate font-medium text-neutral-700">
        {attr.name}
        <span className="text-neutral-400 font-normal ml-1">
          ({attr.type}
          {k > 1 ? `, ${k} params` : ''})
        </span>
      </div>
      <div className="col-span-9 grid grid-cols-3 gap-2">
        {labels.map((label, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[10px] text-neutral-500 truncate flex-1" title={label}>
              {label}
            </span>
            <input
              type="number"
              step="0.1"
              value={values[i]}
              onChange={(e) => {
                const newPriors = [...values]
                newPriors[i] = Number(e.target.value)
                onChange(newPriors)
              }}
              className="w-16 bg-white rounded px-1.5 py-0.5 text-xs ring-1 ring-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono tabular-nums"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function SampleSizePanel({
  project,
  setProject,
  numTasks,
  numBlocks,
  setNumTasks,
  setNumBlocks,
}: {
  project: Project
  setProject: (p: Project) => void
  numTasks: number
  numBlocks: number
  setNumTasks: (n: number) => void
  setNumBlocks: (n: number) => void
}) {
  const N = project.targetSampleSize ?? 0
  const analysis = analyzeSample(project, numTasks, numBlocks)

  const updateN = (n: number) => {
    setProject({
      ...project,
      targetSampleSize: n > 0 ? n : undefined,
      updatedAt: new Date().toISOString(),
    })
  }

  const applySuggestion = () => {
    if (!analysis.suggestion) return
    setNumTasks(analysis.suggestion.tasks)
    setNumBlocks(analysis.suggestion.blocks)
  }

  return (
    <div className="rounded-lg ring-1 ring-neutral-200 bg-neutral-50/40 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Target sample
            <span className="text-neutral-400 ml-1.5 normal-case font-normal">
              optional
            </span>
          </h4>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            How many respondents do you expect? We&apos;ll suggest a balanced
            choice-tasks / blocks split.
          </p>
        </div>
        {analysis.status !== 'unset' && <SampleStatusBadge status={analysis.status} />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Respondents (N)">
          <input
            type="number"
            min={0}
            value={N || ''}
            placeholder="e.g. 400"
            onChange={(e) => updateN(Math.max(0, Number(e.target.value)))}
            className={inputCls}
          />
        </Field>
        <div>
          <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
            Suggestion
          </div>
          {analysis.suggestion ? (
            <div className="text-sm">
              <div className="font-medium text-neutral-900 tabular-nums">
                {analysis.suggestion.tasks} choice tasks ·{' '}
                {analysis.suggestion.blocks} block
                {analysis.suggestion.blocks !== 1 ? 's' : ''}
                <span className="text-neutral-500 ml-1.5 text-[11px] font-normal">
                  ({analysis.suggestion.tasksPerRespondent} per respondent)
                </span>
              </div>
              <button
                onClick={applySuggestion}
                className="mt-1 text-[11px] underline underline-offset-4 text-indigo-600 hover:text-indigo-700 transition"
              >
                Apply to inputs below ↓
              </button>
            </div>
          ) : (
            <div className="text-sm text-neutral-400 italic">
              Set N to see a suggestion
            </div>
          )}
        </div>
      </div>

      {N > 0 && analysis.parameters > 0 && (
        <div className="mt-3 text-[11px] text-neutral-500 leading-relaxed border-t border-neutral-200 pt-2">
          Current config →{' '}
          <span className="tabular-nums text-neutral-700">
            {analysis.tasksPerRespondent.toFixed(1)}
          </span>{' '}
          choice tasks per respondent ·{' '}
          <span className="tabular-nums text-neutral-700">
            {analysis.totalObservations.toLocaleString()}
          </span>{' '}
          total observations ·{' '}
          <span className="tabular-nums text-neutral-700 font-medium">
            {analysis.observationsPerParameter.toFixed(0)}
          </span>{' '}
          per parameter
          <span className="text-neutral-400">
            {' '}({analysis.parameters} parameter
            {analysis.parameters !== 1 ? 's' : ''} in this model)
          </span>
        </div>
      )}
    </div>
  )
}

const STATUS_STYLES: Record<SampleStatus, { ring: string; dot: string; label: string }> = {
  good: {
    ring: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Sufficient power',
  },
  borderline: {
    ring: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
    label: 'Borderline',
  },
  low: {
    ring: 'bg-red-50 text-red-800 ring-red-200',
    dot: 'bg-red-500',
    label: 'Insufficient power',
  },
  unset: {
    ring: 'bg-neutral-100 text-neutral-600 ring-neutral-200',
    dot: 'bg-neutral-400',
    label: '',
  },
}

function SampleStatusBadge({ status }: { status: SampleStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full ring-1 ${s.ring}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function MethodChip({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean
  onClick: () => void
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-left px-3 py-2 rounded-lg ring-1 transition ${
        active
          ? 'bg-neutral-900 text-white ring-neutral-900'
          : 'bg-white text-neutral-700 ring-neutral-200 hover:ring-neutral-300 hover:bg-neutral-50'
      }`}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className={`text-[11px] mt-0.5 ${active ? 'text-white/70' : 'text-neutral-500'}`}>
        {subtitle}
      </div>
    </button>
  )
}

