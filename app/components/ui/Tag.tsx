import type { HTMLAttributes } from 'react'
import { cx } from './cx'

export type TagTone = 'neutral' | 'muted' | 'ink' | 'risk' | 'caution' | 'ok'

export type TagProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: TagTone
  mono?: boolean
}

const tones: Record<TagTone, string> = {
  neutral: 'border-line-2 bg-surface text-ink-2',
  muted: 'border-transparent bg-surface-3 text-ink-2',
  ink: 'border-ink bg-ink text-paper',
  risk: 'border-transparent bg-risk-bg text-risk',
  caution: 'border-transparent bg-caution-bg text-caution',
  ok: 'border-transparent bg-ok-bg text-ok',
}

const SIGNAL: TagTone[] = ['risk', 'caution', 'ok']

export function Tag({ tone = 'neutral', mono, className, ...rest }: TagProps) {
  // Fragment Mono ships one weight, so mono tags stay at 400.
  const weight = mono ? 'font-mono font-normal' : SIGNAL.includes(tone) ? 'font-semibold' : 'font-medium'
  return (
    <span
      className={cx(
        'inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border px-2 text-12 leading-none',
        weight,
        tones[tone],
        className,
      )}
      {...rest}
    />
  )
}
