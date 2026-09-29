import { cx } from './cx'

export type Severity = 'warning' | 'concern' | 'ok'

const WORD: Record<Severity, string> = { warning: 'Warning', concern: 'Concern', ok: 'Passed' }
const BARS = ['h-[5px]', 'h-2', 'h-3']

export function SeverityPips({ severity, label, className }: { severity: Severity; label?: boolean; className?: string }) {
  const word = WORD[severity]
  const tone = severity === 'concern' ? 'text-risk' : severity === 'warning' ? 'text-caution' : 'text-ok'
  const lit = severity === 'concern' ? 3 : 2
  return (
    <span className={cx('inline-flex items-center gap-2', tone, className)}>
      {severity === 'ok' ? (
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
      ) : (
        <span aria-hidden="true" className="inline-flex h-3 items-end gap-0.5">
          {BARS.map((h, i) => (
            <span key={h} className={cx('w-[3px] rounded-[1px]', h, i < lit ? 'bg-current' : 'bg-line-2')} />
          ))}
        </span>
      )}
      <span className={label ? 'text-12 font-semibold leading-none tracking-[0.02em]' : 'sr-only'}>{word}</span>
    </span>
  )
}
