import type { CSSProperties } from 'react'
import type { Alternative, Project } from './schema'

export type GlyphKind = 'circle' | 'square' | 'triangle' | 'diamond' | 'pentagon' | 'hexagon'

export type AltIdentity = {
  altId: string
  slot: number | 'x'
  cssVar: string
  glyph: GlyphKind
  hollow: boolean
  label: string
}

const GLYPHS: GlyphKind[] = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon']
const COLOURED_SLOTS = 6

function isValidSlot(s: unknown): s is number {
  return typeof s === 'number' && Number.isInteger(s) && s >= 1
}

const lowestFree = (used: Set<number>) => {
  let s = 1
  while (used.has(s)) s++
  return s
}

// Keeps a stored slot unless it is invalid or already taken by an earlier alternative.
function resolveSlots(alternatives: Alternative[]): Map<string, number> {
  const slots = new Map<string, number>()
  const used = new Set<number>()
  const pending: Alternative[] = []
  for (const alt of alternatives) {
    if (alt.isOptOut) continue
    const s = alt.identitySlot
    if (isValidSlot(s) && !used.has(s)) {
      used.add(s)
      slots.set(alt.id, s)
    } else {
      pending.push(alt)
    }
  }
  // Neutral (7+) alternatives take a freed coloured slot; coloured ones never move.
  for (const [id, s] of Array.from(slots)) {
    if (s <= COLOURED_SLOTS) continue
    const free = lowestFree(used)
    if (free > COLOURED_SLOTS) break
    used.delete(s)
    used.add(free)
    slots.set(id, free)
  }
  for (const alt of pending) {
    const free = lowestFree(used)
    used.add(free)
    slots.set(alt.id, free)
  }
  return slots
}

const cache = new WeakMap<Alternative[], Map<string, AltIdentity>>()

function buildIdentities(alternatives: Alternative[]): Map<string, AltIdentity> {
  const cached = cache.get(alternatives)
  if (cached) return cached
  const slots = resolveSlots(alternatives)
  const out = new Map<string, AltIdentity>()
  alternatives.forEach((alt, i) => {
    const label = alt.label.trim() || `Alternative ${i + 1}`
    if (alt.isOptOut) {
      out.set(alt.id, { altId: alt.id, slot: 'x', cssVar: '--alt-x', glyph: 'circle', hollow: true, label })
      return
    }
    const slot = slots.get(alt.id)!
    out.set(alt.id, {
      altId: alt.id,
      slot,
      cssVar: slot <= COLOURED_SLOTS ? `--alt-${slot}` : '--ink-3',
      glyph: GLYPHS[(slot - 1) % GLYPHS.length],
      hollow: false,
      label,
    })
  })
  cache.set(alternatives, out)
  return out
}

export function altIdentity(project: Project, altId: string): AltIdentity {
  const found = buildIdentities(project.alternatives).get(altId)
  if (found) return found
  return { altId, slot: 'x', cssVar: '--ink-3', glyph: 'circle', hollow: true, label: altId }
}

export function altIdentities(project: Project): AltIdentity[] {
  const map = buildIdentities(project.alternatives)
  return project.alternatives.map((a) => map.get(a.id)!)
}

export function altStyle(id: AltIdentity): CSSProperties {
  return { ['--alt' as string]: `var(${id.cssVar})` } as CSSProperties
}

export function ensureIdentitySlots(project: Project): Project {
  const slots = resolveSlots(project.alternatives)
  let changed = false
  const alternatives = project.alternatives.map((alt) => {
    if (alt.isOptOut) {
      // An opt-out gives its slot back, so switching it back later can't take a newer alternative's colour.
      if (alt.identitySlot === undefined) return alt
      changed = true
      const { identitySlot: _released, ...rest } = alt
      return rest
    }
    const slot = slots.get(alt.id)
    if (slot === undefined || alt.identitySlot === slot) return alt
    changed = true
    return { ...alt, identitySlot: slot }
  })
  return changed ? { ...project, alternatives } : project
}
