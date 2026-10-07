import { describe, expect, it } from 'vitest'
import { travelModeExample } from '../example'
import { exportQsf, exportTxt, renderTaskAsHtml } from '../qualtricsExport'
import { buildSurveyLss } from '../limesurveyExport'
import { DEFAULT_QUESTION_STEM, htmlLine, htmlText } from '../surveyText'
import type { Project } from '../schema'

const hostile = 'Car [[Block:X]] ${e://Field/X} {BLK.NAOK} <b>&"\'\u0007\nnext'

function withHostileLabels(): Project {
  const p = structuredClone(travelModeExample)
  p.alternatives[0].label = hostile
  p.attributes[0].name = hostile
  p.contextVariables![0].levels[0].displayValue = hostile
  return p
}

describe('htmlText', () => {
  it('neutralises HTML and every platform template syntax', () => {
    const out = htmlText(hostile)
    for (const raw of ['[[', '${', '{BLK', '<b>', '\u0007']) expect(out).not.toContain(raw)
    expect(out).toContain('<br>')
  })
  it('keeps a choice on one line', () => {
    expect(htmlLine('a\nb')).toBe('a b')
  })
})

describe('question text', () => {
  it('asks the default stem above every exported choice task', () => {
    const html = renderTaskAsHtml(travelModeExample, travelModeExample.design!.rows[0])
    expect(html).toContain(DEFAULT_QUESTION_STEM)
    expect(html.indexOf(DEFAULT_QUESTION_STEM)).toBeLessThan(html.indexOf('<table'))
  })
  it('uses the study’s own question text', () => {
    const p = structuredClone(travelModeExample)
    p.builder.labels = { ...p.builder.labels, questionStem: 'Ποιο θα επιλέγατε;' }
    expect(exportTxt(p)).toContain('Ποιο θα επιλέγατε;')
    expect(buildSurveyLss(p)).toContain('Ποιο θα επιλέγατε;')
  })
})

describe('exports with hostile labels', () => {
  const p = withHostileLabels()

  it('TXT keeps every choice on one line and no stray tags', () => {
    const txt = exportTxt(p)
    const tags = txt.match(/\[\[[^\]]*\]\]/g) ?? []
    expect(tags.some((t) => t.includes('Block:X'))).toBe(false)
    const choices = txt.split('[[Choices]]\n')[1].split('\n\n')[0].split('\n')
    expect(choices).toHaveLength(p.alternatives.filter((a) => !a.isOptOut).length)
  })

  it('QSF is valid JSON with escaped choice text', () => {
    const qsf = JSON.parse(exportQsf(p))
    const text = JSON.stringify(qsf)
    expect(text).not.toContain('{BLK.NAOK}')
    expect(text).not.toContain('\\u0007')
  })

  it('LSS has no control characters and no live expressions', () => {
    const lss = buildSurveyLss(p)
    expect(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(lss)).toBe(false)
    expect(lss).not.toContain('{BLK.NAOK}')
    // The assignment equation itself is still live.
    expect(lss).toContain('{if(is_empty(BLK.NAOK)')
  })
})
