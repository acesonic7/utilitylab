import { describe, expect, it } from 'vitest'
import type { Project } from '../schema'
import { travelModeExample } from '../example'
import { buildBlockAssignmentLsq, buildQuestionLsq, buildSurveyLss } from '../limesurveyExport'
import { exportQsf, exportTxt } from '../qualtricsExport'
import { checkProject } from '../projectShape'
import { responseRequirement } from '../surveyText'

const withRequirement = (r: Project['builder']['responseRequirement']): Project => ({
  ...travelModeExample,
  builder: { ...travelModeExample.builder, responseRequirement: r },
})

const choiceTaskMandatory = (lss: string) =>
  [...lss.matchAll(/<title>CT\d+T\d+<\/title>[\s\S]*?<mandatory>(\w)<\/mandatory>/g)].map((m) => m[1])

describe('response requirement', () => {
  it('defaults to requesting an answer', () => {
    expect(responseRequirement(travelModeExample)).toBe('request')
  })

  it('maps to LimeSurvey soft mandatory, mandatory and optional; BLK stays optional', () => {
    for (const [r, flag] of [['request', 'S'], ['require', 'Y'], ['optional', 'N']] as const) {
      const lss = buildSurveyLss(withRequirement(r))
      const flags = choiceTaskMandatory(lss)
      expect(flags.length).toBe(travelModeExample.design!.rows.length)
      expect(new Set(flags)).toEqual(new Set([flag]))
      expect(lss).toMatch(/<title>BLK<\/title>[\s\S]*?<mandatory>N<\/mandatory>/)
      expect(buildQuestionLsq(withRequirement(r), travelModeExample.design!.rows[0], 0).mandatory).toBe(flag)
    }
    expect(buildBlockAssignmentLsq(2).mandatory).toBe('N')
  })

  it('sets the Qualtrics QSF response validation', () => {
    const settings = (r: Project['builder']['responseRequirement']) =>
      JSON.parse(exportQsf(withRequirement(r)))
        .SurveyElements.filter((e: { Element: string }) => e.Element === 'SQ')
        .map((e: { Payload: { Validation: { Settings: { ForceResponse: string } } } }) => e.Payload.Validation.Settings.ForceResponse)
    expect(new Set(settings('request'))).toEqual(new Set(['RequestResponse']))
    expect(new Set(settings('require'))).toEqual(new Set(['ON']))
    expect(new Set(settings('optional'))).toEqual(new Set(['OFF']))
  })

  it('tells TXT users which Qualtrics response requirement to turn on', () => {
    expect(exportTxt(withRequirement('request'))).toContain('Request response')
    expect(exportTxt(withRequirement('require'))).toContain('Force response')
    expect(exportTxt(withRequirement('optional'))).not.toContain('RESPONSE_NOTES')
  })

  it('repairs an unknown stored value to the default', () => {
    const check = checkProject({ ...travelModeExample, builder: { ...travelModeExample.builder, responseRequirement: 'sometimes' } })
    expect(check.ok).toBe(true)
    if (check.ok) expect(responseRequirement(check.project)).toBe('request')
  })
})
