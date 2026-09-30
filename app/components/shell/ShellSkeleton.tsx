import { cx } from '../ui'
import { BrandCell } from '../TopBar'
import { canvasClass, contentClass } from './AppShell'

function Bar({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx('block rounded-ctl bg-surface-3 motion-safe:animate-pulse', className)} />
}

// Quiet placeholder with the shell's geometry, so nothing jumps when the project loads.
// A first visit opens on the landing screen instead, so the head script keeps this out of sight.
export function ShellSkeleton() {
  return (
    <div className="min-h-screen [[data-first-visit]_&]:invisible" aria-busy="true">
      <p role="status" className="sr-only">
        Loading your stated choice experiment…
      </p>
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-line bg-paper/85">
        <BrandCell />
        <Bar className="ml-4 h-3.5 w-40 lg:ml-0" />
      </header>
      <div className="h-11 border-b border-line lg:hidden" />
      <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
        <div className="sticky top-14 hidden h-[calc(100vh-56px)] flex-col gap-2 border-r border-line px-3.5 pt-[22px] lg:flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="px-2 py-[9px]">
              <Bar className="h-3.5 w-28" />
              <Bar className="ml-8 mt-2 h-2.5 w-32" />
            </div>
          ))}
          <Bar className="mt-5 h-44 w-full rounded-panel" />
        </div>
        <div className={canvasClass}>
          <div className={contentClass}>
            <Bar className="h-[22px] w-64" />
            <Bar className="mt-5 h-10 w-full max-w-xl" />
            <Bar className="mt-4 h-4 w-full max-w-lg" />
            <Bar className="mt-[26px] h-11 w-full" />
            <div className="mt-[26px] flex flex-wrap gap-[30px]">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <Bar className="h-9 w-12" />
                  <Bar className="mt-2 h-3 w-20" />
                </div>
              ))}
            </div>
            <Bar className="mt-[72px] h-8 w-48" />
            <Bar className="mt-6 h-48 w-full rounded-panel" />
          </div>
        </div>
      </div>
    </div>
  )
}
