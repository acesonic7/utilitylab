'use client'

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { Attribute, Level } from '@/lib/schema'
import { travelModeExample as example } from '@/lib/example'
import { altIdentities, altIdentity, altStyle } from '@/lib/altIdentity'
import { matrixGroups } from '@/lib/designMatrix'
import { levelDisplayText } from '@/lib/format'
import { validate } from '@/lib/validation'
import type { SearchTrace } from '@/lib/searchTrace'
import { cellFor, orderedAlternatives, orderedAttributes } from '../choice-tasks/model'
import { CheckIcon } from '../choice-tasks/icons'
import { Download, Pause, Play } from '../Icons'
import { StepDot } from '../shell/Rail'
import { SECTIONS } from '../shell/sections'
import { AltGlyph, IconButton, cx } from '../ui'

// One frame per step of the app, in the rail's order, all drawn from the example study
// and the design the entrance search ended on.
const LINES = [
  'Define the choice set',
  'Generate or upload the design',
  'See what respondents will see',
  'Check the design before fielding it',
  'Take it to the field',
]
const DWELL_MS = [3600, 4200, 4400, 3800, 3800]
const SEARCH_MS = 1600
const CHOOSE_AFTER_MS = 1500

const CELL = 22
const GAP = 4
// Where the design rests, at half size, above the frames that use it.
const DOCKED = 'translateY(-112px) scale(0.5)'

const EXPORTS = [
  { platform: 'Qualtrics', file: '.qsf' },
  { platform: 'LimeSurvey', file: '.lss' },
  { platform: 'Sawtooth', file: '.csv' },
]

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// The level as respondents read it, without a pivoted level's change in brackets.
function levelText(attr: Attribute, level: Level): string {
  return levelDisplayText(attr, level).replace(/\s*\(.*\)$/, '')
}

const MOVE = 'transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none'

function Layer({ on, className, children }: { on: boolean; className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        'absolute flex items-center justify-center px-4 sm:px-6',
        MOVE,
        on ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

// Children come in one after another when the frame opens.
function stagger(on: boolean, order: number): CSSProperties {
  return { transitionDelay: on ? `${120 + order * 70}ms` : '0ms' }
}

const POP = cx(MOVE, 'data-[on=false]:translate-y-1.5 data-[on=false]:opacity-0')

export function Film({ trace, active }: { trace: SearchTrace; active: boolean }) {
  // Mounted on the client only, with the landing screen.
  const [reduce] = useState(prefersReducedMotion)
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(reduce)
  const last = trace.frames.length - 1
  const [tick, setTick] = useState(last)
  const [chosen, setChosen] = useState(false)

  useEffect(() => {
    if (!active || paused) return
    const t = window.setTimeout(() => setStep((s) => (s + 1) % SECTIONS.length), DWELL_MS[step])
    return () => window.clearTimeout(t)
  }, [active, paused, step])

  // 02 Design replays the search; every other frame shows the design it ended on.
  useEffect(() => {
    if (step !== 1 || reduce || last < 1) return setTick(last)
    setTick(0)
    const t = window.setInterval(() => setTick((n) => Math.min(last, n + 1)), SEARCH_MS / last)
    return () => window.clearInterval(t)
  }, [step, reduce, last])

  useEffect(() => {
    setChosen(false)
    if (step !== 2) return
    const t = window.setTimeout(() => setChosen(true), reduce ? 0 : CHOOSE_AFTER_MS)
    return () => window.clearTimeout(t)
  }, [step, reduce])

  const alts = useMemo(() => orderedAlternatives(example), [])
  const attrs = useMemo(() => orderedAttributes(example), [])
  const groups = useMemo(() => matrixGroups(example), [])
  const findings = useMemo(
    () => validate({ ...example, design: example.design && { ...example.design, rows: trace.rows } }).summary,
    [trace],
  )

  const frame = trace.frames[Math.min(tick, last)]
  const dError = Number.isFinite(frame.dError) ? frame.dError.toFixed(3) : '—'
  const finalD = trace.frames[last].dError.toFixed(3)
  const task = trace.rows[0]
  const section = SECTIONS[step]
  const cols = trace.columns.length
  const width = cols * CELL + (cols - 1) * GAP

  return (
    <figure className="overflow-hidden rounded-hero bg-surface shadow-raised">
      <div
        role="img"
        aria-label={`${section.index} ${section.title}: ${LINES[step]}`}
        className="relative h-[332px] overflow-hidden"
      >
        <div aria-hidden="true" className="absolute inset-0">
          {/* 01 Structure */}
          <Layer on={step === 0} className="inset-0">
            <div className="flex w-full max-w-[470px] flex-col gap-5">
              <div>
                <p className="font-mono text-12 text-ink-3">Alternatives</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {altIdentities(example).map((id, i) => (
                    <span
                      key={id.altId}
                      data-on={step === 0}
                      style={stagger(step === 0, i)}
                      className={cx(
                        'inline-flex h-7 items-center gap-1.5 rounded-pill border border-line-2 bg-surface px-2.5 text-13 font-medium text-ink',
                        POP,
                      )}
                    >
                      <AltGlyph identity={id} size={10} />
                      {id.label}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-mono text-12 text-ink-3">Attributes and levels</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {attrs.map((attr, i) => (
                    <li
                      key={attr.id}
                      data-on={step === 0}
                      style={stagger(step === 0, alts.length + i)}
                      className={cx('grid grid-cols-[116px_minmax(0,1fr)] items-baseline gap-x-2.5', POP)}
                    >
                      <span className="text-13 font-medium text-ink">{attr.name}</span>
                      <span className="flex flex-wrap gap-x-1.5 gap-y-1">
                        {attr.levels.map((level) => (
                          <span
                            key={level.id}
                            className="rounded-tick bg-surface-3 px-1.5 py-[3px] font-mono text-12 leading-none text-ink-2"
                          >
                            {levelText(attr, level)}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Layer>

          {/* The design: centre stage in 02, then docked above the frames that use it. */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={cx('relative', MOVE, step === 0 && 'opacity-0')}
              style={{ width, transform: step === 0 ? 'scale(0.94)' : step === 1 ? undefined : DOCKED }}
            >
              <div className="mb-2 flex" style={{ gap: GAP }}>
                {groups.map((g) => {
                  const id = altIdentity(example, g.alt.id)
                  const n = g.columns.length
                  return (
                    <span
                      key={g.alt.id}
                      style={{ ...altStyle(id), width: n * CELL + (n - 1) * GAP }}
                      className="flex shrink-0 items-center gap-1.5"
                    >
                      <AltGlyph identity={id} size={9} />
                      <span className="bg-alt h-[1.5px] flex-1 rounded-full opacity-50" />
                    </span>
                  )
                })}
              </div>
              <div className="relative flex flex-col" style={{ gap: GAP }}>
                {frame.levels.map((row, r) => (
                  <div key={r} className="flex" style={{ gap: GAP }}>
                    {row.map((level, c) => {
                      const col = trace.columns[c]
                      const strength = level >= 0 ? 0.22 + (0.78 * level) / Math.max(1, col.levelCount - 1) : 0.1
                      return (
                        <span
                          key={c}
                          className="rounded-[5px] transition-colors duration-150"
                          style={{
                            width: CELL,
                            height: CELL,
                            backgroundColor: `rgb(var(${altIdentity(example, col.altId).cssVar}) / ${strength.toFixed(2)})`,
                          }}
                        />
                      )
                    })}
                  </div>
                ))}
                {/* Choice task 1, the row the next frame opens up. */}
                <span
                  className={cx(
                    'absolute -inset-x-1.5 -top-1.5 rounded-[9px] border-[3px] border-ink transition-opacity duration-300',
                    step === 2 ? 'opacity-100' : 'opacity-0',
                  )}
                  style={{ height: CELL + 12 }}
                />
              </div>
              <p
                className={cx(
                  'absolute inset-x-0 top-full mt-4 text-center font-mono text-13 text-ink-3 transition-opacity duration-300',
                  step === 1 ? 'opacity-100' : 'opacity-0',
                )}
              >
                D-optimal search · D-error <span className="tnum text-ink">{dError}</span>
              </p>
            </div>
          </div>

          {/* 03 Choice tasks */}
          <Layer on={step === 2} className="inset-x-0 bottom-0 top-[104px]">
            <div className="w-full max-w-[470px]">
              <p className="mb-2 font-mono text-12 text-ink-3">Block 1 · choice task 1</p>
              <div className="grid grid-cols-4 gap-1.5">
                {alts.map((alt, i) => {
                  const id = altIdentity(example, alt.id)
                  const picked = chosen && i === 1
                  return (
                    <div
                      key={alt.id}
                      data-on={step === 2}
                      style={{ ...altStyle(id), ...stagger(step === 2, i) }}
                      className={cx(
                        'relative flex flex-col overflow-hidden rounded-well bg-surface transition-[opacity,transform,box-shadow] duration-500 ease-out motion-reduce:transition-none data-[on=false]:translate-y-1.5 data-[on=false]:opacity-0',
                        picked ? 'shadow-[0_0_0_2px_rgb(var(--alt))]' : 'shadow-hairline',
                      )}
                    >
                      <span className="bg-alt absolute inset-x-0 top-0 h-[3px]" />
                      <div
                        className={cx(
                          'flex h-[46px] flex-col items-center justify-center gap-1 px-1 pt-1 text-center transition-colors duration-300',
                          picked && 'bg-alt-tint-8',
                        )}
                      >
                        <AltGlyph identity={id} size={10} />
                        <span className="max-w-full truncate text-12 font-semibold leading-[14px] text-ink">
                          {id.label}
                        </span>
                      </div>
                      {attrs.map((attr) => {
                        const cell = cellFor(attr, alt, task)
                        const value = cell.kind === 'value'
                        return (
                          <div
                            key={attr.id}
                            className={cx(
                              'flex h-[25px] items-center justify-center border-t border-line px-1 text-12 text-ink',
                              !value && 'hatch text-ink-3',
                            )}
                          >
                            <span className="truncate">
                              {cell.kind !== 'value'
                                ? '—'
                                : cell.figure
                                  ? `${cell.figure.num}${cell.figure.unit ? ` ${cell.figure.unit}` : ''}`
                                  : cell.word}
                            </span>
                          </div>
                        )
                      })}
                      <div className="flex h-[27px] items-center justify-center border-t border-line">
                        <span
                          className={cx(
                            'flex size-3.5 items-center justify-center rounded-full transition-colors duration-300',
                            picked ? 'bg-alt text-paper' : 'shadow-[inset_0_0_0_1.5px_rgb(var(--ink-4))]',
                          )}
                        >
                          {picked && <CheckIcon className="size-2.5" />}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Layer>

          {/* 04 Diagnostics */}
          <Layer on={step === 3} className="inset-x-0 bottom-0 top-[104px]">
            <div className="grid w-full max-w-[470px] grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile on={step === 3} order={0} label="D-error" value={finalD} />
              {example.experimentType === 'labeled' ? (
                // Dominance isn't judged between labeled alternatives; a green 0 would read as a pass.
                <Tile on={step === 3} order={1} label="Dominance" value="—" note="labeled: not checked" />
              ) : (
                <Tile on={step === 3} order={1} label="Dominance" findings={findings.dominance} />
              )}
              <Tile on={step === 3} order={2} label="Level balance" findings={findings.balance} />
              <Tile on={step === 3} order={3} label="Correlation" findings={findings.correlation} />
            </div>
          </Layer>

          {/* 05 Export */}
          <Layer on={step === 4} className="inset-x-0 bottom-0 top-[104px]">
            <div className="w-full max-w-[470px]">
              <div className="grid grid-cols-3 gap-2">
                {EXPORTS.map((e, i) => (
                  <div
                    key={e.platform}
                    data-on={step === 4}
                    style={stagger(step === 4, i)}
                    className={cx('rounded-card bg-surface px-3 py-3 shadow-hairline', POP)}
                  >
                    <Download size={15} className="text-ink-3" />
                    <p className="mt-2.5 truncate text-13 font-semibold text-ink">{e.platform}</p>
                    <p className="mt-0.5 font-mono text-12 text-ink-3">{e.file}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-13 text-ink-3">…and a methods paragraph for your paper.</p>
            </div>
          </Layer>
        </div>
      </div>

      <figcaption className="flex items-center gap-3 border-t border-line px-4 py-3 sm:px-5">
        <ol className="flex shrink-0 items-center gap-1.5">
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-label={`${s.index} ${s.title}`}
                aria-current={i === step ? 'step' : undefined}
                className="focus-ring block rounded-full"
              >
                <StepDot index={s.index} state={i < step ? 'done' : i === step ? 'next' : 'todo'} />
              </button>
            </li>
          ))}
        </ol>
        <p className="min-w-0 flex-1 text-13 leading-[18px] text-ink-3 max-sm:min-h-[54px]">
          <span className="font-semibold text-ink">{section.title}</span>
          <span className="max-sm:hidden"> · {LINES[step]}</span>
          <span className="block sm:hidden">{LINES[step]}</span>
        </p>
        <IconButton
          label={paused ? 'Play the walkthrough' : 'Pause the walkthrough'}
          size="sm"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? <Play /> : <Pause />}
        </IconButton>
      </figcaption>
    </figure>
  )
}

// A figure, or a count of findings: none is good, any are there to review, as in 04 Diagnostics.
function Tile({
  on,
  order,
  label,
  value,
  findings,
  note,
}: {
  on: boolean
  order: number
  label: string
  value?: string
  findings?: number
  /** Caption under a value; defaults to "zero priors" for the D-error figure. */
  note?: string
}) {
  const clear = findings === 0
  return (
    <div
      data-on={on}
      style={stagger(on, order)}
      className={cx('rounded-card bg-surface px-3 py-2.5 shadow-hairline', POP)}
    >
      <p className="truncate text-12 text-ink-3">{label}</p>
      <p
        className={cx(
          "tnum mt-1 font-display text-26 font-medium tracking-stat [font-variation-settings:'opsz'_36]",
          findings === undefined ? 'text-ink' : clear ? 'text-ok' : 'text-caution',
        )}
      >
        {value ?? findings}
      </p>
      <p className="text-12 text-ink-3">
        {findings === undefined ? note ?? 'zero priors' : clear ? 'no findings' : findings === 1 ? 'finding' : 'findings'}
      </p>
    </div>
  )
}
