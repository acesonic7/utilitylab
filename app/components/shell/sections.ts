import type { MouseEvent } from 'react'
import type { SectionId } from '../Workspace'

export type SectionMeta = { id: SectionId; index: string; title: string }

export const SECTIONS: SectionMeta[] = [
  { id: 'structure', index: '01', title: 'Structure' },
  { id: 'design', index: '02', title: 'Design' },
  { id: 'choice-tasks', index: '03', title: 'Choice tasks' },
  { id: 'diagnostics', index: '04', title: 'Diagnostics' },
  { id: 'export', index: '05', title: 'Export' },
]

export const SECTION_IDS: SectionId[] = SECTIONS.map((s) => s.id)

// Scroll margin clears the sticky chrome: 56px top bar, plus the 44px section strip below lg.
export const sectionClass =
  'mt-14 scroll-mt-[120px] lg:mt-[72px] lg:scroll-mt-20 [&_h2:focus]:outline-none'

// Plain clicks scroll in place; modified clicks keep the browser's own link behaviour.
export function onSectionLinkClick(e: MouseEvent<HTMLAnchorElement>, go: () => void): void {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  go()
}
