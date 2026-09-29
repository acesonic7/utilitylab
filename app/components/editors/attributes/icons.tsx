import type { SVGProps } from 'react'
import type { PreferenceDirection } from '@/lib/schema'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const base = (size: number) => ({
  viewBox: '0 0 16 16',
  width: size,
  height: size,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
})

export function ChevronIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  )
}

export function PlusIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}

export function CloseIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </svg>
  )
}

export function TrashIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M2.5 4.5h11M6.5 4.5V3h3v1.5M4 4.5l.7 8.5h6.6l.7-8.5M6.8 7v3.8M9.2 7v3.8" />
    </svg>
  )
}

export function PictureIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <circle cx="5.75" cy="6" r="1.1" />
      <path d="m2.5 12 3.8-3.8 2.7 2.7 1.8-1.8 2.7 2.7" />
    </svg>
  )
}

export function PrefIcon({ dir, size = 16, ...p }: IconProps & { dir: PreferenceDirection }) {
  return (
    <svg {...base(size)} {...p}>
      {dir === 'lower' && <path d="M8 2.5v11M3.5 9 8 13.5 12.5 9" />}
      {dir === 'higher' && <path d="M8 13.5v-11M3.5 7 8 2.5 12.5 7" />}
      {dir === 'none' && <path d="M3.5 8h9" />}
    </svg>
  )
}

export function SepChevron({ size = 10, ...p }: IconProps) {
  return (
    <svg viewBox="0 0 10 10" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true" focusable="false" {...p}>
      <path d="M3.5 2 6.5 5 3.5 8" />
    </svg>
  )
}
