import type { SVGProps } from 'react'

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

export function ImageIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <circle cx="5.75" cy="6" r="1.1" />
      <path d="m2.5 12 3.8-3.8 2.7 2.7 1.8-1.8 2.7 2.7" />
    </svg>
  )
}

export function HollowCircle({ size = 12, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="8" cy="8" r="5.5" />
    </svg>
  )
}

export function MoreIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} fill="currentColor" stroke="none" {...p}>
      <circle cx="3.5" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="12.5" cy="8" r="1.3" />
    </svg>
  )
}
