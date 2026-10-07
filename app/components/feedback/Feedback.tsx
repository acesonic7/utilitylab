'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { describeBrowser, feedbackUrl, MAX_MESSAGE, type FeedbackKind } from '@/lib/feedback'
import { APP_VERSION } from '../shell/Rail'
import { Button, Checkbox, Field, Input, Seg, Textarea, cx } from '../ui'
import { XMark } from '../Icons'

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: 'bug', label: 'Something’s wrong' },
  { value: 'idea', label: 'An idea' },
  { value: 'question', label: 'A question' },
]

const PLACEHOLDER: Record<FeedbackKind, { title: string; message: string }> = {
  bug: {
    title: 'e.g. QSF import shows every block',
    message: 'What did you do, what did you expect, and what happened instead?',
  },
  idea: {
    title: 'e.g. Presets for travel time and cost',
    message: 'What are you trying to do, and where does UtilityLab fall short?',
  },
  question: { title: 'e.g. How should I set priors for cost?', message: 'Your question' },
}

function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const uid = useId()
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [withContext, setWithContext] = useState(true)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])

  const send = () => {
    const url = feedbackUrl({
      kind,
      title,
      message,
      context: withContext ? { version: APP_VERSION, browser: describeBrowser(navigator.userAgent) } : undefined,
    })
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${uid}-title`}
      onClose={onClose}
      className="w-[min(560px,calc(100vw-32px))] rounded-hero border border-line bg-surface p-0 text-ink shadow-raised backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-7">
          <div>
            <h2 id={`${uid}-title`} className="font-display text-26 font-semibold tracking-title">
              Send feedback
            </h2>
            <p className="mt-1.5 text-13 text-ink-3">
              Bugs, ideas and questions all help, especially from people running stated choice experiments.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close feedback"
            className="focus-ring -mr-2 -mt-1 rounded-ctl p-2 text-ink-3 hover:bg-surface-3 hover:text-ink"
          >
            <XMark size={16} />
          </button>
        </div>

        <div className="mt-5 space-y-4 px-6 sm:px-7">
          <Seg ariaLabel="Kind of feedback" options={KINDS} value={kind} onChange={setKind} className="max-w-full flex-wrap" />
          <Field label="Title">
            {(fid) => (
              <Input id={fid} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={PLACEHOLDER[kind].title} required />
            )}
          </Field>
          <Field label="Details" optional hint={`Up to ${MAX_MESSAGE.toLocaleString('en')} characters; you can add more on GitHub.`}>
            {(fid, describedBy) => (
              <Textarea
                id={fid}
                aria-describedby={describedBy}
                rows={5}
                value={message}
                maxLength={MAX_MESSAGE}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={PLACEHOLDER[kind].message}
              />
            )}
          </Field>
          <Checkbox
            checked={withContext}
            onChange={setWithContext}
            label={`Include the app version (v${APP_VERSION}) and your browser`}
          />
        </div>

        <div className="mt-5 border-t border-line px-6 py-4 sm:px-7">
          <p className="text-12 text-ink-3">
            This opens GitHub in a new tab with your feedback filled in; nothing is sent until you submit it there, and you
            need a free GitHub account. GitHub issues are public, so leave out anything confidential about your study. If a
            study file would help with a bug, attach it on GitHub after removing anything sensitive.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()} className="enabled:border-ink">
              Continue on GitHub
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  )
}

// A button that opens its own feedback dialog. `look` matches where it sits.
export function FeedbackButton({ look = 'link', className }: { look?: 'link' | 'button'; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {look === 'button' ? (
        <Button variant="ghost" size="md" onClick={() => setOpen(true)} aria-haspopup="dialog" className={className}>
          Feedback
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={cx(
            'focus-ring whitespace-nowrap rounded-tick underline decoration-line-2 underline-offset-[3px] transition-colors hover:text-ink hover:decoration-ink-3',
            className,
          )}
        >
          Feedback
        </button>
      )}
      <FeedbackDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
