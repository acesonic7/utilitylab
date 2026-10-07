import type { ReactNode } from 'react'
import Link from 'next/link'
import { Logo, Wordmark } from '../Logo'

export const LAST_UPDATED = '7 October 2026'

export function LegalPage({
  title,
  lede,
  updated,
  children,
}: {
  title: string
  lede: ReactNode
  updated?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-paper/85">
        <div className="mx-auto flex h-14 max-w-[760px] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-ctl">
            <Logo size={26} />
            <Wordmark />
          </Link>
          <Link
            href="/"
            className="focus-ring rounded-ctl px-2 py-1 text-13 font-medium text-ink-2 underline decoration-line-2 underline-offset-[3px] hover:text-ink"
          >
            Back to the app
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[760px] px-4 pb-24 pt-10 sm:px-6">
        <h1 className="font-display text-34 font-semibold tracking-display text-ink sm:text-42">{title}</h1>
        <p className="mt-3 text-16 leading-[26px] text-ink-2">{lede}</p>
        <p className="mt-2 text-12 text-ink-3">Last updated {updated ?? LAST_UPDATED}</p>
        <div className="legal mt-8 space-y-8 text-14 leading-[22px] text-ink-2">{children}</div>
        <nav aria-label="About UtilityLab" className="mt-14 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5 text-13 text-ink-3">
          <Link href="/methods" className="focus-ring rounded-tick underline decoration-line-2 underline-offset-[3px] hover:text-ink">
            Methods
          </Link>
          <Link href="/privacy" className="focus-ring rounded-tick underline decoration-line-2 underline-offset-[3px] hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="focus-ring rounded-tick underline decoration-line-2 underline-offset-[3px] hover:text-ink">
            Terms and disclaimer
          </Link>
          <a
            href="https://github.com/acesonic7/utilitylab"
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring rounded-tick underline decoration-line-2 underline-offset-[3px] hover:text-ink"
          >
            Source code<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </nav>
      </main>
    </div>
  )
}

const anchor = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section id={anchor(title)} className="scroll-mt-6 space-y-3">
      <h2 className="font-display text-20 font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="focus-ring rounded-tick text-ink underline decoration-line-2 underline-offset-[3px] hover:decoration-ink-3"
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

export const listClass = 'list-disc space-y-1.5 pl-5 marker:text-ink-4'
