'use client'

import { useState } from 'react'

// Compact image URL field with a thumbnail preview. Used for attribute,
// alternative, and level image overrides. The "image" toggle keeps the field
// collapsed by default so we don't clutter editors that aren't using it.

export default function ImageUrlInput({
  value,
  onChange,
  size = 24,
  placeholder = 'https://… (png, jpg, svg)',
}: {
  value: string | undefined
  onChange: (next: string | undefined) => void
  size?: number
  placeholder?: string
}) {
  const has = !!value && value.trim() !== ''
  const [open, setOpen] = useState(has)
  const [broken, setBroken] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-neutral-400 hover:text-neutral-700 transition"
        title="Add an image to this row"
      >
        + image
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      {has && !broken ? (
        <img
          src={value}
          alt=""
          width={size}
          height={size}
          onError={() => setBroken(true)}
          className="rounded-sm ring-1 ring-neutral-200 object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className={`rounded-sm ring-1 flex items-center justify-center text-[9px] ${
            broken
              ? 'ring-rose-300 text-rose-500 bg-rose-50'
              : 'ring-neutral-200 text-neutral-400 bg-neutral-50'
          }`}
          style={{ width: size, height: size }}
          title={broken ? 'Image failed to load' : 'No image set'}
        >
          {broken ? '!' : '∅'}
        </div>
      )}
      <input
        type="url"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value
          setBroken(false)
          onChange(v.trim() === '' ? undefined : v)
        }}
        className="bg-white rounded-md px-2 py-1 text-xs ring-1 ring-neutral-200 hover:ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition w-44"
      />
      <button
        type="button"
        onClick={() => {
          onChange(undefined)
          setBroken(false)
          setOpen(false)
        }}
        className="text-neutral-400 hover:text-neutral-700 text-[11px] px-1 transition"
        title="Remove image"
      >
        ×
      </button>
    </div>
  )
}
