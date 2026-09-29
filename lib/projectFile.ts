import type { Project } from './schema'
import { isProjectShape, newStudyId, type ArchivedDesign } from './library'

export const PROJECT_FILE_FORMAT = 'utilitylab.project'
export const PROJECT_FILE_VERSION = 1

type ProjectFileV1 = {
  format: typeof PROJECT_FILE_FORMAT
  version: 1
  exportedAt: string
  project: Project
  designHistory?: ArchivedDesign[]
}

export type ParsedProjectFile =
  | { ok: true; project: Project; designHistory: ArchivedDesign[] }
  | { ok: false; error: string }

// LimeSurvey usernames are personal; the password is never stored in the first place.
function shareable(p: Project): Project {
  if (!p.limesurvey?.username) return p
  const { username: _drop, ...rest } = p.limesurvey
  return { ...p, limesurvey: rest }
}

export function serializeProjectFile(project: Project, designHistory: ArchivedDesign[] = []): string {
  const file: ProjectFileV1 = {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    project: shareable(project),
    ...(designHistory.length ? { designHistory } : {}),
  }
  return JSON.stringify(file, null, 2)
}

export function projectFileName(project: Project): string {
  const base = (project.slug || project.name || 'study').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '')
  return `${base || 'study'}.utilitylab.json`
}

// Accepts a UtilityLab project file, or a bare project object saved from an older version.
export function parseProjectFile(text: string, takenIds: string[] = []): ParsedProjectFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' }
  }
  let project: unknown = data
  let history: ArchivedDesign[] = []
  if (data && typeof data === 'object' && (data as { format?: unknown }).format === PROJECT_FILE_FORMAT) {
    const f = data as Partial<ProjectFileV1> & { version?: unknown }
    if (typeof f.version !== 'number' || f.version > PROJECT_FILE_VERSION) {
      return { ok: false, error: 'This project file was made by a newer version of UtilityLab.' }
    }
    project = f.project
    history = Array.isArray(f.designHistory) ? f.designHistory.filter((a) => a && a.design) : []
  }
  if (!isProjectShape(project)) {
    return { ok: false, error: 'This file does not contain a UtilityLab study.' }
  }
  const p = project as Project
  const id = !p.id || takenIds.includes(p.id) ? newStudyId() : p.id
  return { ok: true, project: { ...p, id }, designHistory: history }
}

export function downloadText(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
