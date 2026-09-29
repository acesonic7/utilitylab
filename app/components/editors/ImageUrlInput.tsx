'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Button, IconButton, Input, cx } from '../ui'
import { XMark } from '../Icons'
import { ImageIcon } from './structure/icons'

// Compact image URL field with a thumbnail preview, used for attribute, alternative and
// level images. It stays collapsed behind an "Add image" trigger until an image is set.

export default function ImageUrlInput({
  value,
  onChange,
  size = 24,
  placeholder = 'https://… (png, jpg, svg)',
  name,
  id,
  compact,
  className,
}: {
  value: string | undefined
  onChange: (next: string | undefined) => void
  size?: number
  placeholder?: string
  /** What the image belongs to, for accessible names ("Image URL for Car"). */
  name?: string
  /** Lands on the URL input when open, otherwise on the trigger, so a label's htmlFor works. */
  id?: string
  /** Icon-only trigger. */
  compact?: boolean
  /** Classes for the open row. */
  className?: string
}) {
  const has = !!value && value.trim() !== ''
  const [open, setOpen] = useState(has)
  const [broken, setBroken] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const focusNext = useRef<'input' | 'trigger' | null>(null)
  const statusId = useId()
  const expanded = open || has
  const suffix = name ? ` for ${name}` : ''

  useEffect(() => {
    setBroken(false)
  }, [value])

  // A value set from outside (e.g. an import) keeps the row open while it is being edited.
  useEffect(() => {
    if (has) setOpen(true)
  }, [has])

  useEffect(() => {
    if (focusNext.current === 'input') inputRef.current?.focus()
    else if (focusNext.current === 'trigger') triggerRef.current?.focus()
    focusNext.current = null
  }, [expanded])

  const show = () => {
    focusNext.current = 'input'
    setOpen(true)
  }

  if (!expanded) {
    return compact ? (
      <IconButton ref={triggerRef} id={id} size="sm" label={`Add image${suffix}`} onClick={show}>
        <ImageIcon />
      </IconButton>
    ) : (
      <Button
        ref={triggerRef}
        id={id}
        variant="ghost"
        size="sm"
        icon={<ImageIcon />}
        onClick={show}
        aria-label={name ? `Add image${suffix}` : undefined}
        title="Add an image"
      >
        Add image
      </Button>
    )
  }

  return (
    <div className={cx('flex min-w-0 items-center gap-1.5', className)}>
      {has && !broken ? (
        <img
          src={value}
          alt=""
          width={size}
          height={size}
          onError={() => setBroken(true)}
          className="shrink-0 rounded-bar object-cover shadow-hairline"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cx(
            'flex shrink-0 items-center justify-center rounded-bar border text-12 leading-none',
            broken ? 'border-risk bg-risk-bg text-risk' : 'border-line-2 bg-surface-2 text-ink-3',
          )}
          style={{ width: size, height: size }}
          title={broken ? 'Image failed to load' : 'No image set'}
        >
          {broken ? '!' : '∅'}
        </span>
      )}
      <Input
        ref={inputRef}
        id={id}
        type="url"
        size="sm"
        value={value ?? ''}
        placeholder={placeholder}
        aria-label={`Image URL${suffix}`}
        aria-invalid={broken || undefined}
        aria-describedby={broken ? statusId : undefined}
        onChange={(e) => {
          const v = e.target.value
          setBroken(false)
          onChange(v.trim() === '' ? undefined : v)
        }}
        className="min-w-0 flex-[1_1_10rem]"
      />
      {broken && (
        <span id={statusId} className="sr-only">
          Image failed to load
        </span>
      )}
      <IconButton
        size="sm"
        label={`Remove image${suffix}`}
        onClick={() => {
          onChange(undefined)
          setBroken(false)
          focusNext.current = 'trigger'
          setOpen(false)
        }}
      >
        <XMark size={14} />
      </IconButton>
    </div>
  )
}
