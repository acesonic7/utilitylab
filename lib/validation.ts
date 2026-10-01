import type { Project, Attribute, Alternative, DesignRow, Level, ValidationConfig } from './schema'
import { findLevelInAttr } from './levelLookup'

export const defaultValidationConfig: ValidationConfig = {
  dominance: { enabled: true },
  balance: { enabled: true, maxDeviationPct: 20 },
  correlation: { enabled: true, warnThreshold: 0.3, concernThreshold: 0.5 },
  overlap: { enabled: true },
}

export type Severity = 'warning' | 'concern'

export type Finding = {
  check: 'dominance' | 'balance' | 'correlation' | 'overlap'
  severity: Severity
  message: string
  details: Record<string, unknown>
}

export type Report = {
  ranAt: string
  findings: Finding[]
  summary: { dominance: number; balance: number; correlation: number; overlap: number }
}

export function cellKey(altId: string, attrId: string): string {
  return `${altId}.${attrId}`
}

export function appliesToAlt(attr: Attribute, altId: string): boolean {
  return attr.appliesTo === 'all' || attr.appliesTo.includes(altId)
}

export function getLevel(attr: Attribute, levelId: string | undefined): Level | undefined {
  if (!levelId) return undefined
  return findLevelInAttr(attr, levelId)
}

// Numeric: the value. Boolean: 1 for true, 0 for false, so "higher is better" means true is
// better whatever order the levels are listed in. Categorical: the level's position.
export function getScalar(attr: Attribute, level: Level): number {
  if (attr.type === 'numeric') return Number(level.value)
  if (attr.type === 'boolean') {
    const v = level.value
    return v === true || v === 1 || (typeof v === 'string' && /^(true|yes|1)$/i.test(v.trim())) ? 1 : 0
  }
  return level.position
}

/**
 * The attributes compared, when A dominates B in this choice task: at least as good on
 * every attribute shown for either, and better on one. Null when it doesn't, or when that can't be
 * judged: an attribute that differs has no preference direction, an attribute is shown for only
 * one of them, or the experiment is labeled (the labels themselves carry utility).
 */
export function dominance(project: Project, row: DesignRow, A: Alternative, B: Alternative): string[] | null {
  if (project.experimentType === 'labeled') return null
  const compared: string[] = []
  let better = false
  for (const attr of project.attributes) {
    const onA = appliesToAlt(attr, A.id)
    const onB = appliesToAlt(attr, B.id)
    if (!onA && !onB) continue
    if (onA !== onB) return null
    const lA = getLevel(attr, row.cells[cellKey(A.id, attr.id)])
    const lB = getLevel(attr, row.cells[cellKey(B.id, attr.id)])
    if (!lA || !lB) return null
    compared.push(attr.id)
    const sA = getScalar(attr, lA)
    const sB = getScalar(attr, lB)
    if (sA === sB) continue
    const dir = attr.preferenceDirection ?? 'none'
    if (dir === 'none') return null
    if (dir === 'higher' ? sA < sB : sA > sB) return null
    better = true
  }
  return better ? compared : null
}

export function resolveValidationConfig(
  project: Project,
  override?: Partial<ValidationConfig>,
): ValidationConfig {
  return {
    dominance: { ...defaultValidationConfig.dominance, ...project.validationConfig?.dominance, ...override?.dominance },
    balance: { ...defaultValidationConfig.balance, ...project.validationConfig?.balance, ...override?.balance },
    correlation: { ...defaultValidationConfig.correlation, ...project.validationConfig?.correlation, ...override?.correlation },
    overlap: { ...defaultValidationConfig.overlap, ...project.validationConfig?.overlap, ...override?.overlap },
  }
}

export function validate(project: Project, override?: Partial<ValidationConfig>): Report {
  const cfg = resolveValidationConfig(project, override)
  const findings: Finding[] = []
  if (cfg.dominance.enabled) findings.push(...checkDominance(project))
  if (cfg.balance.enabled) findings.push(...checkBalance(project, cfg.balance))
  if (cfg.correlation.enabled) findings.push(...checkCorrelation(project, cfg.correlation))
  if (cfg.overlap.enabled) findings.push(...checkOverlap(project))
  return {
    ranAt: new Date().toISOString(),
    findings,
    summary: {
      dominance: findings.filter((f) => f.check === 'dominance').length,
      balance: findings.filter((f) => f.check === 'balance').length,
      correlation: findings.filter((f) => f.check === 'correlation').length,
      overlap: findings.filter((f) => f.check === 'overlap').length,
    },
  }
}

function checkDominance(project: Project): Finding[] {
  const findings: Finding[] = []
  const alts = project.alternatives.filter((a) => !a.isOptOut)
  for (const row of project.design?.rows ?? []) {
    for (let i = 0; i < alts.length; i++) {
      for (let j = 0; j < alts.length; j++) {
        if (i === j) continue
        const A = alts[i]
        const B = alts[j]
        const common = dominance(project, row, A, B)
        if (common) {
          findings.push({
            check: 'dominance',
            severity: 'warning',
            message: `Choice task ${row.taskId}: "${A.label}" dominates "${B.label}"`,
            details: {
              taskId: row.taskId,
              dominantAltId: A.id,
              dominatedAltId: B.id,
              attributesCompared: common,
            },
          })
        }
      }
    }
  }
  return findings
}

function checkBalance(project: Project, cfg: ValidationConfig['balance']): Finding[] {
  const findings: Finding[] = []
  const rows = project.design?.rows ?? []
  for (const attr of project.attributes) {
    const applicable = project.alternatives.filter(
      (a) => !a.isOptOut && appliesToAlt(attr, a.id),
    )
    if (applicable.length === 0) continue
    const hasOverrides =
      !!attr.levelsByAlternative &&
      Object.keys(attr.levelsByAlternative).length > 0

    if (hasOverrides) {
      // Per-(alt, attr) balance — different alts may use different level sets
      for (const alt of applicable) {
        const altLevels = attr.levelsByAlternative?.[alt.id] ?? attr.levels
        if (altLevels.length < 2) continue
        const counts = new Map<string, number>(altLevels.map((l) => [l.id, 0]))
        for (const row of rows) {
          const lid = row.cells[cellKey(alt.id, attr.id)]
          if (lid && counts.has(lid)) counts.set(lid, counts.get(lid)! + 1)
        }
        const totalSlots = rows.length
        const ideal = totalSlots / altLevels.length
        const deviations = altLevels.map((l) => {
          const actual = counts.get(l.id) ?? 0
          const dev = ideal === 0 ? 0 : ((actual - ideal) / ideal) * 100
          return {
            levelId: l.id,
            levelLabel: l.displayValue ?? String(l.value),
            actual,
            ideal,
            deviationPct: dev,
          }
        })
        const maxAbs = Math.max(...deviations.map((d) => Math.abs(d.deviationPct)))
        if (maxAbs > cfg.maxDeviationPct) {
          findings.push({
            check: 'balance',
            severity: 'warning',
            message: `"${attr.name}" for "${alt.label}" is imbalanced (max deviation ${maxAbs.toFixed(1)}% > ${cfg.maxDeviationPct}%)`,
            details: {
              attributeId: attr.id,
              alternativeId: alt.id,
              deviations,
              ideal,
              totalSlots,
            },
          })
        }
      }
      continue
    }

    if (attr.levels.length < 2) continue
    const counts = new Map<string, number>(attr.levels.map((l) => [l.id, 0]))
    for (const row of rows) {
      for (const alt of applicable) {
        const lid = row.cells[cellKey(alt.id, attr.id)]
        if (lid && counts.has(lid)) counts.set(lid, counts.get(lid)! + 1)
      }
    }
    const totalSlots = rows.length * applicable.length
    const ideal = totalSlots / attr.levels.length
    const deviations = attr.levels.map((l) => {
      const actual = counts.get(l.id) ?? 0
      const dev = ideal === 0 ? 0 : ((actual - ideal) / ideal) * 100
      return {
        levelId: l.id,
        levelLabel: l.displayValue ?? String(l.value),
        actual,
        ideal,
        deviationPct: dev,
      }
    })
    const maxAbs = Math.max(...deviations.map((d) => Math.abs(d.deviationPct)))
    if (maxAbs > cfg.maxDeviationPct) {
      findings.push({
        check: 'balance',
        severity: 'warning',
        message: `Attribute "${attr.name}" levels are imbalanced (max deviation ${maxAbs.toFixed(1)}% > ${cfg.maxDeviationPct}%)`,
        details: { attributeId: attr.id, deviations, ideal, totalSlots },
      })
    }
  }
  // Scenario context: each level should appear ~equally across tasks (one
  // value per task, regardless of alternative count).
  for (const cv of project.contextVariables ?? []) {
    if (cv.levels.length < 2) continue
    const counts = new Map<string, number>(cv.levels.map((l) => [l.id, 0]))
    for (const row of rows) {
      const lid = row.context?.[cv.id]
      if (lid && counts.has(lid)) counts.set(lid, counts.get(lid)! + 1)
    }
    const totalSlots = rows.length
    const ideal = totalSlots / cv.levels.length
    if (ideal === 0) continue
    const deviations = cv.levels.map((l) => {
      const actual = counts.get(l.id) ?? 0
      const dev = ((actual - ideal) / ideal) * 100
      return {
        levelId: l.id,
        levelLabel: l.displayValue ?? String(l.value),
        actual,
        ideal,
        deviationPct: dev,
      }
    })
    const maxAbs = Math.max(...deviations.map((d) => Math.abs(d.deviationPct)))
    if (maxAbs > cfg.maxDeviationPct) {
      findings.push({
        check: 'balance',
        severity: 'warning',
        message: `Context "${cv.name}" levels are imbalanced (max deviation ${maxAbs.toFixed(1)}% > ${cfg.maxDeviationPct}%)`,
        details: { contextVariableId: cv.id, deviations, ideal, totalSlots },
      })
    }
  }
  return findings
}

export function pearson(x: number[], y: number[]): number {
  const n = x.length
  if (n < 2) return 0
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my)
    dx += (x[i] - mx) ** 2
    dy += (y[i] - my) ** 2
  }
  const den = Math.sqrt(dx * dy)
  return den === 0 ? 0 : num / den
}

function checkCorrelation(project: Project, cfg: ValidationConfig['correlation']): Finding[] {
  const findings: Finding[] = []
  const rows = project.design?.rows ?? []
  for (const alt of project.alternatives) {
    if (alt.isOptOut) continue
    const attrs = project.attributes.filter((a) => appliesToAlt(a, alt.id))
    for (let i = 0; i < attrs.length; i++) {
      for (let j = i + 1; j < attrs.length; j++) {
        const A = attrs[i]
        const B = attrs[j]
        const xs: number[] = []
        const ys: number[] = []
        for (const row of rows) {
          const lA = getLevel(A, row.cells[cellKey(alt.id, A.id)])
          const lB = getLevel(B, row.cells[cellKey(alt.id, B.id)])
          if (!lA || !lB) continue
          xs.push(getScalar(A, lA))
          ys.push(getScalar(B, lB))
        }
        const r = pearson(xs, ys)
        const abs = Math.abs(r)
        if (abs > cfg.concernThreshold) {
          findings.push({
            check: 'correlation',
            severity: 'concern',
            message: `Alt "${alt.label}": "${A.name}" × "${B.name}" highly correlated (r=${r.toFixed(3)})`,
            details: { alternativeId: alt.id, attrA: A.id, attrB: B.id, r },
          })
        } else if (abs > cfg.warnThreshold) {
          findings.push({
            check: 'correlation',
            severity: 'warning',
            message: `Alt "${alt.label}": "${A.name}" × "${B.name}" correlated (r=${r.toFixed(3)})`,
            details: { alternativeId: alt.id, attrA: A.id, attrB: B.id, r },
          })
        }
      }
    }
  }
  return findings
}

function checkOverlap(project: Project): Finding[] {
  const findings: Finding[] = []
  const alts = project.alternatives.filter((a) => !a.isOptOut)
  for (const row of project.design?.rows ?? []) {
    for (let i = 0; i < alts.length; i++) {
      for (let j = i + 1; j < alts.length; j++) {
        const A = alts[i]
        const B = alts[j]
        const common = project.attributes.filter(
          (attr) => appliesToAlt(attr, A.id) && appliesToAlt(attr, B.id),
        )
        if (common.length === 0) continue
        const identical = common.every(
          (attr) => row.cells[cellKey(A.id, attr.id)] === row.cells[cellKey(B.id, attr.id)],
        )
        if (identical) {
          findings.push({
            check: 'overlap',
            severity: 'warning',
            message: `Choice task ${row.taskId}: "${A.label}" and "${B.label}" identical on all common attributes`,
            details: {
              taskId: row.taskId,
              altA: A.id,
              altB: B.id,
              commonAttrs: common.map((a) => a.id),
            },
          })
        }
      }
    }
  }
  return findings
}
