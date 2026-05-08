export type AttributeType = 'numeric' | 'categorical' | 'boolean'

export type DisplayFormat = 'plain' | 'currency' | 'percent' | 'duration'

export type PreferenceDirection = 'higher' | 'lower' | 'none'

export type Level = {
  id: string
  value: number | string | boolean
  displayValue?: string
  position: number
}

export type Attribute = {
  id: string
  name: string
  type: AttributeType
  unit?: string
  displayFormat?: DisplayFormat
  preferenceDirection?: PreferenceDirection
  levels: Level[]
  appliesTo: 'all' | string[]
  position: number
  // D-optimal priors: one entry per parameter (numeric/boolean=1, categorical=K-1).
  // Length must match the attribute's parameter count; missing/short arrays
  // are zero-padded.
  priors?: number[]
}

export type Alternative = {
  id: string
  label: string
  isOptOut: boolean
  position: number
}

export type ColumnMappingRole = 'task' | 'block' | 'cell' | 'context' | 'ignore'

export type ColumnMapping = {
  csvColumn: string
  role: ColumnMappingRole
  alternativeId?: string
  attributeId?: string
  contextVariableId?: string
}

export type DesignRow = {
  taskId: number
  block: number
  cells: Record<string, string>
  // Scenario context: contextVariableId → levelId. Same value across all
  // alternatives within the same task (e.g., weather, travel purpose).
  context?: Record<string, string>
}

// Scenario context: variables that vary across choice tasks but are uniform
// within a task (the same context applies to every alternative). Examples:
// weather, travel purpose, time of day. Structurally similar to Attribute,
// but with no `appliesTo` (always all-task) and no `preferenceDirection`.
export type ContextVariable = {
  id: string
  name: string
  type: AttributeType
  unit?: string
  displayFormat?: DisplayFormat
  levels: Level[]
  position: number
}

export type ScoreWeights = {
  balance: number
  correlation: number
  dominance: number
  overlap: number
}

export type GenerationMethod = 'random' | 'balanced' | 'd-optimal'

export type GenerationParams = {
  method: GenerationMethod
  iterations?: number
  multistarts?: number
  seed?: number
  scoreWeights?: ScoreWeights
}

export type Design = {
  source: 'csv' | 'generated'
  uploadedAt: string
  filename?: string
  numTasks: number
  numBlocks: number
  rows: DesignRow[]
  mapping: ColumnMapping[]
  rawHeaders: string[]
  generationParams?: GenerationParams
}

export type BuilderConfig = {
  attributeOrder: string[]
  alternativeOrder: string[]
  layout: 'attributes-as-rows' | 'attributes-as-columns'
  showUnits: boolean
  optOutPosition: 'last' | 'first' | 'inline'
}

export type ValidationConfig = {
  dominance: { enabled: boolean }
  balance: { enabled: boolean; maxDeviationPct: number }
  correlation: { enabled: boolean; warnThreshold: number; concernThreshold: number }
  overlap: { enabled: boolean }
}

// A constraint forbids a particular combination of attribute-level values within
// (one or all) alternatives in a task. Multiple clauses are AND-conjoined.
//   "Bus.headway=5 AND Bus.comfort=Low" → constraint is violated for any task
//   where Bus has headway=5 AND comfort=Low simultaneously.
export type Constraint = {
  id: string
  type: 'forbidden_combination'
  alternativeId: string | 'all' // 'all' = check every active alt
  clauses: { attributeId: string; levelId: string }[] // AND
  enabled: boolean
  label?: string // optional user-readable label
}

export type Project = {
  id: string
  slug: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  experimentType: 'unlabeled' | 'labeled'
  alternatives: Alternative[]
  attributes: Attribute[]
  contextVariables?: ContextVariable[]
  design: Design | null
  builder: BuilderConfig
  validationConfig?: ValidationConfig
  constraints?: Constraint[]
  // Expected number of survey respondents. Drives the sample-size panel in the
  // generator; not used by validation or generation logic itself.
  targetSampleSize?: number
  // LimeSurvey publish target. Username and survey ID are persisted; the
  // password is asked for on every push and never stored.
  limesurvey?: {
    url?: string
    surveyId?: number
    username?: string
  }
}
