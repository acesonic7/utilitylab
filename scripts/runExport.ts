import { writeFileSync } from 'node:fs'
import { travelModeExample } from '../lib/example'
import { exportTxt, exportQsf } from '../lib/qualtricsExport'

const slug = travelModeExample.slug
const txt = exportTxt(travelModeExample)
const qsf = exportQsf(travelModeExample)

writeFileSync(`./out/${slug}.txt`, txt)
writeFileSync(`./out/${slug}.qsf`, qsf)

console.log(`Wrote out/${slug}.txt (${txt.length} bytes)`)
console.log(`Wrote out/${slug}.qsf (${qsf.length} bytes)`)
