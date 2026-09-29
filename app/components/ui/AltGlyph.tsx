import type { AltIdentity, GlyphKind } from '@/lib/altIdentity'
import { cx } from './cx'

const SHAPES: Record<GlyphKind, JSX.Element> = {
  circle: <circle cx="6" cy="6" r="5" />,
  square: <rect x="1.4" y="1.4" width="9.2" height="9.2" rx="1.3" />,
  triangle: <path d="M6 .9 11.4 10.7H.6Z" strokeLinejoin="round" />,
  diamond: <path d="M6 .3 11.7 6 6 11.7 .3 6Z" />,
  pentagon: <path d="M6 .9 11.14 4.63 9.17 10.67H2.83L.86 4.63Z" strokeLinejoin="round" />,
  hexagon: <path d="M6 .6 10.68 3.3v5.4L6 11.4 1.32 8.7V3.3Z" strokeLinejoin="round" />,
}

export type AltGlyphProps = {
  identity: AltIdentity
  size?: number
  hollow?: boolean
  /** Ink-4 hollow ghost, e.g. an attribute that does not apply to this alternative. */
  ghost?: boolean
  className?: string
}

export function AltGlyph({ identity, size = 12, hollow, ghost, className }: AltGlyphProps) {
  const open = ghost || (hollow ?? identity.hollow)
  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      overflow="visible"
      className={cx('inline-block shrink-0 align-[-1px]', className)}
      style={{ color: ghost ? 'rgb(var(--ink-4))' : `rgb(var(${identity.cssVar}))` }}
      fill={open ? 'none' : 'currentColor'}
      stroke={open ? 'currentColor' : 'none'}
      strokeWidth={open ? 1.4 : undefined}
    >
      {SHAPES[identity.glyph]}
    </svg>
  )
}
