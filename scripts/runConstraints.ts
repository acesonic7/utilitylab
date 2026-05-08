import { travelModeExample } from '../lib/example'
import { generateDesign } from '../lib/designGenerator'
import { computeDError } from '../lib/dOptimal'
import { countViolations } from '../lib/constraints'
import type { Constraint } from '../lib/schema'

// Build a constrained project: forbid Bus.headway = 5 AND Bus.comfort = Low
const constraint: Constraint = {
  id: 'c1',
  type: 'forbidden_combination',
  alternativeId: 'bus',
  clauses: [
    { attributeId: 'headway', levelId: 'hw_5' },
    { attributeId: 'comfort', levelId: 'comf_low' },
  ],
  enabled: true,
}

const constrained = { ...travelModeExample, constraints: [constraint] }

console.log('Constraint: Forbid Bus.headway=5min AND Bus.comfort=Low')
console.log()

for (const method of ['random', 'balanced', 'd-optimal'] as const) {
  for (const useConstraint of [false, true]) {
    const proj = useConstraint ? constrained : travelModeExample
    const t0 = Date.now()
    const result = generateDesign(proj, {
      numTasks: 12,
      numBlocks: 1,
      method,
      iterations: 1000,
      multistarts: 5,
      seed: 42,
    })
    const elapsed = Date.now() - t0
    const violations = countViolations(result.rows, proj, proj.constraints)
    const dErr = result.dError ?? computeDError(proj, result.rows)
    const tag = useConstraint ? 'with constraint' : 'unconstrained '
    const failTag = result.constraintFailures
      ? ` failures=${result.constraintFailures}`
      : ''
    console.log(
      `[${method.padEnd(9)} ${tag}] D=${dErr.toFixed(3)} ` +
        `bal=${result.metrics.maxBalanceDeviationPct.toFixed(0).padStart(3)}% ` +
        `dom=${result.metrics.dominanceCount} ` +
        `violations=${violations.length} ` +
        `(${elapsed}ms${failTag})`,
    )
  }
}
