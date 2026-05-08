import type { Project, DesignRow, Alternative } from './schema'
import { renderTaskAsHtml } from './qualtricsExport'

// LimeSurvey export module. Produces:
//   - LSQ XML for a single question (used by the API-push path)
//   - Full LSS XML for the whole survey (used by the file-download fallback)
//
// Both formats are minimal subsets that LimeSurvey 5.x / 6.x will accept on
// import. Tested fields are populated; optional fields are left at safe defaults.

const DB_VERSION = 423 // safe baseline; LS importers accept this range

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cdata(s: string): string {
  // Wrap in CDATA, escaping any pre-existing ]]> sequences.
  return `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
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

// ── LSQ (single question) ─────────────────────────────────────────────────

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
  const alts = activeAlts(project)
  const qCode = questionCode(row.taskId, row.block)
  const html = renderTaskAsHtml(project, row)

  const answersRows = alts
    .map(
      (_, i) => `      <row>
        <code>${answerCode(i)}</code>
        <sortorder>${i + 1}</sortorder>
        <scale_id>0</scale_id>
      </row>`,
    )
    .join('\n')

  const answerL10nRows = alts
    .map(
      (alt) => `      <row>
        <answer>${cdata(alt.label)}</answer>
        <language>${language}</language>
      </row>`,
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <LimeSurveyDocType>Question</LimeSurveyDocType>
  <DBVersion>${DB_VERSION}</DBVersion>
  <languages>
    <language>${language}</language>
  </languages>
  <questions>
    <fields>
      <fieldname>parent_qid</fieldname>
      <fieldname>type</fieldname>
      <fieldname>title</fieldname>
      <fieldname>preg</fieldname>
      <fieldname>other</fieldname>
      <fieldname>mandatory</fieldname>
      <fieldname>question_order</fieldname>
      <fieldname>scale_id</fieldname>
      <fieldname>same_default</fieldname>
      <fieldname>relevance</fieldname>
      <fieldname>encrypted</fieldname>
    </fields>
    <rows>
      <row>
        <parent_qid>0</parent_qid>
        <type>L</type>
        <title>${escapeXml(qCode)}</title>
        <preg></preg>
        <other>N</other>
        <mandatory>N</mandatory>
        <question_order>${questionIndex + 1}</question_order>
        <scale_id>0</scale_id>
        <same_default>0</same_default>
        <relevance>1</relevance>
        <encrypted>N</encrypted>
      </row>
    </rows>
  </questions>
  <question_l10ns>
    <fields>
      <fieldname>question</fieldname>
      <fieldname>help</fieldname>
      <fieldname>language</fieldname>
    </fields>
    <rows>
      <row>
        <question>${cdata(html)}</question>
        <help></help>
        <language>${language}</language>
      </row>
    </rows>
  </question_l10ns>
  <answers>
    <fields>
      <fieldname>code</fieldname>
      <fieldname>sortorder</fieldname>
      <fieldname>scale_id</fieldname>
    </fields>
    <rows>
${answersRows}
    </rows>
  </answers>
  <answer_l10ns>
    <fields>
      <fieldname>answer</fieldname>
      <fieldname>language</fieldname>
    </fields>
    <rows>
${answerL10nRows}
    </rows>
  </answer_l10ns>
</document>`

  return { xml, questionCode: qCode, questionTitle: `Choice task ${row.taskId}` }
}

// ── LSS (full survey) ─────────────────────────────────────────────────────
// For the download-and-import fallback path. Produces a complete survey with
// one group per block, randomization-group set so respondents see one block.

export function buildSurveyLss(project: Project, language = 'en'): string {
  if (!project.design) throw new Error('Project has no design')
  const rows = project.design.rows
  const blocks = Array.from({ length: project.design.numBlocks }, (_, b) => b + 1)

  const groupRows = blocks
    .map(
      (b, i) => `      <row>
        <gid>${b}</gid>
        <sid>1</sid>
        <group_order>${i + 1}</group_order>
        <randomization_group>sp_blocks</randomization_group>
        <grelevance>1</grelevance>
      </row>`,
    )
    .join('\n')

  const groupL10nRows = blocks
    .map(
      (b) => `      <row>
        <gid>${b}</gid>
        <group_name>${cdata(`Block ${b}`)}</group_name>
        <description>${cdata(`Choice tasks for block ${b}`)}</description>
        <language>${language}</language>
      </row>`,
    )
    .join('\n')

  let qid = 1
  const questionRows: string[] = []
  const questionL10nRows: string[] = []
  const answerRows: string[] = []
  const answerL10nRows: string[] = []
  const alts = activeAlts(project)

  for (const row of rows) {
    const code = questionCode(row.taskId, row.block)
    const html = renderTaskAsHtml(project, row)
    questionRows.push(`      <row>
        <qid>${qid}</qid>
        <parent_qid>0</parent_qid>
        <sid>1</sid>
        <gid>${row.block}</gid>
        <type>L</type>
        <title>${escapeXml(code)}</title>
        <preg></preg>
        <other>N</other>
        <mandatory>N</mandatory>
        <question_order>${row.taskId}</question_order>
        <scale_id>0</scale_id>
        <same_default>0</same_default>
        <relevance>1</relevance>
        <encrypted>N</encrypted>
      </row>`)
    questionL10nRows.push(`      <row>
        <qid>${qid}</qid>
        <question>${cdata(html)}</question>
        <help></help>
        <language>${language}</language>
      </row>`)
    alts.forEach((alt, i) => {
      answerRows.push(`      <row>
        <qid>${qid}</qid>
        <code>${answerCode(i)}</code>
        <sortorder>${i + 1}</sortorder>
        <scale_id>0</scale_id>
      </row>`)
      answerL10nRows.push(`      <row>
        <qid>${qid}</qid>
        <code>${answerCode(i)}</code>
        <answer>${cdata(alt.label)}</answer>
        <language>${language}</language>
      </row>`)
    })
    qid++
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <LimeSurveyDocType>Survey</LimeSurveyDocType>
  <DBVersion>${DB_VERSION}</DBVersion>
  <languages>
    <language>${language}</language>
  </languages>
  <surveys>
    <fields>
      <fieldname>sid</fieldname>
      <fieldname>language</fieldname>
      <fieldname>active</fieldname>
      <fieldname>format</fieldname>
      <fieldname>anonymized</fieldname>
      <fieldname>questionindex</fieldname>
      <fieldname>showxquestions</fieldname>
      <fieldname>showgroupinfo</fieldname>
      <fieldname>showqnumcode</fieldname>
      <fieldname>showwelcome</fieldname>
    </fields>
    <rows>
      <row>
        <sid>1</sid>
        <language>${language}</language>
        <active>N</active>
        <format>G</format>
        <anonymized>Y</anonymized>
        <questionindex>0</questionindex>
        <showxquestions>Y</showxquestions>
        <showgroupinfo>B</showgroupinfo>
        <showqnumcode>X</showqnumcode>
        <showwelcome>Y</showwelcome>
      </row>
    </rows>
  </surveys>
  <surveys_languagesettings>
    <fields>
      <fieldname>surveyls_survey_id</fieldname>
      <fieldname>surveyls_language</fieldname>
      <fieldname>surveyls_title</fieldname>
      <fieldname>surveyls_description</fieldname>
    </fields>
    <rows>
      <row>
        <surveyls_survey_id>1</surveyls_survey_id>
        <surveyls_language>${language}</surveyls_language>
        <surveyls_title>${cdata(project.name)}</surveyls_title>
        <surveyls_description>${cdata(project.description ?? '')}</surveyls_description>
      </row>
    </rows>
  </surveys_languagesettings>
  <groups>
    <fields>
      <fieldname>gid</fieldname>
      <fieldname>sid</fieldname>
      <fieldname>group_order</fieldname>
      <fieldname>randomization_group</fieldname>
      <fieldname>grelevance</fieldname>
    </fields>
    <rows>
${groupRows}
    </rows>
  </groups>
  <group_l10ns>
    <fields>
      <fieldname>gid</fieldname>
      <fieldname>group_name</fieldname>
      <fieldname>description</fieldname>
      <fieldname>language</fieldname>
    </fields>
    <rows>
${groupL10nRows}
    </rows>
  </group_l10ns>
  <questions>
    <fields>
      <fieldname>qid</fieldname>
      <fieldname>parent_qid</fieldname>
      <fieldname>sid</fieldname>
      <fieldname>gid</fieldname>
      <fieldname>type</fieldname>
      <fieldname>title</fieldname>
      <fieldname>preg</fieldname>
      <fieldname>other</fieldname>
      <fieldname>mandatory</fieldname>
      <fieldname>question_order</fieldname>
      <fieldname>scale_id</fieldname>
      <fieldname>same_default</fieldname>
      <fieldname>relevance</fieldname>
      <fieldname>encrypted</fieldname>
    </fields>
    <rows>
${questionRows.join('\n')}
    </rows>
  </questions>
  <question_l10ns>
    <fields>
      <fieldname>qid</fieldname>
      <fieldname>question</fieldname>
      <fieldname>help</fieldname>
      <fieldname>language</fieldname>
    </fields>
    <rows>
${questionL10nRows.join('\n')}
    </rows>
  </question_l10ns>
  <answers>
    <fields>
      <fieldname>qid</fieldname>
      <fieldname>code</fieldname>
      <fieldname>sortorder</fieldname>
      <fieldname>scale_id</fieldname>
    </fields>
    <rows>
${answerRows.join('\n')}
    </rows>
  </answers>
  <answer_l10ns>
    <fields>
      <fieldname>qid</fieldname>
      <fieldname>code</fieldname>
      <fieldname>answer</fieldname>
      <fieldname>language</fieldname>
    </fields>
    <rows>
${answerL10nRows.join('\n')}
    </rows>
  </answer_l10ns>
</document>`
}

// Per-block group properties for the API-push path.
export type BlockGroupConfig = {
  groupName: string
  groupDescription: string
  randomizationGroup: string // shared across blocks → 1-of-N
  randomizeQuestions: boolean
}

export function blockGroupConfig(
  blockNumber: number,
  randomizeQuestions = true,
): BlockGroupConfig {
  return {
    groupName: `Block ${blockNumber}`,
    groupDescription: `Choice tasks for block ${blockNumber}`,
    randomizationGroup: 'sp_blocks',
    randomizeQuestions,
  }
}
