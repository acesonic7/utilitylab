'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Project } from '@/lib/schema'
import { Button, Checkbox, Field, IconButton, Input, NumberInput, Seg, Textarea, cx } from '../ui'
import { Plus, Trash, Upload, XMark } from '../Icons'
import { useWorkspaceActions } from '../Workspace'
import { useLibrary } from './LibraryContext'

type ExperimentType = Project['experimentType']

const TYPE_HINT: Record<ExperimentType, string> = {
  unlabeled:
    'Generic alternatives (Alternative A, B, …) that differ only in their attribute levels, as in most route or product choices.',
  labeled:
    'Named alternatives, such as Car, Bus and Bike, each with its own constant. Attributes can apply to some of them only.',
}

const LABEL_EXAMPLES = ['Car', 'Public transport', 'Bike', 'Walking', 'Taxi', 'Scooter']

type Errors = { name?: string; alternatives?: string }

/** Step 0: name the study and set up its choice set, then land in 01 Structure. */
export function NewStudyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lib = useLibrary()
  const { goTo } = useWorkspaceActions()
  const ref = useRef<HTMLDialogElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ExperimentType>('unlabeled')
  const [count, setCount] = useState(2)
  const [labels, setLabels] = useState<string[]>(['', ''])
  const [optOut, setOptOut] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setName('')
      setDescription('')
      setType('unlabeled')
      setCount(2)
      setLabels(['', ''])
      setOptOut(false)
      setErrors({})
      setMessage(null)
      d.showModal()
      nameRef.current?.focus()
    } else if (!open && d.open) d.close()
  }, [open])

  const switchType = (t: ExperimentType) => {
    if (t === type) return
    if (t === 'labeled') setLabels((l) => Array.from({ length: Math.max(count, 2) }, (_, i) => l[i] ?? ''))
    else setCount(Math.max(2, labels.filter((l) => l.trim()).length))
    setType(t)
    setErrors((e) => ({ ...e, alternatives: undefined }))
  }

  const setLabel = (i: number, v: string) => {
    setLabels((l) => l.map((x, j) => (j === i ? v : x)))
    setErrors((e) => ({ ...e, alternatives: undefined }))
  }

  const validate = (): Errors => {
    const e: Errors = {}
    if (!name.trim()) e.name = 'Enter a name for the study.'
    if (type === 'labeled') {
      const named = labels.map((l) => l.trim().toLowerCase()).filter(Boolean)
      if (named.length < 2) e.alternatives = 'Name at least two alternatives.'
      else if (new Set(named).size < named.length) e.alternatives = 'Give each alternative its own name.'
    }
    return e
  }

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (e.name) return nameRef.current?.focus()
    if (e.alternatives) return
    const err = lib.createStudy({
      name,
      description,
      experimentType: type,
      alternatives: type === 'labeled' ? labels.filter((l) => l.trim()) : count,
      optOut,
    })
    if (err) return setMessage(err)
    goTo('structure')
  }

  const importFile = async (file: File | undefined) => {
    if (!file) return
    const err = await lib.importFile(file)
    if (err) setMessage(err)
    else onClose()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="new-study-title"
      onClose={onClose}
      className="w-[min(600px,calc(100vw-32px))] rounded-hero border border-line bg-surface p-0 text-ink shadow-raised backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
    >
      <form onSubmit={submit} noValidate>
        <div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-7">
          <div>
            <h2 id="new-study-title" className="font-display text-26 font-semibold tracking-title">
              New study
            </h2>
            <p className="mt-1.5 max-w-[52ch] text-13 text-ink-3">
              Name the study and set up its choice set. Attributes and levels come next, in 01
              Structure, and you can change all of this there later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close new study"
            className="focus-ring -mr-2 -mt-1 rounded-ctl p-2 text-ink-3 hover:bg-surface-3 hover:text-ink"
          >
            <XMark size={16} />
          </button>
        </div>

        <div className="mt-5 space-y-5 px-6 sm:px-8">
          <Field label="Name" error={errors.name}>
            {(id, describedBy) => (
              <Input
                ref={nameRef}
                id={id}
                size="lg"
                aria-describedby={describedBy}
                aria-required="true"
                aria-invalid={errors.name ? true : undefined}
                value={name}
                placeholder="e.g. Athens, Greece mode choice experiment"
                onChange={(e) => {
                  setName(e.target.value)
                  if (errors.name) setErrors((x) => ({ ...x, name: undefined }))
                }}
              />
            )}
          </Field>

          <Field label="Description" optional>
            {(id, describedBy) => (
              <Textarea
                id={id}
                rows={2}
                aria-describedby={describedBy}
                value={description}
                placeholder="The choice respondents face and what the study asks"
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>

          <div>
            <p className="text-12 font-medium text-ink-2">
              Experiment type
            </p>
            <Seg
              className="mt-1.5"
              ariaLabel="Experiment type"
              value={type}
              onChange={switchType}
              options={[
                { value: 'unlabeled', label: 'Unlabeled' },
                { value: 'labeled', label: 'Labeled' },
              ]}
            />
            <p className="mt-1.5 text-12 text-ink-3">{TYPE_HINT[type]}</p>
          </div>

          {type === 'unlabeled' ? (
            <Field label="Alternatives in each choice task" hint="Between 2 and 6. You can add more later.">
              {(id, describedBy) => (
                <NumberInput
                  id={id}
                  aria-describedby={describedBy}
                  className="max-w-[96px]"
                  integer
                  min={2}
                  max={6}
                  emptyBehavior={2}
                  value={count}
                  onValueChange={setCount}
                />
              )}
            </Field>
          ) : (
            <fieldset>
              <legend className="text-12 font-medium text-ink-2">Alternatives</legend>
              <ul className="mt-1.5 space-y-2">
                {labels.map((l, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Input
                      aria-label={`Alternative ${i + 1}`}
                      aria-invalid={errors.alternatives && !l.trim() ? true : undefined}
                      value={l}
                      placeholder={LABEL_EXAMPLES[i] ? `e.g. ${LABEL_EXAMPLES[i]}` : 'Alternative name'}
                      onChange={(e) => setLabel(i, e.target.value)}
                    />
                    <IconButton
                      label={`Remove alternative ${i + 1}`}
                      size="md"
                      disabled={labels.length <= 2}
                      onClick={() => setLabels((x) => x.filter((_, j) => j !== i))}
                    >
                      <Trash />
                    </IconButton>
                  </li>
                ))}
              </ul>
              {errors.alternatives && (
                <p role="alert" className="mt-1.5 text-12 font-medium text-risk">
                  {errors.alternatives}
                </p>
              )}
              {labels.length < 8 && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Plus />}
                  className="mt-2"
                  onClick={() => setLabels((x) => [...x, ''])}
                >
                  Add alternative
                </Button>
              )}
            </fieldset>
          )}

          <div>
            <Checkbox
              checked={optOut}
              onChange={setOptOut}
              label={<>Add an opt-out (“None of these”)</>}
            />
            <p className="ml-6 mt-1 text-12 text-ink-3">
              A no-choice or status quo alternative shown in every choice task.
            </p>
          </div>
        </div>

        <p role="status" className={cx('px-6 text-13 sm:px-8', message ? 'mt-4 text-risk' : 'sr-only')}>
          {message ?? ''}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line px-6 py-4 sm:flex-row sm:items-center sm:px-8">
          <div className="flex flex-wrap gap-x-1 gap-y-1 sm:mr-auto">
            <Button variant="ghost" size="sm" onClick={lib.newFromExample}>
              Start from the example
            </Button>
            <Button variant="ghost" size="sm" icon={<Upload />} onClick={() => fileRef.current?.click()}>
              Open project file…
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                void importFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create study
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
