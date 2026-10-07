// Feedback goes to GitHub as a pre-filled issue. Nothing is sent from the app: the link opens
// GitHub's issue form, filled in, and the person submits it there.

export const REPO_ISSUES = 'https://github.com/acesonic7/utilitylab/issues/new'

export type FeedbackKind = 'bug' | 'idea' | 'question'

export type FeedbackInput = {
  kind: FeedbackKind
  title: string
  message: string
  // Added only when the person ticks "include app version and browser".
  context?: { version: string; browser: string }
}

// Keeps the link well under the length browsers and GitHub accept.
export const MAX_MESSAGE = 3000

// A short "Firefox 131 on macOS" from a user agent string.
export function describeBrowser(ua: string): string {
  const version = (re: RegExp) => ua.match(re)?.[1]?.split('.')[0]
  let browser = 'Unknown browser'
  if (/Edg\//.test(ua)) browser = `Edge ${version(/Edg\/([\d.]+)/)}`
  else if (/OPR\//.test(ua)) browser = `Opera ${version(/OPR\/([\d.]+)/)}`
  else if (/Firefox\//.test(ua)) browser = `Firefox ${version(/Firefox\/([\d.]+)/)}`
  else if (/Chrome\//.test(ua)) browser = `Chrome ${version(/Chrome\/([\d.]+)/)}`
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = `Safari ${version(/Version\/([\d.]+)/)}`
  let os = ''
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS'
  else if (/Windows/.test(ua)) os = 'Windows'
  else if (/CrOS/.test(ua)) os = 'ChromeOS'
  else if (/Linux/.test(ua)) os = 'Linux'
  return os ? `${browser} on ${os}` : browser
}

function clip(text: string): string {
  const t = text.trim()
  return t.length > MAX_MESSAGE ? `${t.slice(0, MAX_MESSAGE)}\n\n[shortened to fit the link]` : t
}

export function feedbackUrl(input: FeedbackInput): string {
  const params = new URLSearchParams()
  const title = input.title.trim()
  const message = clip(input.message)
  if (input.kind === 'bug') {
    params.set('template', 'bug_report.yml')
    if (title) params.set('title', title)
    if (message) params.set('what', message)
    if (input.context) {
      params.set('browser', input.context.browser)
      params.set('version', `v${input.context.version}`)
    }
  } else if (input.kind === 'idea') {
    params.set('template', 'feature_request.yml')
    if (title) params.set('title', title)
    if (message) params.set('need', message)
  } else {
    params.set('labels', 'question')
    if (title) params.set('title', title)
    const context = input.context ? `\n\n---\nUtilityLab v${input.context.version} · ${input.context.browser}` : ''
    if (message || context) params.set('body', `${message}${context}`)
  }
  return `${REPO_ISSUES}?${params.toString()}`
}
