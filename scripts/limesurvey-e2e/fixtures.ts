import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { travelModeExample } from '../../lib/example'
import { buildSurveyLss } from '../../lib/limesurveyExport'

// The example study, and a copy with labels that try to break each platform's syntax.
const out = join(__dirname, 'out')
mkdirSync(out, { recursive: true })
const base = structuredClone(travelModeExample)
const hostile = structuredClone(travelModeExample)
hostile.alternatives[0].label = 'Car {BLK.NAOK} ${x} [[Q]] <b>bold</b> & "quote"'
hostile.builder.labels = { ...hostile.builder.labels, questionStem: 'Ποιο θα επιλέγατε για αυτή τη διαδρομή;' }
writeFileSync(join(out, 'athens.lss'), buildSurveyLss(base))
writeFileSync(join(out, 'hostile.lss'), buildSurveyLss(hostile))
writeFileSync(join(out, 'project.json'), JSON.stringify(base))
writeFileSync(join(out, 'hostile.json'), JSON.stringify(hostile))
const required = structuredClone(travelModeExample)
required.builder.responseRequirement = 'require'
writeFileSync(join(out, 'required.lss'), buildSurveyLss(required))
writeFileSync(join(out, 'required.json'), JSON.stringify(required))
