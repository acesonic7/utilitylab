const common = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
}

export function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg {...common} strokeWidth={1.8} className={className}>
      <path d="M10 3.5 5.5 8l4.5 4.5" />
    </svg>
  )
}

export function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg {...common} strokeWidth={1.8} className={className}>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  )
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg {...common} strokeWidth={2.2} className={className}>
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  )
}
