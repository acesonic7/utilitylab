import { travelModeExample } from '../lib/example'
import { validate } from '../lib/validation'

const report = validate(travelModeExample)

console.log(`Validation report — ${report.ranAt}`)
console.log(`Summary:`, report.summary)
console.log(`---`)
for (const f of report.findings) {
  console.log(`[${f.check}/${f.severity}] ${f.message}`)
}
if (report.findings.length === 0) {
  console.log(`(no findings)`)
}
