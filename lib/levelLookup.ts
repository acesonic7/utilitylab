import type { Attribute, Level } from './schema'

// Get the level set that applies to a given alternative for an attribute.
// Returns the per-alt override if one exists, otherwise the default levels.
export function getLevelsForAlt(attr: Attribute, altId: string): Level[] {
  const override = attr.levelsByAlternative?.[altId]
  if (override && override.length > 0) return override
  return attr.levels
}

// Find a level by ID anywhere within an attribute (default or any per-alt
// override). Level IDs are required to be unique across the attribute, so this
// is unambiguous.
export function findLevelInAttr(
  attr: Attribute,
  levelId: string,
): Level | undefined {
  const def = attr.levels.find((l) => l.id === levelId)
  if (def) return def
  if (attr.levelsByAlternative) {
    for (const altLevels of Object.values(attr.levelsByAlternative)) {
      const m = altLevels.find((l) => l.id === levelId)
      if (m) return m
    }
  }
  return undefined
}

// All distinct level IDs across the attribute (used for uniqueness checks).
export function allLevelIdsInAttr(attr: Attribute): string[] {
  const out: string[] = attr.levels.map((l) => l.id)
  if (attr.levelsByAlternative) {
    for (const altLevels of Object.values(attr.levelsByAlternative)) {
      out.push(...altLevels.map((l) => l.id))
    }
  }
  return out
}

export function attrHasOverrides(attr: Attribute): boolean {
  return (
    !!attr.levelsByAlternative &&
    Object.keys(attr.levelsByAlternative).length > 0
  )
}
