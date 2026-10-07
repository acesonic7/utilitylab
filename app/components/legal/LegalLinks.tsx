import Link from 'next/link'
import { cx } from '../ui'

const link =
  'focus-ring whitespace-nowrap rounded-tick underline decoration-line-2 underline-offset-[3px] transition-colors hover:text-ink hover:decoration-ink-3'

export function LegalLinks({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-3', className)}>
      <Link href="/methods" className={link}>
        Methods
      </Link>
      <Link href="/privacy" className={link}>
        Privacy
      </Link>
      <Link href="/terms" className={link}>
        Terms
      </Link>
    </span>
  )
}
