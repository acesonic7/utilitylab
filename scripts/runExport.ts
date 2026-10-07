import { mkdirSync, writeFileSync } from 'node:fs'
import { travelModeExample } from '../lib/example'
import { exportTxt, exportQsf } from '../lib/qualtricsExport'
import { exportSawtoothCsv } from '../lib/sawtoothExport'

const slug = travelModeExample.slug
const txt = exportTxt(travelModeExample)
const qsf = exportQsf(travelModeExample)
const sawtoothCsv = exportSawtoothCsv(travelModeExample)

mkdirSync('./out', { recursive: true })
writeFileSync(`./out/${slug}.txt`, txt)
writeFileSync(`./out/${slug}.qsf`, qsf)
writeFileSync(`./out/${slug}-sawtooth.csv`, sawtoothCsv)

console.log(`Wrote out/${slug}.txt (${txt.length} bytes)`)
console.log(`Wrote out/${slug}.qsf (${qsf.length} bytes)`)
console.log(`Wrote out/${slug}-sawtooth.csv (${sawtoothCsv.length} bytes)`)
