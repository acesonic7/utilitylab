type IconProps = React.SVGProps<SVGSVGElement> & { size?: number }

const base = (size: number) => ({
  viewBox: '0 0 24 24',
  width: size,
  height: size,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
})

export function ChevronRight({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export function ChevronDown({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function ChevronUp({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <polyline points="6 15 12 9 18 15" />
    </svg>
  )
}

export function XMark({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  )
}

export function Plus({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function Upload({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

export function Download({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export function Trash({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

export function Refresh({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

export function Check({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function Info({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

export function ChevronLeft({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

export function Copy({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </svg>
  )
}

export function Eye({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M2 12s3.75-6.75 10-6.75S22 12 22 12s-3.75 6.75-10 6.75S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function ArrowDown({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <line x1="12" y1="4" x2="12" y2="20" />
      <polyline points="5 13 12 20 19 13" />
    </svg>
  )
}

export function ArrowUp({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <line x1="12" y1="20" x2="12" y2="4" />
      <polyline points="5 11 12 4 19 11" />
    </svg>
  )
}

export function Sun({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

export function Moon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function Monitor({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}


export function Folder({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}

export function Pause({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <line x1="9" y1="5" x2="9" y2="19" />
      <line x1="15" y1="5" x2="15" y2="19" />
    </svg>
  )
}

export function Play({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <polygon points="7 4 20 12 7 20 7 4" />
    </svg>
  )
}
