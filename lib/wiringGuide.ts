import type { Project, Attribute } from './schema'

export function tokenFor(attr: Attribute): string {
  if (attr.pivot?.referenceToken) return attr.pivot.referenceToken
  return `REF_${attr.id.toUpperCase()}`
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

function levelLabel(attr: Attribute, value: number): string {
  if (attr.pivot?.mode === 'relative') return `${value}×`
  if (attr.pivot?.mode === 'absolute') {
    return value >= 0 ? `+${value}` : String(value)
  }
  return String(value)
}

function expressionFor(attr: Attribute, value: number, platform: 'qualtrics' | 'limesurvey'): string {
  const token = tokenFor(attr)
  if (attr.pivot?.mode === 'relative') {
    return platform === 'qualtrics'
      ? `\${e://Field/${token}}*${value}`
      : `{${token}*${value}}`
  }
  // absolute
  if (platform === 'qualtrics') {
    if (value === 0) return `\${e://Field/${token}}`
    return value > 0
      ? `\${e://Field/${token}}+${value}`
      : `\${e://Field/${token}}${value}` // negative value already starts with -
  }
  if (value === 0) return `{${token}}`
  return value > 0 ? `{${token}+${value}}` : `{${token}${value}}`
}

export function buildWiringGuide(project: Project): string {
  const pivoted = pivotedAttributes(project)
  if (pivoted.length === 0) {
    return `# Pivot wiring guide\n\nProject: **${project.name}** (\`${project.slug}\`)\n\nThis design has no pivoted attributes — nothing to wire up.\n`
  }

  const lines: string[] = []
  lines.push(`# Pivot wiring guide`)
  lines.push(``)
  lines.push(`Project: **${project.name}** (\`${project.slug}\`)`)
  lines.push(``)
  lines.push(
    `This survey uses **pivoted attributes** — values that should be calculated relative to each respondent's own answers. The exported choice tasks currently show *resolved values* using a fixed preview reference. To deploy with per-respondent values, follow the platform-specific steps below.`,
  )
  lines.push(``)

  // Table of pivoted attributes
  lines.push(`## Pivoted attributes`)
  lines.push(``)
  lines.push(`| Attribute | Token | Mode | Preview reference | Levels |`)
  lines.push(`|---|---|---|---|---|`)
  for (const attr of pivoted) {
    const token = tokenFor(attr)
    const mode = attr.pivot!.mode === 'absolute' ? 'delta' : 'multiplier'
    const ref = attr.pivot!.previewReference!
    const refStr = `${ref}${attr.unit ? ' ' + attr.unit : ''}`
    const levelStr = attr.levels.map((l) => levelLabel(attr, Number(l.value))).join(', ')
    lines.push(`| ${attr.name} | \`${token}\` | ${mode} | ${refStr} | ${levelStr} |`)
  }
  lines.push(``)

  // Qualtrics
  lines.push(`## Qualtrics`)
  lines.push(``)
  lines.push(
    `1. **Add a reference question early in the survey** capturing each respondent's value (one per pivoted attribute). Use a numeric or text-entry question.`,
  )
  lines.push(`2. **Set Embedded Data via Survey Flow** to store each response under the token name:`)
  for (const attr of pivoted) {
    const token = tokenFor(attr)
    lines.push(`   - \`${token} = \${q://QID_X/ChoiceTextEntryValue}\` (replace \`QID_X\` with the actual question ID)`)
  }
  lines.push(``)
  lines.push(
    `3. **Replace preview values in each choice task** with piped expressions. For every pivoted attribute, find the table cells showing its preview values and substitute as follows:`,
  )
  lines.push(``)
  for (const attr of pivoted) {
    const token = tokenFor(attr)
    lines.push(`   ### ${attr.name} (\`${token}\`)`)
    lines.push(``)
    for (const lvl of attr.levels) {
      const v = Number(lvl.value)
      const lbl = levelLabel(attr, v)
      const expr = expressionFor(attr, v, 'qualtrics')
      lines.push(`   - Cells showing **${lbl}** → \`${expr}\``)
    }
    lines.push(``)
  }

  // LimeSurvey
  lines.push(`## LimeSurvey`)
  lines.push(``)
  lines.push(
    `1. **Add a reference question early in the survey** with question code matching the token name (e.g. \`${tokenFor(pivoted[0])}\`). Numeric type recommended.`,
  )
  lines.push(
    `2. **Use Expression Manager** to substitute the preview values in each choice task with expressions:`,
  )
  lines.push(``)
  for (const attr of pivoted) {
    const token = tokenFor(attr)
    lines.push(`   ### ${attr.name} (\`${token}\`)`)
    lines.push(``)
    for (const lvl of attr.levels) {
      const v = Number(lvl.value)
      const lbl = levelLabel(attr, v)
      const expr = expressionFor(attr, v, 'limesurvey')
      lines.push(`   - Cells showing **${lbl}** → \`${expr}\``)
    }
    lines.push(``)
  }

  // Currency note
  const hasCurrency = pivoted.some((a) => a.displayFormat === 'currency')
  if (hasCurrency) {
    lines.push(`## Currency formatting`)
    lines.push(``)
    lines.push(
      `Both platforms render piped numbers without a currency symbol. Prefix the symbol manually in the question text:`,
    )
    lines.push(``)
    lines.push(`- Qualtrics: \`€\${e://Field/REF_COST}*0.5\``)
    lines.push(`- LimeSurvey: \`€{REF_COST*0.5}\` (or use \`number_format()\` for fixed decimals)`)
    lines.push(``)
  }

  lines.push(`---`)
  lines.push(``)
  lines.push(
    `Generated by UtilityLab. Update the export and regenerate this guide whenever the design changes.`,
  )
  lines.push(``)
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
