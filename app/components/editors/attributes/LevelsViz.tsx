'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Attribute, Level } from '@/lib/schema'
import { cx } from '../../ui'
import { SepChevron } from './icons'
import { chipText, isOrdered, numberLineModel, type NumberLineModel } from './model'

const H = 34
const PAD = 8
const AXIS_Y = 11
const LABEL_Y = 30
const FONT = 12
const CHAR_W = 7.2
const LABEL_GAP = 8

type Placed = {
  x: number
  text: string
  refMark: boolean
  suffix: string
  anchor: 'start' | 'middle' | 'end'
  from: number
  to: number
}

function layout(model: NumberLineModel, width: number) {
  const { values, ref, label, suffix } = model
  const domain = ref === null ? values : [...values, ref]
  const lo = Math.min(...domain)
  const hi = Math.max(...domain)
  const x0 = PAD
  const x1 = width - PAD
  const xOf = (v: number) => (hi === lo ? (x0 + x1) / 2 : x0 + ((v - lo) / (hi - lo)) * (x1 - x0))

  const unique = Array.from(new Set(values)).sort((a, b) => a - b)
  const lastValue = unique[unique.length - 1]
  const cands: Omit<Placed, 'anchor' | 'from' | 'to'>[] = unique.map((v) => ({
    x: xOf(v),
    text: label(v),
    refMark: ref !== null && v === ref,
    suffix: v === lastValue ? suffix : '',
  }))
  if (ref !== null && !unique.includes(ref)) cands.push({ x: xOf(ref), text: 'REF', refMark: false, suffix: '' })
  cands.sort((a, b) => a.x - b.x)

  const placed: Placed[] = cands.map((c, i) => {
    const anchor: Placed['anchor'] =
      cands.length === 1 || hi === lo ? 'middle' : i === 0 ? 'start' : i === cands.length - 1 ? 'end' : 'middle'
    const extra = (c.refMark ? 4 : 0) + (c.suffix ? c.suffix.length + 0.6 : 0)
    const w = (c.text.length + extra) * CHAR_W
    const from = anchor === 'start' ? c.x : anchor === 'end' ? c.x - w : c.x - w / 2
    return { ...c, anchor, from, to: from + w }
  })

  // Ends always keep their labels; a middle label is dropped when it would collide.
  const shown: Placed[] = []
  const last = placed[placed.length - 1]
  placed.forEach((p, i) => {
    if (i === 0 || i === placed.length - 1) {
      shown.push(p)
      return
    }
    const prev = shown[shown.length - 1]
    if (p.from >= prev.to + LABEL_GAP && p.to <= last.from - LABEL_GAP) shown.push(p)
  })

  return { dots: unique.map(xOf), refX: ref === null ? null : xOf(ref), labels: shown }
}

function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = Math.round(el.clientWidth)
      if (w > 0) setWidth(w)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export function NumberLine({ model, className }: { model: NumberLineModel; className?: string }) {
  const [ref, width] = useWidth(236)
  const { dots, refX, labels } = useMemo(() => layout(model, width), [model, width])
  return (
    <div ref={ref} className={cx('w-full max-w-[300px]', className)}>
      <svg
        role="img"
        aria-label={model.description}
        width={width}
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        overflow="visible"
        className="block font-mono"
      >
        <title>{model.description}</title>
        <line x1={PAD} y1={AXIS_Y} x2={width - PAD} y2={AXIS_Y} className="stroke-line-2" strokeWidth={1.5} />
        {refX !== null && (
          <line x1={refX} y1={1} x2={refX} y2={21} className="stroke-ink-3" strokeWidth={1} strokeDasharray="2 2" />
        )}
        {dots.map((x, i) => (
          <circle key={i} cx={x} cy={AXIS_Y} r={4} className="fill-ink" />
        ))}
        {labels.map((l, i) => (
          <text key={i} x={l.x} y={LABEL_Y} textAnchor={l.anchor} fontSize={FONT} className="fill-ink-2">
            {l.text}
            {l.refMark && (
              <tspan dx={4} className="fill-ink-3">
                REF
              </tspan>
            )}
            {l.suffix && (
              <tspan dx={4} className="fill-ink-3">
                {l.suffix}
              </tspan>
            )}
          </text>
        ))}
      </svg>
    </div>
  )
}

const chip = 'inline-block h-[22px] max-w-[160px] truncate rounded-pill border px-2 text-12 leading-5'

export function LevelChips({ attribute, levels }: { attribute: Attribute; levels: Level[] }) {
  const texts = levels.map((l) => chipText(attribute, l))
  if (texts.length === 0) return <span className="text-13 text-ink-3">No levels</span>
  if (isOrdered(attribute)) {
    const last = texts.length - 1
    return (
      <ol
        aria-label={`Levels in order: ${texts.join(', ')}`}
        className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1"
      >
        {texts.map((t, i) => (
          <li key={levels[i].id} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <SepChevron className="shrink-0 text-ink-4" />}
            <span
              title={t}
              className={cx(
                chip,
                i === last && last > 0
                  ? 'border-ink bg-ink text-surface'
                  : i === 0
                    ? 'border-line-2 text-ink-2'
                    : 'border-line-2 bg-surface-3 text-ink-2',
              )}
            >
              {t}
            </span>
          </li>
        ))}
      </ol>
    )
  }
  return (
    <ul aria-label={`Levels: ${texts.join(', ')}`} className="flex min-w-0 flex-wrap items-center gap-1.5">
      {texts.map((t, i) => (
        <li key={levels[i].id} className="min-w-0">
          <span title={t} className={cx(chip, 'border-line-2 text-ink-2')}>
            {t}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function LevelsViz({ attribute, levels, className }: { attribute: Attribute; levels: Level[]; className?: string }) {
  const model = useMemo(
    () => (attribute.type === 'numeric' ? numberLineModel(attribute, levels) : null),
    [attribute, levels],
  )
  if (model) return <NumberLine model={model} className={className} />
  return (
    <div className={className}>
      <LevelChips attribute={attribute} levels={levels} />
    </div>
  )
}
