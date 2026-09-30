'use client'

import { createContext, useContext } from 'react'
import type { Project } from '@/lib/schema'
import type { ArchivedDesign, NewStudyOptions, StudyMeta } from '@/lib/library'

export type LibraryApi = {
  studies: StudyMeta[]
  unreadable: string[]
  activeId: string
  history: ArchivedDesign[]
  saveError: string | null
  openLibrary: () => void
  /** Back to the landing screen; the open study stays open behind it. */
  goHome: () => void
  /** Opens the new-study dialog. */
  startNew: () => void
  /** Creates and opens a study from the dialog's choices; returns an error message or null. */
  createStudy: (opts: NewStudyOptions) => string | null
  newFromExample: () => void
  open: (id: string) => void
  duplicate: (id: string) => void
  remove: (id: string) => void
  importFile: (file: File) => Promise<string | null>
  download: (id: string) => void
  downloadRaw: (id: string) => void
  restoreDesign: (entry: ArchivedDesign) => void
  forgetDesign: (entry: ArchivedDesign) => void
  current: () => Project
}

export const LibraryContext = createContext<LibraryApi | null>(null)

export function useLibrary(): LibraryApi {
  const api = useContext(LibraryContext)
  if (!api) throw new Error('useLibrary must be used inside the library provider')
  return api
}
