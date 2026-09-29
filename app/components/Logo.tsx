// Matrix U: a U drawn in the cells of a 3×3 design matrix, with one cell chosen in citron.
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
      {/* Dark keeps a dark tile so the citron cell still reads against it. */}
      <rect
        x="0.5"
        y="0.5"
        width="27"
        height="27"
        rx="6.5"
        strokeWidth="1"
        className="fill-ink stroke-ink dark:fill-surface-3 dark:stroke-line-2"
      />
      <rect x="5.0" y="5.0" width="5" height="5" rx="1.3" className="fill-paper dark:fill-ink" />
      <rect x="5.0" y="11.5" width="5" height="5" rx="1.3" className="fill-paper dark:fill-ink" />
      <rect x="11.5" y="18.0" width="5" height="5" rx="1.3" className="fill-paper dark:fill-ink" />
      <rect x="18.0" y="5.0" width="5" height="5" rx="1.3" className="fill-paper dark:fill-ink" />
      <rect x="18.0" y="11.5" width="5" height="5" rx="1.3" className="fill-paper dark:fill-ink" />
      <rect x="18.0" y="18.0" width="5" height="5" rx="1.3" className="fill-paper dark:fill-ink" />
      <rect x="5.0" y="18.0" width="5" height="5" rx="1.3" className="fill-accent" />
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
