'use client'

import { useEffect, useState } from 'react'
import type { SectionId } from '../Workspace'
import { SECTION_IDS as ids } from './sections'

const TOP = 120

// The current section is the first one crossing a band just under the sticky chrome.
export function useScrollSpy(): SectionId {
  const [current, setCurrent] = useState<SectionId>(ids[0])

  useEffect(() => {
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    if (els.length === 0 || typeof IntersectionObserver === 'undefined') return

    const visible = new Map<string, boolean>()
    let frame = 0

    const pick = () => {
      const doc = document.documentElement
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) {
        setCurrent(ids[ids.length - 1])
        return
      }
      const first = ids.find((id) => visible.get(id))
      if (first) {
        setCurrent(first)
        return
      }
      // Nothing in the band (e.g. at the top): the last section scrolled past, else the first.
      let above: SectionId = ids[0]
      for (const el of els) if (el.getBoundingClientRect().top < TOP) above = el.id as SectionId
      setCurrent(above)
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting)
        pick()
      },
      { rootMargin: `-${TOP}px 0px -50% 0px`, threshold: 0 },
    )
    els.forEach((el) => io.observe(el))

    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(pick)
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  return current
}
