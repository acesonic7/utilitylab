'use client'

import { Component, type ReactNode } from 'react'
import { LibraryContext, type LibraryApi } from './library/LibraryContext'
import { Button } from './ui'

type Props = { studyId: string; studyName: string; children: ReactNode }
type State = { error: Error | null }

/**
 * Keeps a study that fails to render from taking the whole app down. Without it a broken study
 * stayed the active one, so every reload crashed again and no other study could be reached.
 * Remount it per study (key it by id) so switching studies clears the error.
 */
export class StudyErrorBoundary extends Component<Props, State> {
  static contextType = LibraryContext
  declare context: LibraryApi | null
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('UtilityLab could not display this study:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    const lib = this.context
    const { studyId, studyName } = this.props
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <div role="alert" className="rounded-card border border-risk/30 bg-risk-bg px-5 py-4">
          <h1 className="text-16 font-semibold text-risk">This study can’t be displayed</h1>
          <p className="mt-2 text-14 text-ink-2">
            “{studyName || 'Untitled study'}” contains something UtilityLab can’t show, so it stopped here instead of
            breaking the whole app. Your other studies are unaffected. Download this study’s data to keep it, then
            open another study.
          </p>
          <p className="mt-2 break-words font-mono text-12 text-ink-3">{this.state.error.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => lib?.downloadRaw(studyId)}>Download this study’s data</Button>
            <Button variant="secondary" onClick={() => lib?.openLibrary()}>
              Open another study
            </Button>
            <Button variant="ghost" onClick={() => lib?.goHome()}>
              Back to the start
            </Button>
          </div>
        </div>
      </main>
    )
  }
}
