import type { Project, DesignRow, Alternative, Attribute } from './schema'
import { cellKey } from './validation'
import { levelDisplayText } from './format'
import { findLevelInAttr } from './levelLookup'
import { buildTxtCommentBlock } from './wiringGuide'
import { exportBlocks } from './blocks'
import { htmlAttr, htmlLine, htmlText, questionStem, responseRequirement, type ResponseRequirement } from './surveyText'

function getLevel(attr: Attribute, levelId: string | undefined) {
  if (!levelId) return undefined
  return findLevelInAttr(attr, levelId)
}

function appliesToAlt(attr: Attribute, altId: string): boolean {
  return attr.appliesTo === 'all' || attr.appliesTo.includes(altId)
}

function levelText(attr: Attribute, levelId: string | undefined): string {
  return levelDisplayText(attr, getLevel(attr, levelId))
}

function imgTag(url: string | undefined, maxH: number): string {
  if (!url) return ''
  return `<img src="${htmlAttr(url)}" alt="" style="max-height:${maxH}px;display:block;margin:0 auto 4px auto;" />`
}

export function renderTaskAsHtml(project: Project, row: DesignRow): string {
  const altOrder = project.builder.alternativeOrder
    .map((id) => project.alternatives.find((a) => a.id === id))
    .filter((a): a is Alternative => !!a)
  const attrOrder = project.builder.attributeOrder
    .map((id) => project.attributes.find((a) => a.id === id))
    .filter((a): a is Attribute => !!a)

  // Scenario context preamble: rendered above the table when present.
  const cvars = project.contextVariables ?? []
  const ctxParts: string[] = []
  for (const cv of cvars) {
    const lid = row.context?.[cv.id]
    if (!lid) continue
    const level = cv.levels.find((l) => l.id === lid)
    if (!level) continue
    const text = level.displayValue ?? String(level.value)
    ctxParts.push(
      `<strong>${htmlText(cv.name)}:</strong> ${htmlText(text)}`,
    )
  }
  const preamble = ctxParts.length
    ? `<p style="margin:0 0 0.5em 0;color:#555;">${ctxParts.join(' &middot; ')}</p>`
    : ''

  const headerCells = altOrder
    .map((a) => `<th>${imgTag(a.imageUrl, 48)}${htmlText(a.label)}</th>`)
    .join('')
  const headerRow = `<tr><th></th>${headerCells}</tr>`

  const bodyRows = attrOrder
    .map((attr) => {
      const cells = altOrder
        .map((alt) => {
          if (alt.isOptOut || !appliesToAlt(attr, alt.id)) return '<td>—</td>'
          const lid = row.cells[cellKey(alt.id, attr.id)]
          const level = getLevel(attr, lid)
          return `<td>${imgTag(level?.imageUrl, 40)}${htmlText(levelText(attr, lid))}</td>`
        })
        .join('')
      const unitSuffix = project.builder.showUnits && attr.unit ? ` (${attr.unit})` : ''
      const attrIcon = attr.imageUrl
        ? `<img src="${htmlAttr(attr.imageUrl)}" alt="" style="height:18px;vertical-align:middle;margin-right:6px;" />`
        : ''
      return `<tr><th>${attrIcon}${htmlText(attr.name + unitSuffix)}</th>${cells}</tr>`
    })
    .join('')

  const stem = `<p style="margin:0 0 0.75em 0;font-weight:600;">${htmlText(questionStem(project))}</p>`
  return `${preamble}${stem}<table border="1" cellpadding="6" cellspacing="0"><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`
}

// === TXT (Qualtrics Advanced Format) ===
// Documented at https://www.qualtrics.com/support/survey-platform/survey-module/survey-tools/import-and-export-surveys/
// Simple, well-supported, easy to verify by eye. Good fallback.

export function txtBlockingNotes(numBlocks: number): string {
  if (numBlocks <= 1) return ''
  return [
    '[[Question:DB]]',
    '[[ID:BLOCKING_NOTES]]',
    '<h3>⚠ Setup notes — DELETE BEFORE DEPLOYING</h3>',
    `<p>This design has <strong>${numBlocks} blocks</strong>, and each respondent must see only one of them. The TXT import cannot set that up, so as imported every respondent would see every block.</p>`,
    '<p>In <strong>Survey flow</strong>: add a <strong>Randomizer</strong>, move every “Block N” under it, set it to randomly present <strong>1</strong> of the elements and tick <strong>Evenly present elements</strong>. Then delete this Setup notes block.</p>',
    '<p>The QSF file from UtilityLab includes this randomizer already.</p>',
    '',
  ].join('\n')
}

const REQUIREMENT_NAME = { request: 'Request response', require: 'Force response' } as const

export function txtResponseNotes(requirement: ResponseRequirement): string {
  if (requirement === 'optional') return ''
  const name = REQUIREMENT_NAME[requirement]
  return [
    '[[Question:DB]]',
    '[[ID:RESPONSE_NOTES]]',
    '<h3>⚠ Setup notes — DELETE BEFORE DEPLOYING</h3>',
    `<p>This study asks respondents to answer every choice task (<strong>${name}</strong>). The TXT import cannot set that, so as imported every choice task is optional.</p>`,
    `<p>Select all the choice-task questions, open <strong>Response requirements</strong> and choose <strong>${name}</strong>. The QSF file from UtilityLab has this set already.</p>`,
    '',
  ].join('\n')
}

// QSF validation for a single-answer question; matches what Qualtrics writes for each option.
export function qsfValidation(requirement: ResponseRequirement) {
  if (requirement === 'require') return { Settings: { ForceResponse: 'ON', ForceResponseType: 'ON', Type: 'None' } }
  if (requirement === 'request')
    return { Settings: { ForceResponse: 'RequestResponse', ForceResponseType: 'RequestResponse', Type: 'None' } }
  return { Settings: { ForceResponse: 'OFF', Type: 'None' } }
}

export function exportTxt(project: Project): string {
  if (!project.design) throw new Error('Project has no design')
  const { rows, numBlocks } = exportBlocks(project.design)
  const altOrder = project.builder.alternativeOrder
    .map((id) => project.alternatives.find((a) => a.id === id))
    .filter((a): a is Alternative => !!a)

  const lines: string[] = ['[[AdvancedFormat]]', '']

  // Advanced Format cannot express survey flow, so blocking and pivot wiring are
  // spelled out in a Setup notes block the researcher deletes after setup.
  const notes = [
    txtBlockingNotes(numBlocks),
    txtResponseNotes(responseRequirement(project)),
    buildTxtCommentBlock(project),
  ].filter(Boolean)
  if (notes.length) lines.push('[[Block:Setup notes]]', '', ...notes)

  for (let b = 1; b <= numBlocks; b++) {
    lines.push(`[[Block:Block ${b}]]`, '')
    const blockRows = rows.filter((r) => r.block === b)
    for (const row of blockRows) {
      lines.push('[[Question:MC:SingleAnswer]]')
      lines.push(`[[ID:Q_${b}_${row.taskId}]]`)
      lines.push(renderTaskAsHtml(project, row))
      lines.push('[[Choices]]')
      for (const alt of altOrder) lines.push(htmlLine(alt.label))
      lines.push('')
    }
  }
  return lines.join('\n')
}

// === QSF (JSON) ===
// Proprietary, undocumented format. Structure below is based on inspection of
// real exports; Qualtrics regenerates IDs on import so randoms here are fine.
// If import fails, the TXT format is the recommended fallback.

function randomId(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

type QsfFlowNode =
  | { Type: 'Standard'; ID: string; FlowID: string; Autofill: [] }
  | {
      Type: 'BlockRandomizer'
      FlowID: string
      SubSet: string
      EvenPresentation: boolean
      Flow: QsfFlowNode[]
    }

export function exportQsf(project: Project): string {
  if (!project.design) throw new Error('Project has no design')
  const { rows, numBlocks } = exportBlocks(project.design)

  const altOrder = project.builder.alternativeOrder
    .map((id) => project.alternatives.find((a) => a.id === id))
    .filter((a): a is Alternative => !!a)

  const surveyId = `SV_${randomId(15)}`
  const ownerId = `UR_${randomId(15)}`
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const blocks: Array<{
    Type: 'Standard'
    Description: string
    ID: string
    BlockElements: Array<{ Type: 'Question'; QuestionID: string }>
  }> = []

  const questions: Array<Record<string, unknown>> = []
  const blockIds: string[] = []
  let qIndex = 1

  for (let b = 1; b <= numBlocks; b++) {
    const blockId = `BL_${randomId(15)}`
    blockIds.push(blockId)
    const blockElements: Array<{ Type: 'Question'; QuestionID: string }> = []
    const blockRows = rows.filter((r) => r.block === b)

    for (const row of blockRows) {
      const qId = `QID${qIndex++}`
      const choices: Record<string, { Display: string }> = {}
      altOrder.forEach((alt, idx) => {
        choices[String(idx + 1)] = { Display: htmlText(alt.label) }
      })
      questions.push({
        SurveyID: surveyId,
        Element: 'SQ',
        PrimaryAttribute: qId,
        SecondaryAttribute: `Choice task ${row.taskId} (Block ${b})`,
        TertiaryAttribute: null,
        Payload: {
          QuestionText: renderTaskAsHtml(project, row),
          DataExportTag: `Q_${b}_${row.taskId}`,
          QuestionType: 'MC',
          Selector: 'SAVR',
          SubSelector: 'TX',
          Configuration: { QuestionDescriptionOption: 'UseText' },
          QuestionDescription: `Choice task ${row.taskId}`,
          Choices: choices,
          ChoiceOrder: altOrder.map((_, i) => String(i + 1)),
          Validation: qsfValidation(responseRequirement(project)),
          Language: [],
          QuestionID: qId,
        },
      })
      blockElements.push({ Type: 'Question', QuestionID: qId })
    }

    blocks.push({
      Type: 'Standard',
      Description: `Block ${b}`,
      ID: blockId,
      BlockElements: blockElements,
    })
  }

  const flowChildren: QsfFlowNode[] =
    blockIds.length > 1
      ? [
          {
            Type: 'BlockRandomizer',
            FlowID: `FL_${randomId(8)}`,
            SubSet: '1',
            EvenPresentation: true,
            Flow: blockIds.map((bid) => ({
              Type: 'Standard',
              ID: bid,
              FlowID: `FL_${randomId(8)}`,
              Autofill: [],
            })),
          },
        ]
      : blockIds.map((bid) => ({
          Type: 'Standard',
          ID: bid,
          FlowID: `FL_${randomId(8)}`,
          Autofill: [],
        }))

  const flowPayload = {
    Type: 'Root',
    FlowID: `FL_${randomId(8)}`,
    Flow: flowChildren,
    Properties: { Count: blockIds.length + 1 },
  }

  const qsf = {
    SurveyEntry: {
      SurveyID: surveyId,
      SurveyName: project.name,
      SurveyDescription: project.description ?? null,
      SurveyOwnerID: ownerId,
      SurveyBrandID: 'utilitylab',
      DivisionID: null,
      SurveyLanguage: 'EN',
      SurveyActiveResponseSet: `RS_${randomId(15)}`,
      SurveyStatus: 'Inactive',
      SurveyStartDate: '0000-00-00 00:00:00',
      SurveyExpirationDate: '0000-00-00 00:00:00',
      SurveyCreationDate: now,
      CreatorID: ownerId,
      LastModified: now,
      LastAccessed: '0000-00-00 00:00:00',
      LastActivated: '0000-00-00 00:00:00',
      Deleted: null,
    },
    SurveyElements: [
      {
        SurveyID: surveyId,
        Element: 'BL',
        PrimaryAttribute: 'Survey Blocks',
        SecondaryAttribute: null,
        TertiaryAttribute: null,
        Payload: blocks,
      },
      {
        SurveyID: surveyId,
        Element: 'FL',
        PrimaryAttribute: 'Survey Flow',
        SecondaryAttribute: null,
        TertiaryAttribute: null,
        Payload: flowPayload,
      },
      {
        SurveyID: surveyId,
        Element: 'SO',
        PrimaryAttribute: 'Survey Options',
        SecondaryAttribute: null,
        TertiaryAttribute: null,
        Payload: {
          BackButton: 'false',
          SaveAndContinue: 'true',
          SurveyProtection: 'PublicSurvey',
        },
      },
      ...questions,
    ],
  }

  return JSON.stringify(qsf, null, 2)
}
