export type IsoTimestamp = string
export type Availability = 'active' | 'missing'
export type ConfigurationStatus = 'pending' | 'complete'
export type Hotness = 1 | 2 | 3
export type Preset = '80s' | 'mix'

export interface Score {
  id: string
  scoreNumber: number
  displayNumber: string
  title: string
  fileName: string
  relativePath: string
  availability: Availability
  configuration: ConfigurationStatus
  canStart: boolean | null
  hotness: Hotness | null
  drumsIntro: boolean | null
  enabled: boolean
  tags: string[]
  firstImportedAt: IsoTimestamp
  lastSeenAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface ScoreConfiguration {
  canStart: boolean | null
  hotness: Hotness | null
  drumsIntro: boolean | null
  enabled: boolean
  in80s: boolean
}

export type MalformedReason =
  | 'not-mscz'
  | 'invalid-format'
  | 'non-positive-number'
  | 'number-too-large'
  | 'empty-title'

export interface ParsedScoreFile {
  scoreNumber: number
  displayNumber: string
  title: string
  fileName: string
  relativePath: string
}

export interface MalformedScoreFile {
  fileName: string
  relativePath: string
  reason: Exclude<MalformedReason, 'not-mscz'>
}

export interface DuplicateScoreNumber {
  scoreNumber: number
  files: ParsedScoreFile[]
}

export interface FolderSnapshot {
  scannedAt: IsoTimestamp
  valid: ParsedScoreFile[]
  malformed: MalformedScoreFile[]
  duplicates: DuplicateScoreNumber[]
  ignoredCount: number
}

export interface ReconcileChange {
  scoreId: string
  file: ParsedScoreFile
}

export interface AddChange {
  file: ParsedScoreFile
}

export interface MissingChange {
  scoreId: string
  scoreNumber: number
  displayNumber: string
  title: string
}

export interface PossibleRenumbering {
  id: string
  scoreId: string
  oldScoreNumber: number
  oldDisplayNumber: string
  file: ParsedScoreFile
}

export interface ReconciliationPlan {
  scannedAt: IsoTimestamp
  unchanged: ReconcileChange[]
  renamed: ReconcileChange[]
  added: AddChange[]
  missing: MissingChange[]
  reappeared: ReconcileChange[]
  possibleRenumberings: PossibleRenumbering[]
  malformed: MalformedScoreFile[]
  duplicates: DuplicateScoreNumber[]
  ignoredCount: number
}

export type RenumberingDecision = 'same-score' | 'add-new'
export type RenumberingDecisions = Readonly<Record<string, RenumberingDecision>>

export interface FolderScanSummary {
  unchanged: number
  renamed: number
  added: number
  missing: number
  reappeared: number
  renumbered: number
  malformed: number
  duplicateFiles: number
  ignored: number
}

export interface FolderScan {
  id: string
  kind: 'import' | 'realignment'
  scannedAt: IsoTimestamp
  appliedAt: IsoTimestamp
  summary: FolderScanSummary
}

export interface PerformanceScoreSnapshot {
  id: string
  scoreNumber: number
  displayNumber: string
  title: string
  hotness: Hotness
  drumsIntro: boolean
  canStart: boolean
}

export interface PerformanceSet {
  number: number
  scores: PerformanceScoreSnapshot[]
}

export interface GeneratedPerformance {
  id: string
  generatedAt: IsoTimestamp
  preset: Preset
  seed: number
  setCount: number
  scoresPerSet: number
  sets: PerformanceSet[]
  warnings: string[]
}

export interface StoredPerformance {
  key: 'last'
  performance: GeneratedPerformance
}
