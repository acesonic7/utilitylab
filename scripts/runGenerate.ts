import { travelModeExample } from '../lib/example'
import { generateDesign, suggestNumTasks } from '../lib/designGenerator'
import { computeDError } from '../lib/dOptimal'

console.log('Suggested task counts:', suggestNumTasks(travelModeExample))
console.log()

for (const method of ['random', 'balanced', 'd-optimal'] as const) {
  for (const numTasks of [12, 24]) {
    const t0 = Date.now()
    const result = generateDesign(travelModeExample, {
      numTasks,
      numBlocks: 1,
      method,
      iterations: 1000,
      multistarts: 5,
      seed: 42,
    })
    const elapsed = Date.now() - t0
    const m = result.metrics
    // Always compute D-error for comparison
    const dErr = result.dError ?? computeDError(travelModeExample, result.rows)
    console.log(
      `[${method.padEnd(9)}] N=${numTasks}: score=${result.score.toFixed(1).padStart(6)} ` +
        `D=${dErr.toFixed(3).padEnd(7)} ` +
        `bal=${m.maxBalanceDeviationPct.toFixed(1).padStart(5)}% ` +
        `corr=${m.maxAbsCorrelation.toFixed(2)} ` +
        `dom=${m.dominanceCount} ovl=${m.overlapCount} ` +
        `(${elapsed}ms)`,
    )
  }
}
