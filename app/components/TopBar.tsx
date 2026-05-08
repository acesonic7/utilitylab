import { Logo } from './Logo'

export default function TopBar() {
  return (
    <header className="sticky top-0 z-10 bg-white/75 backdrop-blur border-b border-neutral-200/80">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-neutral-900">
          <Logo size={20} />
          <span className="font-semibold tracking-tight text-[15px]">UtilityLab</span>
        </div>
        <span className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          Stated-preference designer
        </span>
      </div>
    </header>
  )
}
