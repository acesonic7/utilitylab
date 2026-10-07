'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { Attribute, Design, GenerationMethod, Project, ScoreWeights } from '@/lib/schema'
import {
  defaultScoreWeights,
  suggestNumTasks,
  type GenerationProgress,
  type GenerationResult,
} from '@/lib/designGenerator'
import { identificationIssue, paramCount, priorLabels } from '@/lib/dOptimal'
import { analyzeSample, type SampleStatus } from '@/lib/sampleSize'
import { plural } from '@/lib/text'
import { ArrowDown, ChevronRight, Refresh } from './Icons'
import { Button, Field, Gauge, Input, NumberInput, Tag, cx, type GaugeBand, type TagTone } from './ui'
import { Disclosure, inkButtonClass } from './design/controls'
import { useLatestProject, type SetProject } from './ProjectStore'
import { useWorkspaceActions } from './Workspace'
import { runGeneration, type GenerationRun } from './design/runGeneration'

const METHODS: { value: GenerationMethod; title: string; subtitle: string }[] = [
  { value: 'd-optimal', title: 'D-efficient', subtitle: 'Minimises the MNL D-error at the priors you set' },
  { value: 'balanced', title: 'Balanced search', subtitle: 'Best of K random candidates by validation score' },
  { value: 'random', title: 'Random', subtitle: 'One-shot uniform random sampling' },
]

const WEIGHT_KEYS = ['balance', 'correlation', 'dominance', 'overlap'] as const
const WEIGHT_LABELS: Record<(typeof WEIGHT_KEYS)[number], string> = {
  balance: 'Balance',
  correlation: 'Correlation',
  dominance: 'Dominance',
  overlap: 'Overlap',
}

type LastRun = {
  result: GenerationResult
  method: GenerationMethod
  iterations: number
  multistarts: number
  /** The structure had enabled constraints when this ran. */
  hadConstraints: boolean
}

type Settings = {
  numTasks: number
  numBlocks: number
  method: GenerationMethod
  iterations: number
  multistarts: number
  seed: string
  weights: ScoreWeights
}

// Start from the current design's shape and, for a generated design, its settings.
function settingsFrom(design: Design | null | undefined): Settings {
  const params = design?.source === 'generated' ? design.generationParams : undefined
  return {
    numTasks: design ? Math.max(4, Math.min(200, design.rows.length || design.numTasks)) : 12,
    numBlocks: design ? Math.max(1, Math.min(20, design.numBlocks)) : 1,
    method: params?.method ?? 'd-optimal',
    iterations: params?.iterations ?? 1000,
    multistarts: params?.multistarts ?? 5,
    // Left empty so Re-generate draws a new seed; the seed used is shown with the design.
    seed: '',
    weights: params?.scoreWeights ?? defaultScoreWeights,
  }
}

export default function DesignGenerator({
  project,
  setProject,
}: {
  project: Project
  setProject: SetProject
}) {
  const [settings, setSettings] = useState(() => settingsFrom(project.design))
  const { numTasks, numBlocks, method, iterations, multistarts, seed, weights } = settings
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<GenerationProgress | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const running = useRef<GenerationRun | null>(null)
  // A search left running when the panel closes is stopped, not left to finish unseen.
  useEffect(() => () => running.current?.cancel(), [])
  const [lastRun, setLastRun] = useState<LastRun | null>(null)
  const generatedRows = useRef<unknown>(null)
  const seededFrom = useRef(project.design)
  // True once the user changes a setting; cleared when a run or a new design re-seeds the form.
  const edited = useRef(false)
  const uid = useId()
  const getProject = useLatestProject()

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    edited.current = true
    setSettings((s) => (s[key] === value ? s : { ...s, [key]: value }))
  }
  const setNumTasks = (n: number) => set('numTasks', n)
  const setNumBlocks = (n: number) => set('numBlocks', n)

  // When the design is replaced from elsewhere (upload, reset, clear), drop the summary and,
  // unless the user has changed the settings, re-seed them from the new design.
  // The summary can render a beat before the generated design reaches this deferred view.
  useEffect(() => {
    const design = project.design
    if (design === seededFrom.current) return
    seededFrom.current = design
    if (design && design.rows === generatedRows.current) return
    setLastRun(null)
    if (!edited.current) setSettings(settingsFrom(design))
  }, [project.design])

  const suggestions = suggestNumTasks(project)
  const perRespondent = (numTasks / Math.max(1, numBlocks)).toFixed(numTasks % numBlocks === 0 ? 0 : 1)

  const { goTo } = useWorkspaceActions()
  const blockIssue =
    numBlocks < 1
      ? 'Set at least 1 block.'
      : numBlocks > numTasks
        ? `${plural(numBlocks, 'block')} need at least ${numBlocks} choice tasks, one per block, or some respondents would see none. Add choice tasks or use fewer blocks.`
        : null
  const blocker = blockIssue ?? (method === 'd-optimal' ? identificationIssue(project, numTasks) : null)

  const run = () => {
    if (running.current) return
    if (blockIssue || (identificationIssue(getProject(), numTasks) && method === 'd-optimal')) return
    setGenerating(true)
    setProgress(null)
    setRunError(null)
    const seedValue = seed.trim() === '' ? undefined : Number(seed)
    // The latest structure, not this view's deferred copy; the run works on that snapshot.
    const snapshot = getProject()
    const run = runGeneration(
      snapshot,
      { numTasks, numBlocks, method, iterations, multistarts, seed: seedValue, weights },
      setProgress,
    )
    running.current = run
    run.promise.then(
      (result) => {
        running.current = null
        setProgress(null)
        if (!result) return setGenerating(false) // cancelled
        finish(result, snapshot)
      },
      (err: Error) => {
        running.current = null
        setProgress(null)
        setGenerating(false)
        setRunError(err.message)
      },
    )
  }

  const cancel = () => {
    running.current?.cancel()
  }

  // Settings come from the render that started the run, so they match the result.
  const finish = (result: GenerationResult, snapshot: Project) => {
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
        seed: result.seed,
        scoreWeights: weights,
      },
    }
    if (design.rows.length === 0) {
      setGenerating(false)
      return
    }
    generatedRows.current = result.rows
    edited.current = false
    setProject((p) => ({ ...p, design, updatedAt: new Date().toISOString() }))
    setLastRun({ result, method, iterations, multistarts, hadConstraints: (snapshot.constraints ?? []).some((c) => c.enabled) })
    setGenerating(false)
  }

  const seedField = (hint: string) => (
    <Field label="Random seed" optional hint={hint}>
      {(id, describedBy) => (
        <Input
          id={id}
          aria-describedby={describedBy}
          inputMode="numeric"
          value={seed}
          onChange={(e) => set('seed', e.target.value.replace(/[^0-9-]/g, ''))}
          placeholder="auto"
          mono
        />
      )}
    </Field>
  )

  return (
    <div className="space-y-6">
      <SampleSizePanel
        project={project}
        setProject={setProject}
        numTasks={numTasks}
        numBlocks={numBlocks}
        setNumTasks={setNumTasks}
        setNumBlocks={setNumBlocks}
      />

      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        <div className="min-w-0">
          <Field label="Choice tasks" hint={`Total across all blocks: ${perRespondent} per respondent.`}>
            {(id, describedBy) => (
              <NumberInput
                id={id}
                aria-describedby={describedBy}
                required
                integer
                min={4}
                max={200}
                emptyBehavior={0}
                value={numTasks}
                onValueChange={setNumTasks}
              />
            )}
          </Field>
          {suggestions.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Suggested choice task counts">
              <span className="mr-0.5 text-12 text-ink-3">Suggested:</span>
              {suggestions.map((n) => {
                const on = numTasks === n
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setNumTasks(n)}
                    title={`${n} choice tasks: a multiple of every attribute's level count, so each level can appear equally often. A D-efficient design may still favour the extreme levels of numeric attributes.`}
                    className={cx(
                      'focus-ring tnum inline-flex h-6 items-center rounded-pill border px-2 text-12 font-medium leading-none transition-colors',
                      on ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-surface text-ink-2 hover:border-ink-4 hover:text-ink',
                    )}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <Field label="Blocks" hint="Choice tasks are dealt to blocks in turn, so block sizes differ by at most one; each respondent sees one block (in Qualtrics TXT imports, after you add a randomizer).">
          {(id, describedBy) => (
            <NumberInput
              id={id}
              aria-describedby={describedBy}
              required
              integer
              min={1}
              max={Math.max(1, Math.min(20, numTasks))}
              emptyBehavior={0}
              value={numBlocks}
              onValueChange={setNumBlocks}
            />
          )}
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-12 font-medium text-ink-2">Method</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {METHODS.map((m) => {
            const on = method === m.value
            return (
              <label
                key={m.value}
                className={cx(
                  'relative flex cursor-pointer gap-2.5 rounded-card border bg-surface px-3 py-2.5 transition-colors',
                  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink',
                  on ? 'border-ink shadow-[inset_0_0_0_1px_rgb(var(--ink))]' : 'border-line-2 hover:border-ink-4',
                )}
              >
                <input
                  type="radio"
                  name={`${uid}-method`}
                  value={m.value}
                  checked={on}
                  onChange={() => set('method', m.value)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cx(
                    'mt-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border',
                    on ? 'border-ink' : 'border-ink-3',
                  )}
                >
                  {on && <span className="size-1.5 rounded-full bg-ink" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-14 font-semibold text-ink">{m.title}</span>
                  <span className="mt-0.5 block text-12 text-ink-3">{m.subtitle}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {method === 'balanced' && (
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          <Field
            label="Iterations"
            hint="More iterations → better designs but slower. 1000 is fast and usually enough."
          >
            {(id, describedBy) => (
              <NumberInput
                id={id}
                aria-describedby={describedBy}
                integer
                min={10}
                max={50000}
                step={100}
                emptyBehavior={0}
                value={iterations}
                onValueChange={(n) => set('iterations', n)}
              />
            )}
          </Field>
          {seedField('Use the same seed to reproduce a design exactly.')}
        </div>
      )}

      {method === 'd-optimal' && (
        <>
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <Field
              label="Multistarts"
              hint="Independent random starts. Each runs a coordinate-exchange search to convergence; the best result wins."
            >
              {(id, describedBy) => (
                <NumberInput
                  id={id}
                  aria-describedby={describedBy}
                  integer
                  min={1}
                  max={50}
                  emptyBehavior={0}
                  value={multistarts}
                  onValueChange={(n) => set('multistarts', n)}
                />
              )}
            </Field>
            {seedField('Same seed + same priors → identical design.')}
          </div>
          <PriorsPanel project={project} setProject={setProject} />
        </>
      )}

      {method === 'random' && (
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          {seedField('Use the same seed to reproduce a design exactly.')}
        </div>
      )}

      <Disclosure
        id={`${uid}-weights`}
        label="Score weights (advanced)"
        open={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {WEIGHT_KEYS.map((k) => (
            <Field key={k} label={WEIGHT_LABELS[k]}>
              {(id) => (
                <NumberInput
                  id={id}
                  size="sm"
                  mono
                  min={0}
                  step={0.1}
                  emptyBehavior={0}
                  value={weights[k]}
                  onValueChange={(n) => set('weights', { ...weights, [k]: n })}
                />
              )}
            </Field>
          ))}
        </div>
        <p className="mt-3 text-12 text-ink-3">
          Higher weight = the search penalizes that issue more strongly. With the defaults, one
          dominance relation or one pair of identical alternatives costs about as much as a 50%
          level-balance deviation or |r| = 0.5.
        </p>
      </Disclosure>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line pt-5">
        <button
          type="button"
          onClick={run}
          disabled={generating || blocker !== null}
          aria-describedby={blocker ? `${uid}-blocker` : undefined}
          className={inkButtonClass('lg')}
        >
          {generating && (
            <Refresh size={14} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          )}
          {generating ? 'Generating…' : project.design ? 'Re-generate' : 'Generate design'}
        </button>
        {generating && (
          <Button onClick={cancel} aria-label="Cancel the search">
            Cancel
          </Button>
        )}
        <div role="status" className="min-w-0 flex-1">
          {blocker ? (
            <p id={`${uid}-blocker`} className="text-13 font-medium text-risk">
              {blocker}
            </p>
          ) : generating ? (
            <div className="min-w-0">
              <div
                role="progressbar"
                aria-label="Search progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress ? Math.round(progress.fraction * 100) : undefined}
                className="h-1.5 w-full max-w-sm overflow-hidden rounded-pill bg-surface-3"
              >
                <div
                  className="h-full rounded-pill bg-ink transition-[width] duration-200 motion-reduce:transition-none"
                  style={{ width: `${Math.max(2, Math.round((progress?.fraction ?? 0) * 100))}%` }}
                />
              </div>
              <p className="tnum mt-1.5 truncate text-12 text-ink-3">
                {progress ? progress.label : 'Starting the search…'} · the page stays usable while it runs
              </p>
            </div>
          ) : runError ? (
            <p className="text-13 font-medium text-risk">The search stopped: {runError}</p>
          ) : (
            lastRun && <ResultSummary run={lastRun} />
          )}
        </div>
        {lastRun && !generating && !blocker && (
          <Button onClick={() => goTo('choice-tasks', { lens: false })}>
            Preview choice tasks
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}

function ResultSummary({ run }: { run: LastRun }) {
  const { result, method, iterations, multistarts } = run
  const m = result.metrics
  const fig = 'tnum font-medium text-ink'
  return (
    <div className="text-13 text-ink-2">
      <p>
        <span className={fig}>{result.rows.length} choice tasks</span> generated
        {result.dError !== undefined && Number.isFinite(result.dError) && (
          <>
            {' '}
            · D-error <span className="tnum font-mono text-ink">{result.dError.toFixed(4)}</span>
          </>
        )}
        {method === 'd-optimal' && result.dError !== undefined && !Number.isFinite(result.dError) && (
          <span className="font-medium text-risk">
            {' '}
            · no design found whose parameters can all be estimated.{' '}
            {run.hadConstraints
              ? 'The constraints may force two attributes to change together; loosen them or add choice tasks.'
              : 'Add choice tasks or levels.'}
          </span>
        )}{' '}
        · score <span className="tnum font-mono text-ink">{result.score.toFixed(1)}</span>
        {' '}· seed <span className="tnum font-mono text-ink">{result.seed}</span>
        {method === 'balanced' && (
          <span className="text-ink-3">
            {' '}
            (best of {iterations}, found at #{result.iterationsRun})
          </span>
        )}
        {method === 'd-optimal' && (
          <span className="text-ink-3">
            {' '}
            ({multistarts} multistart{multistarts !== 1 ? 's' : ''}, {result.iterationsRun} coordinate-exchange
            passes total)
          </span>
        )}
        {result.constraintFailures !== undefined && result.constraintFailures > 0 && (
          <span className="font-medium text-caution">
            {' '}
            · {plural(result.constraintFailures, 'choice task')} still{' '}
            {result.constraintFailures === 1 ? 'breaks' : 'break'} a constraint; the constraints may rule out
            every level for an alternative
          </span>
        )}
      </p>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-12 text-ink-3">
        <span>
          <span title="The largest gap between how often a level appears and its ideal count. 0% is perfectly balanced.">
            Level imbalance <span className="tnum text-ink-2">{m.maxBalanceDeviationPct.toFixed(1)}%</span>
          </span>
        </span>
        <span>
          Correlation <span className="tnum text-ink-2">{m.maxAbsCorrelation.toFixed(2)}</span>
        </span>
        <span>
          Dominance <span className="tnum text-ink-2">{m.dominanceCount}</span>
        </span>
        <span>
          Overlap <span className="tnum text-ink-2">{m.overlapCount}</span>
        </span>
      </p>
    </div>
  )
}

function PriorsPanel({
  project,
  setProject,
}: {
  project: Project
  setProject: SetProject
}) {
  const [open, setOpen] = useState(false)
  const id = useId()

  // One β at a time, merged into the latest attributes, so quick edits and newer Structure edits all survive.
  const setPrior = (attrId: string, index: number, value: number) => {
    setProject((p) => ({
      ...p,
      attributes: p.attributes.map((a) => {
        if (a.id !== attrId) return a
        const priors = Array.from({ length: Math.max(paramCount(a), index + 1) }, (_, i) => a.priors?.[i] ?? 0)
        priors[index] = value
        return { ...a, priors }
      }),
      updatedAt: new Date().toISOString(),
    }))
  }

  const totalParams = project.attributes.reduce((s, a) => s + paramCount(a), 0)
  const filledCount = project.attributes.reduce(
    (s, a) =>
      s + (a.priors ?? []).filter((v, i) => i < paramCount(a) && v !== 0 && !Number.isNaN(v)).length,
    0,
  )

  return (
    <Disclosure
      id={`${id}-priors`}
      label="Priors (β coefficients)"
      summary={
        filledCount > 0
          ? `${filledCount} of ${totalParams} non-zero`
          : `uninformative (all zero) — ${totalParams} parameters`
      }
      open={open}
      onToggle={() => setOpen(!open)}
    >
      <p className="text-12 text-ink-3">
        Expected coefficients on the utility scale. Numeric attributes take one coefficient per unit of
        their value (for example per minute); categorical and boolean attributes are dummy coded against
        their first level. Leave them at 0 if unknown: the design is then efficient for the case where
        every coefficient is zero, which is a starting point, not a design that suits any β. Enter
        estimates from a pilot or the literature when you have them. A D-efficient design is only as good
        as its priors: if the true values are far from them it can be less efficient than a random
        design, so use non-zero priors only when you are confident in them (Walker et al., 2018; see{' '}
        <a href="/methods#3-priors-and-why-d-efficiency-is-not-the-whole-story" className="underline decoration-line-2 underline-offset-[3px] hover:text-ink">
          Methods
        </a>
        ).
      </p>
      <div className="mt-3 divide-y divide-line">
        {project.attributes.map((attr) => (
          <PriorRow key={attr.id} attr={attr} onChange={(i, v) => setPrior(attr.id, i, v)} />
        ))}
      </div>
    </Disclosure>
  )
}

function PriorRow({ attr, onChange }: { attr: Attribute; onChange: (index: number, value: number) => void }) {
  const labels = priorLabels(attr)
  const k = paramCount(attr)
  const values: number[] = []
  for (let i = 0; i < k; i++) values.push(attr.priors?.[i] ?? 0)
  const uid = useId()

  return (
    <div className="grid gap-x-4 gap-y-2 py-2.5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-center">
      <div className="min-w-0 text-13">
        <span className="font-medium text-ink">{attr.name}</span>{' '}
        <span className="text-ink-3">
          ({attr.type}
          {k > 1 ? `, ${k} params` : ''})
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-3">
        {labels.map((label, i) => (
          <div key={i} className="flex min-w-0 items-center gap-2">
            <label htmlFor={`${uid}-${i}`} className="min-w-0 flex-1 truncate text-12 text-ink-3" title={label}>
              {label}
            </label>
            <NumberInput
              id={`${uid}-${i}`}
              size="sm"
              mono
              step={0.1}
              emptyBehavior={0}
              className="tnum !w-20"
              value={values[i]}
              onValueChange={(n) => onChange(i, n)}
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
  setProject: SetProject
  numTasks: number
  numBlocks: number
  setNumTasks: (n: number) => void
  setNumBlocks: (n: number) => void
}) {
  const N = project.targetSampleSize ?? 0
  const analysis = analyzeSample(project, numTasks, numBlocks)
  const titleId = useId()

  // Blank or 0 clears the target.
  const updateN = (n: number | undefined) => {
    setProject((p) => ({
      ...p,
      targetSampleSize: n !== undefined && n > 0 ? n : undefined,
      updatedAt: new Date().toISOString(),
    }))
  }

  const applySuggestion = () => {
    if (!analysis.suggestion) return
    setNumTasks(analysis.suggestion.tasks)
    setNumBlocks(analysis.suggestion.blocks)
  }

  return (
    <div role="group" aria-labelledby={titleId} className="rounded-card bg-surface-2 p-4 shadow-hairline">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-[min(100%,15rem)] flex-1">
          <h4 id={titleId} className="text-14 font-semibold text-ink">
            Target sample <span className="font-normal text-ink-3">(optional)</span>
          </h4>
          <p className="mt-0.5 text-12 text-ink-3">
            How many respondents do you expect? We&apos;ll suggest a balanced choice tasks / blocks split.
          </p>
        </div>
        {analysis.status !== 'unset' && <SampleStatusBadge status={analysis.status} />}
      </div>

      <div className="mt-3.5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
        <Field label="Respondents (N)">
          {(id) => (
            <NumberInput
              id={id}
              integer
              min={0}
              emptyBehavior="clear"
              value={N || undefined}
              placeholder="e.g. 400"
              onValueChange={updateN}
            />
          )}
        </Field>
        <div className="min-w-0">
          <p className="text-12 font-medium text-ink-2">Suggestion</p>
          {analysis.suggestion ? (
            <div className="mt-1.5">
              <p className="tnum text-14 font-medium text-ink">
                {analysis.suggestion.tasks} choice tasks · {analysis.suggestion.blocks} block
                {analysis.suggestion.blocks !== 1 ? 's' : ''}
                <span className="ml-1.5 text-12 font-normal text-ink-3">
                  ({analysis.suggestion.tasksPerRespondent} per respondent)
                </span>
              </p>
              <button
                type="button"
                onClick={applySuggestion}
                className="focus-ring mt-1 inline-flex items-center gap-1 rounded-bar text-12 font-medium text-ink underline decoration-line-2 underline-offset-4 hover:decoration-ink"
              >
                Apply to the inputs below
                <ArrowDown size={12} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <p className="mt-1.5 text-13 text-ink-3">Set N to see a suggestion</p>
          )}
        </div>
      </div>

      {N > 0 && analysis.parameters > 0 && (
        <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3">
          <p className="min-w-[min(100%,15rem)] flex-1 text-12 text-ink-3">
            Current configuration →{' '}
            <span className="tnum text-ink-2">{analysis.tasksPerRespondent.toFixed(1)}</span> choice tasks
            per respondent ·{' '}
            <span className="tnum text-ink-2">{analysis.totalObservations.toLocaleString()}</span> total
            observations ·{' '}
            <span className="tnum font-medium text-ink">{analysis.observationsPerParameter.toFixed(0)}</span>{' '}
            per parameter
            <span>
              {' '}
              ({analysis.parameters} parameter{analysis.parameters !== 1 ? 's' : ''} in this model)
            </span>
          </p>
          <div className="w-[140px]" title="Low below 25, borderline 25–50, good from 50">
            <Gauge
              value={analysis.observationsPerParameter}
              min={0}
              max={Math.max(100, Math.ceil(analysis.observationsPerParameter / 50) * 50)}
              bands={obsBands(analysis.observationsPerParameter)}
              ariaLabel="Observations per parameter"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Same thresholds as analyzeSample: low < 25, borderline < 50, good from 50.
function obsBands(value: number): GaugeBand[] {
  return [
    { to: 25, tone: 'risk' },
    { to: 50, tone: 'caution' },
    { to: Math.max(100, Math.ceil(value / 50) * 50), tone: 'ok' },
  ]
}

const STATUS: Record<Exclude<SampleStatus, 'unset'>, { tone: TagTone; label: string }> = {
  // A rule of thumb on observations per parameter, not a power analysis, so the labels say so.
  good: { tone: 'ok', label: 'Enough observations' },
  borderline: { tone: 'caution', label: 'Borderline' },
  low: { tone: 'risk', label: 'Too few observations' },
}

function SampleStatusBadge({ status }: { status: SampleStatus }) {
  if (status === 'unset') return null
  const s = STATUS[status]
  return (
    <Tag tone={s.tone}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {s.label}
    </Tag>
  )
}
