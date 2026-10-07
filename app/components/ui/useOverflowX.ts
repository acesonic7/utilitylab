'use client'

import { useEffect, useState, type RefObject } from 'react'

// True while the element's content is wider than its box, so the scroller can become a focusable region.
export function useOverflowX(ref: RefObject<HTMLElement | null>): boolean {
  const [overflow, setOverflow] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const check = () => setOverflow(el.scrollWidth > el.clientWidth + 1)
    const ro = new ResizeObserver(check)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    check()
    return () => ro.disconnect()
  }, [ref])
  return overflow
}
