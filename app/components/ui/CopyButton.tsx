'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from '../Icons'
import { Button, type ButtonProps } from './Button'
import { cx } from './cx'

export type CopyButtonProps = Omit<ButtonProps, 'onClick' | 'icon' | 'children'> & {
  /** The text, or a function that builds it when the button is pressed. */
  text: string | (() => string)
  label?: string
  /** No Button sizing or border: fills its parent, for embedding in strips and cells. */
  bare?: boolean
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  ta.remove()
}

export function CopyButton({
  text,
  label = 'Copy',
  size = 'sm',
  bare,
  className,
  type = 'button',
  variant,
  kbd,
  ...rest
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const onClick = async () => {
    try {
      await writeClipboard(typeof text === 'function' ? text() : text)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const icon = copied ? <Check /> : <Copy />
  const content = copied ? 'Copied' : label

  return (
    <>
      {bare ? (
        <button
          type={type}
          onClick={onClick}
          className={cx(
            'focus-ring inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-12 font-medium leading-none text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink [&_svg]:size-3.5 [&_svg]:shrink-0',
            className,
          )}
          {...rest}
        >
          <span className="inline-flex" aria-hidden="true">
            {icon}
          </span>
          {content}
        </button>
      ) : (
        <Button size={size} variant={variant} kbd={kbd} icon={icon} onClick={onClick} className={className} type={type} {...rest}>
          {content}
        </Button>
      )}
      {/* Outside the button: live regions inside buttons aren't reliably announced. */}
      <span role="status" className="sr-only">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </>
  )
}
