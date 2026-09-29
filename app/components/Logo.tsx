// U-bowl mark: U for utility, the bowl is the D-error surface the design search minimises,
// and the citron dot is the choice resting at the optimum.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      className="shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      {/* Dark keeps a dark tile so the citron dot still reads against it. */}
      <rect
        x="0.5"
        y="0.5"
        width="27"
        height="27"
        rx="6.5"
        strokeWidth="1"
        className="fill-ink stroke-ink dark:fill-surface-3 dark:stroke-line-2"
      />
      <path
        d="M8.5 7.2v7.4a5.5 5.5 0 0 0 11 0V7.2"
        fill="none"
        className="stroke-paper dark:stroke-ink"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="14" cy="16.7" r="2.25" className="fill-accent" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={`font-display text-20 leading-none tracking-[-0.025em] text-ink ${className ?? ''}`}
    >
      <span className="font-bold">Utility</span>
      <span className="font-[380] text-ink-2">Lab</span>
    </span>
  )
}
