import { describe, expect, it } from 'vitest'
import { travelModeExample } from '../example'
import {
  BLOCK_QUESTION_CODE,
  buildBlockAssignmentLsq,
  buildQuestionLsq,
  buildSurveyLss,
} from '../limesurveyExport'
import { exportTxt } from '../qualtricsExport'

const p = travelModeExample

// A tag-balance check: every opening element has a matching close, outside CDATA.
function wellFormed(xml: string): boolean {
  const body = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(/<\?xml[^>]*\?>/, '')
  const stack: string[] = []
  for (const m of body.matchAll(/<(\/?)([A-Za-z_][\w-]*)[^>]*?(\/?)>/g)) {
    const [, close, name, self] = m
    if (self) continue
    if (close) {
      if (stack.pop() !== name) return false
    } else stack.push(name)
  }
  return stack.length === 0
}

describe('LimeSurvey LSS', () => {
  const lss = buildSurveyLss(p)

  it('is well formed', () => {
    expect(wellFormed(lss)).toBe(true)
  })

  it('assigns one block per respondent through a hidden BLK equation', () => {
    expect(lss).toContain(`<title>${BLOCK_QUESTION_CODE}</title>`)
    expect(lss).toContain('<type>*</type>')
    expect(lss).toContain('rand(1, 2)')
    expect(lss).toMatch(/<attribute>hidden<\/attribute>\s*<value><!\[CDATA\[1\]\]><\/value>/)
    expect(lss).toContain('BLK.NAOK == 1')
    expect(lss).toContain('BLK.NAOK == 2')
    expect(lss).not.toContain('sp_blocks')
  })

  it('never shows every block to every respondent', () => {
    const groupRelevance = [...lss.matchAll(/<grelevance>(.*?)<\/grelevance>/g)].map((m) => m[1])
    // Assignment group + one group per block; only the assignment group is always shown.
    expect(groupRelevance.filter((g) => g.includes('[1]'))).toHaveLength(1)
    expect(groupRelevance).toHaveLength(3)
  })

  it('hides block names from respondents', () => {
    expect(lss).toContain('<showgroupinfo>N</showgroupinfo>')
  })

  it('links answer texts by aid', () => {
    const aids = [...lss.matchAll(/<aid>(\d+)<\/aid>/g)].map((m) => Number(m[1]))
    const alts = p.alternatives.filter((a) => !a.isOptOut).length
    // Each aid appears once in answers and once in answer_l10ns.
    expect(aids.length).toBe(2 * alts * p.design!.rows.length)
    expect(new Set(aids).size).toBe(alts * p.design!.rows.length)
  })

  it('keeps a single-block design free of block assignment', () => {
    const one = buildSurveyLss({ ...p, design: { ...p.design!, numBlocks: 1, rows: p.design!.rows.map((r) => ({ ...r, block: 1 })) } })
    expect(one).not.toContain(`<title>${BLOCK_QUESTION_CODE}</title>`)
    expect(wellFormed(one)).toBe(true)
  })
})

describe('LimeSurvey LSQ', () => {
  it('builds a well-formed choice task with random_group per block', () => {
    const q = buildQuestionLsq(p, p.design!.rows[0], 0)
    expect(wellFormed(q.xml)).toBe(true)
    expect(q.xml).toContain('<qid>1</qid>')
    expect(q.xml).toContain('<attribute>random_group</attribute>')
  })
  it('builds a hidden block assignment question', () => {
    const q = buildBlockAssignmentLsq(3)
    expect(wellFormed(q.xml)).toBe(true)
    expect(q.xml).toContain('rand(1, 3)')
  })
})

describe('Qualtrics TXT', () => {
  it('explains how to present one block per respondent', () => {
    const txt = exportTxt(p)
    expect(txt).toContain('[[ID:BLOCKING_NOTES]]')
    expect(txt).toContain('Randomizer')
  })
})
