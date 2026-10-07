import type { Project } from './schema'

export type ResponseRequirement = NonNullable<Project['builder']['responseRequirement']>

export const DEFAULT_RESPONSE_REQUIREMENT: ResponseRequirement = 'request'

export function responseRequirement(project: Project): ResponseRequirement {
  return project.builder.responseRequirement ?? DEFAULT_RESPONSE_REQUIREMENT
}

// LimeSurvey: N = optional, S = soft mandatory (warns, can continue), Y = mandatory.
export function limesurveyMandatory(r: ResponseRequirement): 'N' | 'S' | 'Y' {
  return r === 'require' ? 'Y' : r === 'request' ? 'S' : 'N'
}

export const DEFAULT_QUESTION_STEM = 'Which of these alternatives would you choose?'

export function questionStem(project: Project): string {
  const s = project.builder.labels?.questionStem?.trim()
  return s ? s : DEFAULT_QUESTION_STEM
}

// Characters XML 1.0 cannot carry at all (everything below 0x20 except tab, LF and CR).
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g

export function stripControl(s: string): string {
  return s.replace(XML_INVALID, '')
}

// User text placed into survey HTML. Besides HTML itself, it neutralises the template
// syntax of each platform so a label is always shown literally: Qualtrics Advanced
// Format tags ([[…]]) and piped text (${…}), and LimeSurvey Expression Manager ({…}).
export function htmlText(s: string): string {
  return stripControl(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    .replace(/\$/g, '&#36;')
    .replace(/\r\n|\r|\n/g, '<br>')
}

// A value for an HTML attribute (image URLs); keeps the URL usable but inert as template syntax.
export function htmlAttr(s: string): string {
  return htmlText(s).replace(/<br>/g, '')
}

// A single line of HTML text, for formats where a line break starts a new item (TXT choices).
export function htmlLine(s: string): string {
  return htmlText(s.replace(/\s*(\r\n|\r|\n)\s*/g, ' '))
}
