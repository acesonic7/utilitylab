import { SeverityPips, cx } from '../ui'
import type { SectionMarker } from './useSectionStatus'

export function StatusMarker({ marker }: { marker: SectionMarker | null }) {
  if (!marker) return null
  if (marker.kind === 'done') {
    return (
      <span className="inline-flex text-ok">
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="size-3.5 fill-none stroke-current"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
        <span className="sr-only">{marker.label}</span>
      </span>
    )
  }
  // Pips as well as hue: three lit bars for concerns, two for warnings.
  return (
    <span
      className={cx(
        'tnum inline-flex h-[18px] min-w-[18px] items-center justify-center gap-1 rounded-pill pl-1 pr-1.5 text-12 font-semibold leading-none',
        marker.tone === 'risk' ? 'bg-risk-bg text-risk' : 'bg-caution-bg text-caution',
      )}
    >
      <span aria-hidden="true" className="inline-flex">
        <SeverityPips severity={marker.tone === 'risk' ? 'concern' : 'warning'} />
      </span>
      <span aria-hidden="true">{marker.count}</span>
      <span className="sr-only">{marker.label}</span>
    </span>
  )
}

export function HereDot() {
  return (
    <span
      aria-hidden="true"
      className="size-[7px] shrink-0 rounded-full bg-accent shadow-[0_0_0_1px_rgb(var(--accent-edge))]"
    />
  )
}
