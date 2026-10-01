import type { Project, Attribute, Level } from './schema'
import { levelDisplayText, pivotDeltaText } from './format'

// Syntax follows the platforms' documentation:
// - Qualtrics Math Operations: $e{ ... } with space-separated items, piped fields written without
//   ${ }, round(x, 2) for decimals; plain piped text followed by "+10" is printed, not computed.
//   https://www.qualtrics.com/support/survey-platform/survey-module/editing-questions/piped-text/math-operations/
// - LimeSurvey ExpressionScript: {CODE.NAOK + 10}, no whitespace just inside the braces,
//   round(val, precision). Question codes start with a letter and are alphanumeric only.
//   https://www.limesurvey.org/manual/ExpressionScript_-_Presentation
//   https://www.limesurvey.org/manual/Questions_-_introduction

// Letters and digits only, starting with a letter: valid as a LimeSurvey question code and as a
// Qualtrics embedded-data field name. Kept to 20 characters, within LimeSurvey's code length.
function cleanToken(raw: string): string {
  const alnum = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const lettered = /^[A-Z]/.test(alnum) ? alnum : `REF${alnum}`
  return lettered.slice(0, 20)
}

/** The default token: from the attribute's name, so a renamed attribute doesn't keep REF_NEW_ATTRIBUTE. */
export function defaultToken(attr: Attribute): string {
  return cleanToken(`REF${attr.name || attr.id}`)
}

export function tokenFor(attr: Attribute): string {
  const custom = attr.pivot?.referenceToken?.trim()
  return custom ? cleanToken(custom) : defaultToken(attr)
}

/** The token as the user typed it, when it had to be changed to be valid on both platforms. */
function tokenChanged(attr: Attribute): string | null {
  const custom = attr.pivot?.referenceToken?.trim()
  return custom && cleanToken(custom) !== custom ? custom : null
}

export function pivotedAttributes(project: Project): Attribute[] {
  return project.attributes.filter(
    (a) =>
      a.pivot &&
      a.pivot.mode !== 'none' &&
      a.pivot.previewReference !== undefined &&
      Number.isFinite(a.pivot.previewReference),
  )
}

export function hasPivotedAttributes(project: Project): boolean {
  return pivotedAttributes(project).length > 0
}

type Platform = 'qualtrics' | 'limesurvey'

// The arithmetic on the respondent's reference value, as each platform writes it.
function expressionFor(attr: Attribute, value: number, platform: Platform): string {
  const token = tokenFor(attr)
  const relative = attr.pivot?.mode === 'relative'
  if (platform === 'qualtrics') {
    const field = `e://Field/${token}`
    if (relative) return value === 1 ? `\${${field}}` : `$e{ round( ${field} * ${value} , 2 ) }`
    if (value === 0) return `\${${field}}`
    return `$e{ ${field} ${value > 0 ? '+' : '-'} ${Math.abs(value)} }`
  }
  const ref = `${token}.NAOK`
  if (relative) return value === 1 ? `{${ref}}` : `{round(${ref} * ${value}, 2)}`
  if (value === 0) return `{${ref}}`
  return `{${ref} ${value > 0 ? '+' : '-'} ${Math.abs(value)}}`
}

// The replacement for a whole cell: the expression wrapped in the same currency symbol, unit and
// bracketed change the exported cell shows, so only the number becomes per-respondent.
function cellReplacement(attr: Attribute, level: Level, platform: Platform): string {
  const expr = expressionFor(attr, Number(level.value), platform)
  const unit = attr.unit
  let text: string
  if (attr.displayFormat === 'currency') {
    const symbol = unit === 'EUR' ? '€' : unit === 'USD' ? '$' : unit === 'GBP' ? '£' : null
    text = symbol ? `${symbol}${expr}` : unit ? `${expr} ${unit}` : expr
  } else if (attr.displayFormat === 'percent') text = `${expr}%`
  else if (attr.displayFormat === 'duration') text = `${expr} ${unit || 'min'}`
  else text = unit ? `${expr} ${unit}` : expr
  const delta = pivotDeltaText(level, attr.pivot)
  return delta && delta !== 'no change' ? `${text} (${delta})` : text
}

// Every level set of the attribute: the default levels, and each alternative's own levels.
function levelSets(project: Project, attr: Attribute): { heading: string | null; levels: Level[] }[] {
  const sets: { heading: string | null; levels: Level[] }[] = [{ heading: null, levels: attr.levels }]
  for (const [altId, levels] of Object.entries(attr.levelsByAlternative ?? {})) {
    if (!levels.length) continue
    const alt = project.alternatives.find((a) => a.id === altId)
    sets.push({ heading: `${alt?.label ?? altId} (its own levels)`, levels })
  }
  if (sets.length > 1) sets[0].heading = 'Other alternatives'
  return sets
}

function substitutionTable(project: Project, attr: Attribute, platform: Platform, lines: string[]) {
  for (const set of levelSets(project, attr)) {
    if (set.heading) lines.push(`   *${set.heading}*`, ``)
    lines.push(`   | Exported cell shows | Replace it with |`, `   |---|---|`)
    for (const lvl of set.levels) {
      lines.push(`   | \`${levelDisplayText(attr, lvl)}\` | \`${cellReplacement(attr, lvl, platform)}\` |`)
    }
    lines.push(``)
  }
}

function modeText(attr: Attribute): string {
  return attr.pivot!.mode === 'absolute' ? 'reference + offset' : 'reference × multiplier'
}

export function buildWiringGuide(project: Project): string {
  const pivoted = pivotedAttributes(project)
  if (pivoted.length === 0) {
    return `# Pivot wiring guide\n\nProject: **${project.name}** (\`${project.slug}\`)\n\nThis design has no pivoted attributes, so there is nothing to wire up.\n`
  }

  const lines: string[] = []
  lines.push(`# Pivot wiring guide`, ``)
  lines.push(`Project: **${project.name}** (\`${project.slug}\`)`, ``)
  lines.push(
    `This study has **pivoted attributes**: their levels are meant to be calculated from each respondent's own value (for example their usual travel time). The exported files show every respondent the same values, calculated from a fixed preview reference. To pivot on each respondent's own value, follow the steps for your platform below. Each table lists the exact text a cell shows in the exported survey and what to put in its place.`,
    ``,
  )

  lines.push(`## Pivoted attributes`, ``)
  lines.push(`| Attribute | Token | Calculation | Preview reference |`, `|---|---|---|---|`)
  for (const attr of pivoted) {
    const ref = attr.pivot!.previewReference!
    lines.push(`| ${attr.name} | \`${tokenFor(attr)}\` | ${modeText(attr)} | ${ref}${attr.unit ? ' ' + attr.unit : ''} |`)
  }
  lines.push(``)
  const changed = pivoted.filter(tokenChanged)
  if (changed.length) {
    for (const attr of changed) {
      lines.push(
        `> The token \`${tokenChanged(attr)}\` set for ${attr.name} is written \`${tokenFor(attr)}\` here: LimeSurvey question codes may contain only letters and digits and must start with a letter.`,
      )
    }
    lines.push(``)
  }

  lines.push(`## Qualtrics`, ``)
  lines.push(
    `1. **Ask for each reference value early in the survey**, in a text-entry question with numeric validation (one per pivoted attribute).`,
    `2. **In Survey flow, add an Embedded Data element** before the choice tasks that sets each token to the respondent's answer:`,
  )
  for (const attr of pivoted) {
    lines.push(`   - \`${tokenFor(attr)}\` = \`\${q://QID_X/ChoiceTextEntryValue}\` (replace \`QID_X\` with the reference question's ID)`)
  }
  lines.push(
    `3. **Replace the cells in every choice task.** Open each question's HTML view (not the rich-text editor, which can insert non-breaking spaces that stop the calculation) and replace each cell's text as below. Keep the spaces inside \`$e{ … }\`: Qualtrics requires them.`,
    ``,
  )
  for (const attr of pivoted) {
    lines.push(`   ### ${attr.name} (\`${tokenFor(attr)}\`)`, ``)
    substitutionTable(project, attr, 'qualtrics', lines)
  }
  lines.push(`4. **Test with the survey link, not only Preview.** Qualtrics notes that some piped math works in preview but not in the live survey if written incorrectly.`, ``)

  lines.push(`## LimeSurvey`, ``)
  lines.push(
    `1. **Ask for each reference value early in the survey** in a Numerical input question whose question code is the token (for example \`${tokenFor(pivoted[0])}\`).`,
    `2. **Replace the cells in every choice task** with ExpressionScript, as below. Don't put spaces just inside the curly braces, or LimeSurvey shows the text instead of calculating it. \`.NAOK\` keeps the value available whatever the question's relevance.`,
    ``,
  )
  for (const attr of pivoted) {
    lines.push(`   ### ${attr.name} (\`${tokenFor(attr)}\`)`, ``)
    substitutionTable(project, attr, 'limesurvey', lines)
  }

  lines.push(`## Values to check`, ``)
  lines.push(
    `Neither platform limits the result. A respondent with a small reference value and a negative offset can see a negative or zero time or price. Add validation to the reference questions (a minimum value) so every calculated level stays plausible.`,
    ``,
  )

  lines.push(`---`, ``)
  lines.push(`Generated by UtilityLab. Download the guide again whenever the design or the levels change.`, ``)
  return lines.join('\n')
}

// Qualtrics-safe inline preamble (a Description Block question) summarising
// pivot wiring. Prepended to TXT exports; the user deletes it before
// deploying or replaces it with the actual reference questions.
export function buildTxtCommentBlock(project: Project): string {
  const pivoted = pivotedAttributes(project)
  if (pivoted.length === 0) return ''
  const lines: string[] = [
    '[[Question:DB]]',
    '[[ID:WIRING_NOTES]]',
    '<h3>⚠ Setup notes — DELETE OR REPLACE BEFORE DEPLOYING</h3>',
    '<p>This survey uses <strong>pivoted attributes</strong>. The cells in choice tasks currently show <em>preview values</em> — you must replace them with piped expressions referring to per-respondent reference data.</p>',
    '<p>Pivoted attributes:</p>',
    '<ul>',
  ]
  for (const attr of pivoted) {
    const token = tokenFor(attr)
    const mode =
      attr.pivot!.mode === 'relative' ? 'multiplier of reference' : 'delta from reference'
    lines.push(
      `<li><strong>${attr.name}</strong> — token <code>${token}</code> (${mode})</li>`,
    )
  }
  lines.push('</ul>')
  lines.push(
    `<p>See the <code>${project.slug}-wiring-guide.md</code> file (downloadable from UtilityLab) for the full per-platform substitution table.</p>`,
  )
  lines.push('')
  return lines.join('\n')
}
