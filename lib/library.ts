import type { Design, Project } from './schema'
import { travelModeExample } from './example'
import { createAttribute } from './defaults'
import { newAlternative } from './altRoles'
import { slugify, uniqueSlug } from './slug'

// Browser storage for the study library. Each study lives under its own key so a
// failed or corrupt write can only ever affect that one study.
const INDEX_KEY = 'utilitylab:studies'
const ACTIVE_KEY = 'utilitylab:active'
const LEGACY_KEY = 'utilitylab:project'
const studyKey = (id: string) => `utilitylab:study:${id}`
const historyKey = (id: string) => `utilitylab:designs:${id}`
const progressKey = (id: string) => `utilitylab:progress:${id}`

export const DESIGN_HISTORY_LIMIT = 10

export type StudyMeta = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  alternatives: number
  attributes: number
  choiceTasks: number
  fromExample?: boolean
}

export type ArchivedDesign = { archivedAt: string; design: Design }

export type SaveResult = { ok: true } | { ok: false; error: string }

export type LibraryState = {
  studies: StudyMeta[]
  project: Project
  // Studies whose stored JSON could not be read. They are left untouched in storage.
  unreadable: string[]
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function readJson<T>(key: string): { ok: true; value: T | null } | { ok: false } {
  const s = storage()
  const raw = s?.getItem(key) ?? null
  if (raw === null) return { ok: true, value: null }
  try {
    return { ok: true, value: JSON.parse(raw) as T }
  } catch {
    return { ok: false }
  }
}

function write(key: string, value: unknown): SaveResult {
  const s = storage()
  if (!s) return { ok: false, error: 'Browser storage is not available.' }
  try {
    s.setItem(key, JSON.stringify(value))
    return { ok: true }
  } catch (e) {
    const quota = e instanceof DOMException && /quota/i.test(e.name + e.message)
    return {
      ok: false,
      error: quota
        ? 'Browser storage is full. Download your studies and delete ones you no longer need.'
        : 'The browser refused to save.',
    }
  }
}

export function newStudyId(): string {
  const r =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `study_${r}`
}

export function isProjectShape(p: unknown): p is Project {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    Array.isArray(o.alternatives) &&
    Array.isArray(o.attributes) &&
    (o.experimentType === 'labeled' || o.experimentType === 'unlabeled') &&
    typeof o.builder === 'object' &&
    o.builder !== null &&
    'design' in o
  )
}

function metaOf(p: Project, fromExample?: boolean): StudyMeta {
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    alternatives: p.alternatives.length,
    attributes: p.attributes.length,
    choiceTasks: p.design?.numTasks ?? 0,
    ...(fromExample ? { fromExample } : {}),
  }
}

function readIndex(): StudyMeta[] | null {
  const r = readJson<StudyMeta[]>(INDEX_KEY)
  return r.ok && Array.isArray(r.value) ? r.value : null
}

function writeIndex(studies: StudyMeta[]): SaveResult {
  return write(INDEX_KEY, studies)
}

export function listStudies(): StudyMeta[] {
  return (readIndex() ?? []).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function exampleStudy(): Project {
  const now = new Date().toISOString()
  return { ...structuredClone(travelModeExample), id: newStudyId(), createdAt: now, updatedAt: now }
}

export type NewStudyOptions = {
  name?: string
  description?: string
  experimentType?: Project['experimentType']
  /** Labels for labeled studies, or how many generic alternatives (A, B, …) to create. */
  alternatives?: string[] | number
  optOut?: boolean
  /** Seed one placeholder attribute; the setup dialog leaves the first attribute to the user. */
  starterAttribute?: boolean
}

export function fileSlug(name: string): string {
  return slugify(name).replace(/_/g, '-') || 'untitled-study'
}

export function blankStudy(opts: NewStudyOptions = {}): Project {
  const now = new Date().toISOString()
  const name = opts.name?.trim() || 'Untitled stated choice experiment'
  const base: Project = {
    id: newStudyId(),
    slug: opts.name?.trim() ? fileSlug(name) : 'untitled-study',
    name,
    description: opts.description?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
    experimentType: opts.experimentType ?? 'unlabeled',
    alternatives: [],
    attributes: [],
    contextVariables: [],
    constraints: [],
    design: null,
    builder: {
      attributeOrder: [],
      alternativeOrder: [],
      layout: 'attributes-as-rows',
      showUnits: true,
      optOutPosition: 'last',
    },
  }
  const spec = opts.alternatives ?? 2
  const labels = typeof spec === 'number' ? Array.from({ length: spec }, () => null) : spec
  let p = base
  for (const label of labels) {
    const alt = newAlternative(p)
    const named = label?.trim()
      ? { ...alt, label: label.trim(), id: uniqueSlug(label, p.alternatives.map((a) => a.id)) }
      : alt
    p = { ...p, alternatives: [...p.alternatives, { ...named, position: p.alternatives.length }] }
  }
  if (opts.optOut) {
    p = { ...p, alternatives: [...p.alternatives, { ...newAlternative(p, { optOut: true }), position: p.alternatives.length }] }
  }
  const attributes = opts.starterAttribute === false ? [] : [createAttribute(p)]
  return {
    ...p,
    attributes,
    builder: {
      ...base.builder,
      alternativeOrder: p.alternatives.map((a) => a.id),
      attributeOrder: attributes.map((a) => a.id),
    },
  }
}

// Review progress for the guided flow: which later steps the user has been through for the
// study's current design. A new design (another uploadedAt) starts the review over.
export type ReviewStep = 'choice-tasks' | 'diagnostics' | 'export'

type StoredProgress = { design: string; reviewed: ReviewStep[] }

export function readReviewed(id: string, design: string | null): ReviewStep[] {
  if (!design) return []
  const r = readJson<StoredProgress>(progressKey(id))
  const v = r.ok ? r.value : null
  return v && v.design === design && Array.isArray(v.reviewed) ? v.reviewed : []
}

export function markReviewed(id: string, design: string, step: ReviewStep): ReviewStep[] {
  const cur = readReviewed(id, design)
  if (cur.includes(step)) return cur
  const next = [...cur, step]
  write(progressKey(id), { design, reviewed: next })
  return next
}

// Loads the active study, migrating the pre-library single project on first run.
// Never overwrites a study it could not read.
export function loadLibrary(): LibraryState {
  const s = storage()
  let studies = readIndex()
  const unreadable: string[] = []

  if (!studies) {
    studies = scanStudies()
    const legacy = readJson<unknown>(LEGACY_KEY)
    if (legacy.ok && isProjectShape(legacy.value) && !studies.some((m) => m.id === (legacy.value as Project).id)) {
      const p = legacy.value
      if (write(studyKey(p.id), p).ok) {
        studies.push(metaOf(p))
        s?.removeItem(LEGACY_KEY)
      }
    }
    writeIndex(studies)
  }

  const activeId = s?.getItem(ACTIVE_KEY) ?? null
  const order = [
    ...(activeId ? studies.filter((m) => m.id === activeId) : []),
    ...listStudiesFrom(studies).filter((m) => m.id !== activeId),
  ]
  let found: Project | null = null
  for (const m of order) {
    const r = readJson<unknown>(studyKey(m.id))
    if (r.ok && isProjectShape(r.value)) {
      if (!found) {
        found = r.value
        s?.setItem(ACTIVE_KEY, m.id)
      }
    } else unreadable.push(m.id)
  }
  if (found) return { studies: listStudiesFrom(studies), project: found, unreadable }

  const fresh = exampleStudy()
  const index = [...studies, metaOf(fresh, true)]
  write(studyKey(fresh.id), fresh)
  writeIndex(index)
  s?.setItem(ACTIVE_KEY, fresh.id)
  return { studies: listStudiesFrom(index), project: fresh, unreadable }
}

// Rebuilds the index from the study keys themselves (first run, or an unreadable index).
function scanStudies(): StudyMeta[] {
  const s = storage()
  if (!s) return []
  const out: StudyMeta[] = []
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i)
    if (!key?.startsWith('utilitylab:study:')) continue
    const r = readJson<unknown>(key)
    if (r.ok && isProjectShape(r.value)) out.push(metaOf(r.value))
  }
  return out
}

function listStudiesFrom(studies: StudyMeta[]): StudyMeta[] {
  return studies.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveStudy(p: Project): SaveResult {
  const r = write(studyKey(p.id), p)
  if (!r.ok) return r
  const index = readIndex() ?? []
  const i = index.findIndex((m) => m.id === p.id)
  const prev = i >= 0 ? index[i] : undefined
  const meta = metaOf(p, prev?.fromExample)
  if (
    prev &&
    prev.name === meta.name &&
    prev.updatedAt === meta.updatedAt &&
    prev.alternatives === meta.alternatives &&
    prev.attributes === meta.attributes &&
    prev.choiceTasks === meta.choiceTasks
  )
    return { ok: true }
  const next = i >= 0 ? index.map((m, n) => (n === i ? meta : m)) : [...index, meta]
  return writeIndex(next)
}

export function addStudy(p: Project, opts?: { fromExample?: boolean }): SaveResult {
  const r = write(studyKey(p.id), p)
  if (!r.ok) return r
  const index = (readIndex() ?? []).filter((m) => m.id !== p.id)
  const w = writeIndex([...index, metaOf(p, opts?.fromExample)])
  if (w.ok) storage()?.setItem(ACTIVE_KEY, p.id)
  return w
}

export function readStudy(id: string): Project | null {
  const r = readJson<unknown>(studyKey(id))
  return r.ok && isProjectShape(r.value) ? r.value : null
}

export function openStudy(id: string): Project | null {
  const r = readJson<unknown>(studyKey(id))
  if (!r.ok || !isProjectShape(r.value)) return null
  storage()?.setItem(ACTIVE_KEY, id)
  return r.value
}

export function readStudyRaw(id: string): string | null {
  return storage()?.getItem(studyKey(id)) ?? null
}

export function deleteStudy(id: string): SaveResult {
  const s = storage()
  const w = writeIndex((readIndex() ?? []).filter((m) => m.id !== id))
  if (!w.ok) return w
  s?.removeItem(studyKey(id))
  s?.removeItem(historyKey(id))
  s?.removeItem(progressKey(id))
  return { ok: true }
}

export function duplicateStudy(p: Project): Project {
  const now = new Date().toISOString()
  return {
    ...structuredClone(p),
    id: newStudyId(),
    name: `${p.name} (copy)`,
    slug: slugify(`${p.slug || p.name}-copy`),
    createdAt: now,
    updatedAt: now,
  }
}

export function designHistory(studyId: string): ArchivedDesign[] {
  const r = readJson<ArchivedDesign[]>(historyKey(studyId))
  return r.ok && Array.isArray(r.value) ? r.value : []
}

export function setDesignHistory(studyId: string, list: ArchivedDesign[]): SaveResult {
  return write(historyKey(studyId), list.slice(0, DESIGN_HISTORY_LIMIT))
}

export function archiveDesign(studyId: string, design: Design): SaveResult {
  const list = designHistory(studyId).filter((a) => a.design.uploadedAt !== design.uploadedAt)
  return setDesignHistory(studyId, [{ archivedAt: new Date().toISOString(), design }, ...list])
}
