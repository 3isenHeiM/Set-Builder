export type IsoTimestamp = string
export type Availability = 'active' | 'missing'
export type ConfigurationStatus = 'pending' | 'complete'
export type Hotness = 1 | 2 | 3
export type Preset = '80s' | 'mix'
export type PieceCode = number | string

export type TempoBeat = 'half' | 'quarter' | 'eighth' | 'dotted-half' | 'dotted-quarter' | 'dotted-eighth'
export type TimeSignature = '2/2' | '3/2' | '2/4' | '3/4' | '4/4' | '5/4' | '6/4' | '7/4' | '3/8' | '5/8' | '6/8' | '7/8' | '9/8' | '12/8'

export interface DrummerTiming {
  bpm: number | null
  beat: TempoBeat
  measure: TimeSignature | null
  /** Pickup length in beats. */
  anacrusis: number | null
}

export interface Score {
  id: string
  scoreNumber: PieceCode
  collection?: string
  displayNumber: string
  title: string
  fileName: string
  relativePath: string
  availability: Availability
  configuration: ConfigurationStatus
  canStart: boolean | null
  hotness: Hotness | null
  drumsIntro: boolean | null
  drummerNotes?: string
  drummerTiming?: DrummerTiming
  goesHigh: boolean | null
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
  drummerNotes?: string
  drummerTiming?: DrummerTiming
  goesHigh: boolean | null
  enabled: boolean
  /** Accepted for legacy settings clients; current configuration uses collections. */
  in80s?: boolean
}

export type BulkConfiguration = Partial<Omit<ScoreConfiguration, 'in80s' | 'drummerNotes' | 'drummerTiming'>>

export type MalformedReason =
  | 'not-mscz'
  | 'invalid-format'
  | 'non-positive-number'
  | 'number-too-large'
  | 'empty-title'

export interface ParsedScoreFile {
  scoreNumber: PieceCode
  collection?: string
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
  scoreNumber: PieceCode
  files: ParsedScoreFile[]
}

export interface FolderSnapshot {
  collection?: string
  mode?: 'add' | 'realign'
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
  scoreNumber: PieceCode
  displayNumber: string
  title: string
}

export interface PossibleRenumbering {
  id: string
  scoreId: string
  oldScoreNumber: PieceCode
  oldDisplayNumber: string
  file: ParsedScoreFile
}

export interface ReconciliationPlan {
  collection?: string
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
  collection?: string
  id: string
  kind: 'import' | 'realignment'
  scannedAt: IsoTimestamp
  appliedAt: IsoTimestamp
  summary: FolderScanSummary
}

export interface PerformanceScoreSnapshot {
  id: string
  scoreNumber: PieceCode
  collection?: string
  displayNumber: string
  title: string
  hotness: Hotness
  drumsIntro: boolean
  drummerNotes?: string
  drummerTiming?: DrummerTiming
  goesHigh: boolean
  canStart: boolean
}

export interface PerformanceSet {
  number: number
  name?: string
  savedSetId?: string
  orderOverride?: boolean
  scores: PerformanceScoreSnapshot[]
}

export interface SavedSet {
  id: string
  name: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
  orderOverride?: boolean
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

export interface SavedSetList {
  id: string
  locked?: boolean
  name: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
  performance: GeneratedPerformance
}

export interface TonightSelection {
  key: 'tonight'
  setList: SavedSetList
}
