import type { Project, DesignRow, Alternative, Attribute } from './schema'
import { cellKey } from './validation'

function getLevel(attr: Attribute, levelId: string | undefined) {
  if (!levelId) return undefined
  return attr.levels.find((l) => l.id === levelId)
}

function appliesToAlt(attr: Attribute, altId: string): boolean {
  return attr.appliesTo === 'all' || attr.appliesTo.includes(altId)
}

function levelText(attr: Attribute, levelId: string | undefined): string {
  const l = getLevel(attr, levelId)
  if (!l) return '—'
  if (l.displayValue) return l.displayValue
  if (attr.unit) return `${l.value} ${attr.unit}`
  return String(l.value)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderTaskAsHtml(project: Project, row: DesignRow): string {
  const altOrder = project.builder.alternativeOrder
    .map((id) => project.alternatives.find((a) => a.id === id))
    .filter((a): a is Alternative => !!a)
  const attrOrder = project.builder.attributeOrder
    .map((id) => project.attributes.find((a) => a.id === id))
    .filter((a): a is Attribute => !!a)

  const headerCells = altOrder.map((a) => `<th>${escapeHtml(a.label)}</th>`).join('')
  const headerRow = `<tr><th></th>${headerCells}</tr>`

  const bodyRows = attrOrder
    .map((attr) => {
      const cells = altOrder
        .map((alt) => {
          if (alt.isOptOut || !appliesToAlt(attr, alt.id)) return '<td>—</td>'
          const lid = row.cells[cellKey(alt.id, attr.id)]
          return `<td>${escapeHtml(levelText(attr, lid))}</td>`
        })
        .join('')
      const unitSuffix = project.builder.showUnits && attr.unit ? ` (${attr.unit})` : ''
      return `<tr><th>${escapeHtml(attr.name + unitSuffix)}</th>${cells}</tr>`
    })
    .join('')

  return `<table border="1" cellpadding="6" cellspacing="0"><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`
}

// === TXT (Qualtrics Advanced Format) ===
// Documented at https://www.qualtrics.com/support/survey-platform/survey-module/survey-tools/import-and-export-surveys/
// Simple, well-supported, easy to verify by eye. Good fallback.

export function exportTxt(project: Project): string {
  if (!project.design) throw new Error('Project has no design')
  const altOrder = project.builder.alternativeOrder
    .map((id) => project.alternatives.find((a) => a.id === id))
    .filter((a): a is Alternative => !!a)

  const lines: string[] = ['[[AdvancedFormat]]', '']

  for (let b = 1; b <= project.design.numBlocks; b++) {
    lines.push(`[[Block:Block ${b}]]`, '')
    const blockRows = project.design.rows.filter((r) => r.block === b)
    for (const row of blockRows) {
      lines.push('[[Question:MC:SingleAnswer]]')
      lines.push(`[[ID:Q_${b}_${row.taskId}]]`)
      lines.push(renderTaskAsHtml(project, row))
      lines.push('[[Choices]]')
      for (const alt of altOrder) lines.push(alt.label)
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

  for (let b = 1; b <= project.design.numBlocks; b++) {
    const blockId = `BL_${randomId(15)}`
    blockIds.push(blockId)
    const blockElements: Array<{ Type: 'Question'; QuestionID: string }> = []
    const blockRows = project.design.rows.filter((r) => r.block === b)

    for (const row of blockRows) {
      const qId = `QID${qIndex++}`
      const choices: Record<string, { Display: string }> = {}
      altOrder.forEach((alt, idx) => {
        choices[String(idx + 1)] = { Display: alt.label }
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
          Validation: { Settings: { ForceResponse: 'OFF', Type: 'None' } },
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
