import { describe, expect, it } from 'vitest'
import { MAX_MESSAGE, describeBrowser, feedbackUrl } from '../feedback'

const UA = {
  firefoxMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0',
  chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.2792.79',
  safariIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
}

const params = (url: string) => new URL(url).searchParams

describe('describeBrowser', () => {
  it('names common browsers and systems', () => {
    expect(describeBrowser(UA.firefoxMac)).toBe('Firefox 131 on macOS')
    expect(describeBrowser(UA.chromeWin)).toBe('Chrome 129 on Windows')
    expect(describeBrowser(UA.edge)).toBe('Edge 129 on Windows')
    expect(describeBrowser(UA.safariIos)).toBe('Safari 18 on iOS')
    expect(describeBrowser('')).toBe('Unknown browser')
  })
})

describe('feedbackUrl', () => {
  it('fills the bug report form, with context only when asked', () => {
    const p = params(feedbackUrl({ kind: 'bug', title: 'QSF import fails', message: 'Error on import', context: { version: '1.2.0', browser: 'Firefox 131 on macOS' } }))
    expect(p.get('template')).toBe('bug_report.yml')
    expect(p.get('title')).toBe('QSF import fails')
    expect(p.get('what')).toBe('Error on import')
    expect(p.get('browser')).toBe('Firefox 131 on macOS')
    expect(p.get('version')).toBe('v1.2.0')
    const bare = params(feedbackUrl({ kind: 'bug', title: 'x', message: 'y' }))
    expect(bare.has('browser')).toBe(false)
  })
  it('fills the feature request form', () => {
    const p = params(feedbackUrl({ kind: 'idea', title: 'Attribute library', message: 'Travel time presets' }))
    expect(p.get('template')).toBe('feature_request.yml')
    expect(p.get('need')).toBe('Travel time presets')
  })
  it('opens a labelled blank issue for questions', () => {
    const p = params(feedbackUrl({ kind: 'question', title: 'Priors?', message: 'How?', context: { version: '1.2.0', browser: 'Chrome 129 on Windows' } }))
    expect(p.get('labels')).toBe('question')
    expect(p.get('body')).toContain('How?')
    expect(p.get('body')).toContain('UtilityLab v1.2.0 · Chrome 129 on Windows')
  })
  it('shortens long messages so the link stays usable', () => {
    const url = feedbackUrl({ kind: 'idea', title: 't', message: 'a'.repeat(MAX_MESSAGE + 500) })
    expect(params(url).get('need')!.endsWith('[shortened to fit the link]')).toBe(true)
    expect(url.length).toBeLessThan(8000)
  })
})
