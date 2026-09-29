import assert from 'node:assert/strict'
import { travelModeExample } from '../lib/example'
import type { Project } from '../lib/schema'
import { validate } from '../lib/validation'
import { buildPriorVector, computeDError, paramLayout } from '../lib/dOptimal'
import { analyzeSample } from '../lib/sampleSize'
import { altIdentities, altIdentity, altStyle, ensureIdentitySlots } from '../lib/altIdentity'
import {
  correlationMatrix,
  designShape,
  diagnosticsByTask,
  findingCounts,
  levelCounts,
} from '../lib/diagnostics'
import { designSignature } from '../lib/signature'

const project = travelModeExample
const report = validate(project)
console.log('Findings:', report.findings.length, report.summary)
console.log('Counts:', JSON.stringify(findingCounts(report)))

console.log('\nCorrelation matrices')
const corrFindings = report.findings.filter((f) => f.check === 'correlation')
let flagged = 0
for (const alt of project.alternatives) {
  const m = correlationMatrix(project, alt.id)
  console.log(`  ${alt.label}: [${m.attrIds.join(', ')}]`)
  for (const p of m.pairs) {
    console.log(`    ${p.a} × ${p.b}  r=${p.r === null ? '—' : p.r.toFixed(3)}  ${p.severity}`)
    if (p.severity === 'ok') continue
    flagged++
    const f = corrFindings.find(
      (x) => x.details.alternativeId === alt.id && x.details.attrA === p.a && x.details.attrB === p.b,
    )
    assert.ok(f, `missing finding for ${alt.id} ${p.a}×${p.b}`)
    assert.equal(f.severity, p.severity)
    assert.equal(f.details.r, p.r)
  }
}
assert.equal(flagged, corrFindings.length)

console.log('\nLevel balance')
const maxPct = 20
for (const row of levelCounts(project)) {
  const counts = row.counts.map((c) => `${c.label}=${c.count}`).join(' ')
  console.log(
    `  [${row.kind}] ${row.name}${row.altId ? ` (${row.altId})` : ''}: ${counts}  ideal ${row.ideal}  max dev ${row.maxDeviation.toFixed(1)}%`,
  )
  assert.equal(row.maxDeviation > maxPct, false)
}
assert.equal(report.summary.balance, 0)

console.log('\nPer choice task')
const byTask = diagnosticsByTask(project, report)
for (const t of byTask) {
  const dom = t.dominated.map((d) => `${d.altId} by ${d.by.join('+')}`).join('; ')
  const ident = t.identical.map(([a, b]) => `${a}≡${b}`).join('; ')
  console.log(`  Block ${t.block} · choice task ${t.taskId}: ${t.findings.length} findings | dominated: ${dom || '—'} | identical: ${ident || '—'}`)
}
assert.equal(
  byTask.reduce((s, t) => s + t.findings.length, 0),
  report.summary.dominance + report.summary.overlap,
)

// Task ids restarting per block must still map findings to the right row.
const renumbered: Project = {
  ...project,
  design: {
    ...project.design!,
    rows: project.design!.rows.map((r) => ({ ...r, taskId: r.block === 2 ? r.taskId - 3 : r.taskId })),
  },
}
const byTaskRenumbered = diagnosticsByTask(renumbered, validate(renumbered))
byTaskRenumbered.forEach((t, i) => {
  assert.deepEqual(t.dominated, byTask[i].dominated)
  assert.deepEqual(t.identical, byTask[i].identical)
})
console.log('  (renumbered per-block task ids map identically)')

console.log('\nEfficiency')
const layout = paramLayout(project)
const priors = buildPriorVector(project, layout)
const dError = computeDError(project, project.design!.rows, priors, layout)
const shape = designShape(project)!
const sample = analyzeSample(project, shape.tasks, shape.blocks)
console.log(`  K=${layout.totalK}  D-error=${dError.toFixed(4)}  priors non-zero=${priors.some((b) => b !== 0)}`)
console.log(`  shape=${JSON.stringify(shape)}  obs/param=${sample.observationsPerParameter} (${sample.status})`)

console.log('\nSignature')
console.log(' ', designSignature(project, { dError }))
console.log(' ', designSignature({ ...project, design: null }, { dError: null }))

console.log('\nIdentity')
for (const id of altIdentities(project)) console.log(`  ${JSON.stringify(id)}  style=${JSON.stringify(altStyle(id))}`)
const seeded = ensureIdentitySlots(project)
assert.notEqual(seeded, project)
assert.equal(ensureIdentitySlots(seeded), seeded)
const swapped: Project = { ...seeded, alternatives: [...seeded.alternatives].reverse() }
for (const alt of seeded.alternatives) {
  assert.deepEqual(altIdentity(swapped, alt.id), altIdentity(seeded, alt.id))
}
const withOptOut: Project = {
  ...seeded,
  alternatives: [
    ...seeded.alternatives.filter((a) => a.id !== 'pt'),
    { id: 'none', label: 'Neither', isOptOut: true, position: 4 },
    { id: 'tram', label: 'Tram', isOptOut: false, position: 5 },
  ],
}
console.log('  after removing pt, adding opt-out and tram:')
for (const id of altIdentities(ensureIdentitySlots(withOptOut))) console.log(`    ${id.label}: slot ${id.slot} ${id.cssVar} ${id.glyph}${id.hollow ? ' hollow' : ''}`)
assert.equal(altIdentity(withOptOut, 'tram').slot, 2)
assert.equal(altIdentity(withOptOut, 'none').cssVar, '--alt-x')

// (a) An alternative switched to opt-out releases its slot; switching back never repaints a newer alternative.
const carToOptOut = ensureIdentitySlots({
  ...seeded,
  alternatives: seeded.alternatives.map((a) => (a.id === 'car' ? { ...a, isOptOut: true } : a)),
})
assert.equal(carToOptOut.alternatives.find((a) => a.id === 'car')!.identitySlot, undefined)
assert.equal(ensureIdentitySlots(carToOptOut), carToOptOut)
const withNew = ensureIdentitySlots({
  ...carToOptOut,
  alternatives: [...carToOptOut.alternatives, { id: 'tram', label: 'Tram', isOptOut: false, position: 4 }],
})
assert.equal(altIdentity(withNew, 'tram').slot, 1)
const carBack = ensureIdentitySlots({
  ...withNew,
  alternatives: withNew.alternatives.map((a) => (a.id === 'car' ? { ...a, isOptOut: false } : a)),
})
assert.equal(altIdentity(carBack, 'tram').slot, 1)
assert.equal(altIdentity(carBack, 'car').slot, 5)
console.log('  opt-out toggle: car releases slot 1, tram keeps it, car returns as slot 5')

// (b) A neutral alternative (slot 7+) takes a coloured slot once one is freed; coloured ones stay put.
const seven: Project = ensureIdentitySlots({
  ...seeded,
  alternatives: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => ({ id, label: id.toUpperCase(), isOptOut: false, position: i })),
})
assert.equal(altIdentity(seven, 'g').cssVar, '--ink-3')
const sixLeft = ensureIdentitySlots({ ...seven, alternatives: seven.alternatives.filter((a) => a.id !== 'c') })
assert.equal(altIdentity(sixLeft, 'g').slot, 3)
assert.equal(altIdentity(sixLeft, 'g').cssVar, '--alt-3')
for (const id of ['a', 'b', 'd', 'e', 'f']) assert.equal(altIdentity(sixLeft, id).slot, altIdentity(seven, id).slot)
assert.equal(ensureIdentitySlots(sixLeft), sixLeft)
console.log('  slot 7 alternative promoted to freed slot 3; others unchanged')

console.log('\nAll assertions passed')
