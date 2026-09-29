import { cx } from './cx'

export type GaugeBand = { to: number; tone: 'risk' | 'caution' | 'ok' }

export type GaugeProps = {
  value: number
  min: number
  max: number
  bands: GaugeBand[]
  ariaLabel: string
  /** Print min, band edges and max under the track. */
  ticks?: boolean
  className?: string
}

const TONE: Record<GaugeBand['tone'], string> = {
  risk: 'bg-risk/20',
  caution: 'bg-caution/25',
  ok: 'bg-ok/20',
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export function Gauge({ value, min, max, bands, ariaLabel, ticks, className }: GaugeProps) {
  const span = max - min || 1
  const pct = (n: number) => Math.min(100, Math.max(0, ((n - min) / span) * 100))
  const edges = bands.map((b) => Math.min(b.to, max))
  return (
    <div className={cx('w-full', className)}>
      <div
        role="meter"
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.min(max, Math.max(min, value))}
        className="relative mt-2 h-1.5 rounded-bar bg-surface"
      >
        {bands.map((b, i) => {
          const from = pct(i === 0 ? min : edges[i - 1])
          return (
            <span
              key={i}
              aria-hidden="true"
              className={cx('absolute inset-y-0', TONE[b.tone], i === 0 && 'rounded-l-bar', i === bands.length - 1 && 'rounded-r-bar')}
              style={{ left: `${from}%`, width: `${pct(edges[i]) - from}%` }}
            />
          )
        })}
        {edges.slice(0, -1).map((e, i) => (
          <span
            key={`e${i}`}
            aria-hidden="true"
            className="absolute -bottom-[3px] -top-[3px] w-px bg-line-2"
            style={{ left: `${pct(e)}%` }}
          />
        ))}
        <span
          aria-hidden="true"
          className="absolute -top-1 h-3.5 w-[3px] -translate-x-1/2 rounded-bar bg-ink"
          style={{ left: `${pct(value)}%` }}
        />
      </div>
      {ticks && (
        <div aria-hidden="true" className="relative mt-1.5 h-4 font-mono text-12 text-ink-3">
          {[min, ...edges.slice(0, -1), max].map((t, i, all) => (
            <span
              key={i}
              className={cx(
                'absolute',
                i === 0 ? '' : i === all.length - 1 ? '-translate-x-full' : '-translate-x-1/2',
              )}
              style={{ left: `${pct(t)}%` }}
            >
              {fmt(t)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
