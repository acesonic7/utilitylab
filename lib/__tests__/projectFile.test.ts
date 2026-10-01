import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Design, Project } from '../schema'
import { travelModeExample } from '../example'
import { checkProject } from '../projectShape'
import { parseProjectFile, serializeProjectFile } from '../projectFile'
import {
  DESIGN_HISTORY_LIMIT,
  archiveDesign,
  designHistory,
  setDesignHistory,
  type ArchivedDesign,
} from '../library'
import { validate } from '../validation'
import { designSignature } from '../signature'
import { buildDesignMatrix } from '../designMatrix'
import { computeDError } from '../dOptimal'
import { constraintViolations } from '../diagnosticsView'
import { levelCounts } from '../diagnostics'
import { exportQsf, exportTxt } from '../qualtricsExport'
import { designFit } from '../designFit'
import { ensureIdentitySlots } from '../altIdentity'

const example = () => structuredClone(travelModeExample)

// What the workspace computes on first render; an accepted study must survive all of it.
function render(p: Project) {
  const q = ensureIdentitySlots(p)
  validate(q)
  designSignature(q, { dError: null })
  buildDesignMatrix(q)
  constraintViolations(q)
  levelCounts(q)
  designFit(q)
  if (q.design?.rows.length) {
    computeDError(q, q.design.rows)
    exportTxt(q)
    exportQsf(q)
  }
}

describe('project files: malformed studies are rejected or repaired, never stored broken', () => {
  it('opens a file the app wrote, unchanged', () => {
    const p = example()
    const parsed = parseProjectFile(serializeProjectFile(p))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.project).toEqual(p)
  })

  // The shapes the stress test used to white-screen the app on every load.
  it.each([
    ['an alternative label that is a number', (p: any) => (p.alternatives[1].label = 5), /Alternative 2 label must be text/i],
    ['a null alternative', (p: any) => (p.alternatives = [null]), /Alternative 1 is missing/i],
    ['design rows that are not a list', (p: any) => (p.design.rows = 'x'), /design rows is missing or not a list/],
    ['an attribute without levels', (p: any) => (p.attributes[0].levels = null), /Attribute "Travel time" levels is missing/i],
    ['a level without a value', (p: any) => delete p.attributes[0].levels[0].value, /needs a value/],
  ])('rejects %s with a reason', (_label, mutate, message) => {
    const p = example()
    mutate(p)
    const parsed = parseProjectFile(serializeProjectFile(p))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toMatch(message)
  })

  it('repairs an empty layout instead of crashing', () => {
    const p = example() as any
    p.builder = {}
    const parsed = parseProjectFile(serializeProjectFile(p))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.project.builder.attributeOrder).toEqual(p.attributes.map((a: any) => a.id))
      render(parsed.project)
    }
  })

  it('leaves out earlier designs it cannot read, and says how many', () => {
    const p = example()
    const good: ArchivedDesign = { archivedAt: '2026-01-01T00:00:00Z', design: p.design! }
    const file = JSON.parse(serializeProjectFile(p, [good]))
    file.designHistory.push({ archivedAt: 'x', design: { rows: 'broken' } })
    const parsed = parseProjectFile(JSON.stringify(file))
    expect(parsed.ok && parsed.designHistory.length).toBe(1)
    expect(parsed.ok && parsed.droppedHistory).toBe(1)
  })

  // Every node of the example replaced by each wrong-typed value: the check either rejects it
  // or returns a study the first render can handle.
  it('never accepts a study that would crash the first render', () => {
    const base = example()
    base.design!.rows = base.design!.rows.slice(0, 2)
    const paths: (string | number)[][] = []
    const walk = (v: unknown, path: (string | number)[]) => {
      paths.push(path)
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, [...path, Array.isArray(v) ? Number(k) : k])
    }
    walk(base, [])
    let accepted = 0
    let rejected = 0
    for (const path of paths.slice(1)) {
      for (const bad of [null, 7, 'x', [], {}, true]) {
        const p = structuredClone(base) as any
        let node = p
        for (const k of path.slice(0, -1)) node = node[k]
        node[path[path.length - 1]] = bad
        const c = checkProject(p)
        if (!c.ok) {
          rejected++
          expect(c.error.length).toBeGreaterThan(5)
          continue
        }
        accepted++
        try {
          render(c.project)
        } catch (e) {
          throw new Error(`Accepted ${JSON.stringify(path)} = ${JSON.stringify(bad)}, then: ${(e as Error).message}`)
        }
      }
    }
    expect(accepted).toBeGreaterThan(0)
    expect(rejected).toBeGreaterThan(0)
  })
})

describe('earlier designs survive a full browser storage', () => {
  let store: Map<string, string>
  let quota = Infinity
  beforeEach(() => {
    store = new Map()
    quota = Infinity
    const ls = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        const used = [...store].reduce((n, [key, val]) => n + (key === k ? 0 : key.length + val.length), 0)
        if (used + k.length + v.length > quota) throw new DOMException('quota', 'QuotaExceededError')
        store.set(k, v)
      },
      removeItem: (k: string) => void store.delete(k),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size
      },
      clear: () => store.clear(),
    }
    ;(globalThis as any).window = { localStorage: ls }
  })
  afterEach(() => {
    delete (globalThis as any).window
  })

  const design = (n: number): Design => ({ ...example().design!, uploadedAt: `2026-01-${String(n).padStart(2, '0')}T00:00:00Z` })

  it('stores what fits and hands back the rest instead of losing everything', () => {
    let list: ArchivedDesign[] = []
    for (let i = 1; i <= 4; i++) list = [...archiveDesign('s', design(i), list).stored]
    const one = JSON.stringify(list[0]).length
    quota = 'utilitylab:designs:s'.length + store.get('utilitylab:designs:s')!.length + Math.floor(one / 2) // not room for a fifth

    const all = [...list]
    const w = archiveDesign('s', design(5), all)
    expect(w.error).toMatch(/storage is full/)
    expect(w.stored.length + w.overflow.length).toBe(5)
    expect(w.stored[0].design.uploadedAt).toBe(design(5).uploadedAt) // newest kept in storage
    expect(designHistory('s').map((a) => a.design.uploadedAt)).toEqual(w.stored.map((a) => a.design.uploadedAt))
  })

  it('keeps nothing silently when not even one entry fits', () => {
    quota = 10
    const w = setDesignHistory('s', [{ archivedAt: 'a', design: design(1) }])
    expect(w.stored).toEqual([])
    expect(w.overflow).toHaveLength(1)
    expect(w.error).not.toBeNull()
  })

  it('still caps the list at the history limit when storage has room', () => {
    const list = Array.from({ length: DESIGN_HISTORY_LIMIT + 3 }, (_, i) => ({ archivedAt: String(i), design: design(i + 1) }))
    const w = setDesignHistory('s', list)
    expect(w.stored).toHaveLength(DESIGN_HISTORY_LIMIT)
    expect(w.overflow).toEqual([])
    expect(w.error).toBeNull()
  })
})
