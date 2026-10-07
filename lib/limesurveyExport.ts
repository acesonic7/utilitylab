import type { Project, DesignRow, Alternative } from './schema'
import { renderTaskAsHtml } from './qualtricsExport'
import { htmlText, stripControl } from './surveyText'
import { exportBlocks } from './blocks'

// LimeSurvey export module. Produces:
//   - LSQ XML for a single question (used by the API-push path)
//   - Full LSS XML for the whole survey (used by the file-download fallback)
//
// Both formats are minimal subsets that LimeSurvey 5.x / 6.x will accept on
// import. Tested fields are populated; optional fields are left at safe defaults.

const DB_VERSION = 423 // safe baseline; LS importers accept this range

function escapeXml(s: string): string {
  return stripControl(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cdata(s: string): string {
  // Wrap in CDATA, escaping any pre-existing ]]> sequences.
  return `<![CDATA[${stripControl(s).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

function activeAlts(project: Project): Alternative[] {
  return project.builder.alternativeOrder
    .map((id) => project.alternatives.find((a) => a.id === id))
    .filter((a): a is Alternative => !!a)
}

// LimeSurvey question codes are limited to alphanumerics, max ~20 chars.
function questionCode(taskId: number, blockId: number): string {
  return `CT${blockId}T${taskId}`
}

function answerCode(idx: number): string {
  // 'A' + 1-based index (LimeSurvey accepts up to ~5-char codes).
  return `A${idx + 1}`
}

// ── shared question model ─────────────────────────────────────────────────
// LimeSurvey 4+ links translations and attributes by qid and answers' texts by aid,
// so every question and answer carries ids that are local to the file.

export const BLOCK_QUESTION_CODE = 'BLK'

type Attr = { attribute: string; value: string }

type QuestionSpec = {
  qid: number
  gid: number
  type: string
  code: string
  text: string
  order: number
  answers: string[]
  attributes: Attr[]
}

type AnswerSpec = { aid: number; qid: number; code: string; order: number; text: string }

// Keeps a block's choice tasks in the block but shuffles their order per respondent.
function blockRandomGroup(block: number): string {
  return `blk${block}`
}

export function blockRelevance(block: number): string {
  return `${BLOCK_QUESTION_CODE}.NAOK == ${block}`
}

// Picks one block per respondent on first display and keeps it on reload; saved as BLK.
export function blockAssignmentEquation(numBlocks: number): string {
  return `{if(is_empty(${BLOCK_QUESTION_CODE}.NAOK), rand(1, ${numBlocks}), ${BLOCK_QUESTION_CODE}.NAOK)}`
}

function choiceTaskSpec(project: Project, row: DesignRow, qid: number, gid: number, order: number): QuestionSpec {
  const attributes: Attr[] =
    project.design && exportBlocks(project.design).numBlocks > 1
      ? [{ attribute: 'random_group', value: blockRandomGroup(row.block) }]
      : []
  return {
    qid,
    gid,
    type: 'L',
    code: questionCode(row.taskId, row.block),
    text: renderTaskAsHtml(project, row),
    order,
    answers: activeAlts(project).map((a) => htmlText(a.label)),
    attributes,
  }
}

function blockQuestionSpec(numBlocks: number, qid: number, gid: number): QuestionSpec {
  return {
    qid,
    gid,
    type: '*',
    code: BLOCK_QUESTION_CODE,
    text: blockAssignmentEquation(numBlocks),
    order: 1,
    answers: [],
    attributes: [{ attribute: 'hidden', value: '1' }],
  }
}

function answersOf(q: QuestionSpec, firstAid: number): AnswerSpec[] {
  return q.answers.map((text, i) => ({ aid: firstAid + i, qid: q.qid, code: answerCode(i), order: i + 1, text }))
}

function section(name: string, fields: string[], rows: string[]): string {
  return `  <${name}>
    <fields>
${fields.map((f) => `      <fieldname>${f}</fieldname>`).join('\n')}
    </fields>
    <rows>
${rows.join('\n')}
    </rows>
  </${name}>`
}

function row(cells: Record<string, string | number>): string {
  const inner = Object.entries(cells)
    .map(([k, v]) => `        <${k}>${v}</${k}>`)
    .join('\n')
  return `      <row>\n${inner}\n      </row>`
}

function questionSections(questions: QuestionSpec[], language: string, withSid: boolean): string {
  const answers: AnswerSpec[] = []
  for (const q of questions) answers.push(...answersOf(q, answers.length + 1))
  const qRows = questions.map((q) =>
    row({
      qid: q.qid,
      parent_qid: 0,
      ...(withSid ? { sid: 1 } : {}),
      gid: q.gid,
      type: q.type,
      title: escapeXml(q.code),
      preg: '',
      other: 'N',
      mandatory: 'N',
      question_order: q.order,
      scale_id: 0,
      same_default: 0,
      relevance: 1,
      encrypted: 'N',
    }),
  )
  const qFields = ['qid', 'parent_qid', ...(withSid ? ['sid'] : []), 'gid', 'type', 'title', 'preg', 'other', 'mandatory', 'question_order', 'scale_id', 'same_default', 'relevance', 'encrypted']
  const l10n = questions.map((q) => row({ qid: q.qid, question: cdata(q.text), help: '', language }))
  const attrs = questions.flatMap((q) =>
    q.attributes.map((a) => row({ qid: q.qid, attribute: a.attribute, value: cdata(a.value), language: '' })),
  )
  const parts = [
    section('questions', qFields, qRows),
    section('question_l10ns', ['qid', 'question', 'help', 'language'], l10n),
  ]
  if (answers.length) {
    parts.push(
      section(
        'answers',
        ['aid', 'qid', 'code', 'sortorder', 'scale_id'],
        answers.map((a) => row({ aid: a.aid, qid: a.qid, code: a.code, sortorder: a.order, scale_id: 0 })),
      ),
      section(
        'answer_l10ns',
        ['aid', 'answer', 'language'],
        answers.map((a) => row({ aid: a.aid, answer: cdata(a.text), language })),
      ),
    )
  }
  if (attrs.length) parts.push(section('question_attributes', ['qid', 'attribute', 'value', 'language'], attrs))
  return parts.join('\n')
}

function lsqDocument(q: QuestionSpec, language: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <LimeSurveyDocType>Question</LimeSurveyDocType>
  <DBVersion>${DB_VERSION}</DBVersion>
  <languages>
    <language>${language}</language>
  </languages>
${questionSections([q], language, false)}
</document>`
}

// ── LSQ (single question, API push) ───────────────────────────────────────

export type LsqOutput = {
  xml: string
  questionCode: string
  questionTitle: string
}

export function buildQuestionLsq(
  project: Project,
  row: DesignRow,
  questionIndex: number,
  language = 'en',
): LsqOutput {
  const q = choiceTaskSpec(project, row, 1, 1, questionIndex + 1)
  return { xml: lsqDocument(q, language), questionCode: q.code, questionTitle: `Choice task ${row.taskId}` }
}

export function buildBlockAssignmentLsq(numBlocks: number, language = 'en'): LsqOutput {
  const q = blockQuestionSpec(numBlocks, 1, 1)
  return { xml: lsqDocument(q, language), questionCode: q.code, questionTitle: 'Block assignment' }
}

// ── LSS (full survey, file download) ──────────────────────────────────────
// With more than one block, group 1 holds the hidden BLK equation and each block's
// group is shown only when BLK equals its number, so every respondent sees one block.

export function buildSurveyLss(project: Project, language = 'en'): string {
  if (!project.design) throw new Error('Project has no design')
  const { rows, numBlocks } = exportBlocks(project.design)
  const blocks = Array.from({ length: numBlocks }, (_, b) => b + 1)
  const assign = numBlocks > 1
  const gidFor = (b: number) => (assign ? b + 1 : b)

  const groups = [
    ...(assign ? [{ gid: 1, order: 1, relevance: '1', name: 'Block assignment' }] : []),
    ...blocks.map((b) => ({
      gid: gidFor(b),
      order: assign ? b + 1 : b,
      relevance: assign ? blockRelevance(b) : '1',
      name: numBlocks > 1 ? `Block ${b}` : 'Choice tasks',
    })),
  ]

  const questions: QuestionSpec[] = []
  if (assign) questions.push(blockQuestionSpec(numBlocks, 1, 1))
  rows.forEach((r, i) => questions.push(choiceTaskSpec(project, r, questions.length + 1, gidFor(r.block), i + 1)))

  return `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <LimeSurveyDocType>Survey</LimeSurveyDocType>
  <DBVersion>${DB_VERSION}</DBVersion>
  <languages>
    <language>${language}</language>
  </languages>
${section(
  'surveys',
  ['sid', 'language', 'active', 'format', 'anonymized', 'questionindex', 'showxquestions', 'showgroupinfo', 'showqnumcode', 'showwelcome'],
  [
    row({
      sid: 1,
      language,
      active: 'N',
      format: 'G',
      anonymized: 'Y',
      questionindex: 0,
      showxquestions: 'N',
      // Respondents never see which block they are in.
      showgroupinfo: 'N',
      showqnumcode: 'X',
      showwelcome: 'Y',
    }),
  ],
)}
${section(
  'surveys_languagesettings',
  ['surveyls_survey_id', 'surveyls_language', 'surveyls_title', 'surveyls_description'],
  [
    row({
      surveyls_survey_id: 1,
      surveyls_language: language,
      surveyls_title: cdata(project.name),
      surveyls_description: cdata(project.description ?? ''),
    }),
  ],
)}
${section(
  'groups',
  ['gid', 'sid', 'group_order', 'randomization_group', 'grelevance'],
  groups.map((g) => row({ gid: g.gid, sid: 1, group_order: g.order, randomization_group: '', grelevance: cdata(g.relevance) })),
)}
${section(
  'group_l10ns',
  ['gid', 'group_name', 'description', 'language'],
  groups.map((g) => row({ gid: g.gid, group_name: cdata(g.name), description: '', language })),
)}
${questionSections(questions, language, true)}
</document>`
}
