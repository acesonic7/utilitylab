import type { AltIdentity } from '@/lib/altIdentity'
import { AltGlyph } from './AltGlyph'
import { cx } from './cx'

export function AltLabel({
  identity,
  size = 'md',
  className,
}: {
  identity: AltIdentity
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex min-w-0 items-center font-medium text-ink',
        size === 'sm' ? 'gap-1.5 text-13' : 'gap-2 text-14',
        className,
      )}
    >
      <AltGlyph identity={identity} size={size === 'sm' ? 10 : 12} />
      <span className="truncate">{identity.label}</span>
    </span>
  )
}
