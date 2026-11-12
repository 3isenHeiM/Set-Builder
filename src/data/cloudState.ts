import { configurationStatus } from '../domain/configuration'
import { MAX_SCORES_PER_SET, MAX_SETS, MIN_SCORES_PER_SET, MIN_SETS, assertPerformanceValid } from '../domain/generator'
import { assertSavedPerformanceValid, assertSavedSetValid } from '../domain/setList'
import { readCollection, collectionNames, comparePieces, matchesDisplay, pieceKey, validCode } from '../domain/collections'
import { readDrummerNotes } from '../domain/drummerNotes'
import type {
  FolderScan,
  FolderScanSummary,
  GeneratedPerformance,
  Hotness,
  PerformanceScoreSnapshot,
  PerformanceSet,
  SavedSet,
  SavedSetList,
  Score,
} from '../domain/types'

export const CLOUD_STATE_FORMAT = 'piece-selector-cloud-state'
export const CLOUD_STATE_VERSION = 4

export interface CloudState {
  format: typeof CLOUD_STATE_FORMAT
  version: typeof CLOUD_STATE_VERSION
  scores: Score[]
  collections: string[]
  lastScan: FolderScan | null
  lastPerformance: GeneratedPerformance | null
  setLists: SavedSetList[]
  savedSets: SavedSet[]
}

export interface CloudStateEnvelope {
  revision: number
  state: CloudState
}

export interface CloudStateUpload {
  operationId: string
  state: CloudState
}

export function emptyCloudState(): CloudState {
  return {
    format: CLOUD_STATE_FORMAT,
    version: CLOUD_STATE_VERSION,
    scores: [],
    collections: ['General'],
    lastScan: null,
    lastPerformance: null,
    setLists: [],
    savedSets: [],
  }
}

export function hasCloudData(state: CloudState): boolean {
  return state.collections.some((name) => name !== 'General') || state.scores.length > 0 || state.lastScan !== null || state.lastPerformance !== null || state.setLists.length > 0 || state.savedSets.length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown, maxLength: number): string {
  if (typeof value !== 'string' || value.length > maxLength) throw new Error('Cloud state contains invalid text.')
  return value
}

function idValue(value: unknown): string {
  const valueAsString = stringValue(value, 200)
  if (valueAsString.trim() === '') throw new Error('Cloud state contains an invalid ID.')
  return valueAsString
}

function timestampValue(value: unknown): string {
  const valueAsString = stringValue(value, 100)
  if (Number.isNaN(Date.parse(valueAsString))) throw new Error('Cloud state contains an invalid timestamp.')
  return valueAsString
}

function integerValue(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error('Cloud state contains an invalid number.')
  }
  return value
}

function nullableBoolean(value: unknown): boolean | null {
  if (value !== null && typeof value !== 'boolean') throw new Error('Cloud state contains an invalid setting.')
  return value
}

function hotnessValue(value: unknown, nullable: true): Hotness | null
function hotnessValue(value: unknown, nullable: false): Hotness
function hotnessValue(value: unknown, nullable: boolean): Hotness | null {
  if (nullable && value === null) return null
  return integerValue(value, 1, 3) as Hotness
}

function readScore(value: unknown): Score {
  if (!isRecord(value)) throw new Error('Cloud state contains a malformed piece.')
  const tags = value.tags
  if (!Array.isArray(tags) || tags.length > 50 || tags.some((tag) => typeof tag !== 'string' || tag.length > 100)) {
    throw new Error('Cloud state contains invalid tags.')
  }
  const normalizedTags = tags.map((tag) => stringValue(tag, 100))
  const canStart = nullableBoolean(value.canStart)
  const hotness = hotnessValue(value.hotness, true)
  const drumsIntro = nullableBoolean(value.drumsIntro)
  const goesHigh = nullableBoolean(value.goesHigh)
  const enabled = value.enabled
  if (typeof enabled !== 'boolean' || (value.configuration !== 'pending' && value.configuration !== 'complete')) {
    throw new Error('Cloud state contains a malformed piece configuration.')
  }
  const expectedStatus = configurationStatus({ canStart, hotness, drumsIntro, goesHigh, enabled, in80s: normalizedTags.includes('80s') })
  if (expectedStatus !== value.configuration) throw new Error('Cloud state contains an inconsistent piece configuration.')
  const scoreNumber = value.scoreNumber
  if (!validCode(scoreNumber)) throw new Error('Cloud state contains an invalid piece identifier.')
  const displayNumber = stringValue(value.displayNumber, 100)
  if (!matchesDisplay(scoreNumber, displayNumber)) throw new Error('Cloud state contains an invalid display number.')
  if (value.availability !== 'active' && value.availability !== 'missing') throw new Error('Cloud state contains an invalid availability.')
  const title = stringValue(value.title, 500)
  if (title.trim() === '') throw new Error('Cloud state contains a piece without a title.')
  return {
    id: idValue(value.id),
    collection: readCollection(value.collection),
    scoreNumber,
    displayNumber,
    title,
    fileName: stringValue(value.fileName, 1_000),
    relativePath: stringValue(value.relativePath, 2_000),
    availability: value.availability,
    configuration: value.configuration,
    canStart,
    hotness,
    drumsIntro,
    drummerNotes: readDrummerNotes(value.drummerNotes),
    goesHigh,
    enabled,
    tags: normalizedTags,
    firstImportedAt: timestampValue(value.firstImportedAt),
    lastSeenAt: timestampValue(value.lastSeenAt),
    updatedAt: timestampValue(value.updatedAt),
  }
}

function readPerformanceScore(value: unknown): PerformanceScoreSnapshot {
  if (!isRecord(value)) throw new Error('Cloud state contains a malformed set-list piece.')
  const displayNumber = stringValue(value.displayNumber, 100)
  const scoreNumber = value.scoreNumber
  if (!validCode(scoreNumber)) throw new Error('Cloud state contains an invalid piece identifier.')
  const title = stringValue(value.title, 500)
  if (!matchesDisplay(scoreNumber, displayNumber) || title.trim() === '') {
    throw new Error('Cloud state contains a malformed set-list piece.')
  }
  if (typeof value.drumsIntro !== 'boolean' || typeof value.goesHigh !== 'boolean' || typeof value.canStart !== 'boolean') {
    throw new Error('Cloud state contains malformed set-list settings.')
  }
  return {
    id: idValue(value.id),
    ...(value.collection === undefined ? {} : { collection: readCollection(value.collection) }),
    scoreNumber,
    displayNumber,
    title,
    hotness: hotnessValue(value.hotness, false),
    drumsIntro: value.drumsIntro,
    ...(value.drummerNotes === undefined ? {} : { drummerNotes: readDrummerNotes(value.drummerNotes) }),
    goesHigh: value.goesHigh,
    canStart: value.canStart,
  }
}

function readPerformance(value: unknown, allowVariableSetSize = false): GeneratedPerformance {
  if (!isRecord(value)) throw new Error('Cloud state contains a malformed performance.')
  const setCount = integerValue(value.setCount, MIN_SETS, MAX_SETS)
  const scoresPerSet = integerValue(value.scoresPerSet, MIN_SCORES_PER_SET, MAX_SCORES_PER_SET)
  if ((value.preset !== '80s' && value.preset !== 'mix') || !Array.isArray(value.sets) || value.sets.length !== setCount) {
    throw new Error('Cloud state contains a malformed performance.')
  }
  if (!Array.isArray(value.warnings) || value.warnings.length > 100 || value.warnings.some((warning) => typeof warning !== 'string' || warning.length > 500)) {
    throw new Error('Cloud state contains malformed warnings.')
  }
  const warnings = value.warnings.map((warning) => stringValue(warning, 500))
  const sets: PerformanceSet[] = value.sets.map((set, index) => {
    if (!isRecord(set) || set.number !== index + 1 || !Array.isArray(set.scores)
      || (allowVariableSetSize ? set.scores.length < MIN_SCORES_PER_SET || set.scores.length > MAX_SCORES_PER_SET : set.scores.length !== scoresPerSet)) {
      throw new Error('Cloud state contains a malformed set.')
    }
    const name = set.name === undefined ? undefined : stringValue(set.name, 120)
    const savedSetId = set.savedSetId === undefined ? undefined : idValue(set.savedSetId)
    return { number: index + 1, ...(name === undefined ? {} : { name }), ...(savedSetId === undefined ? {} : { savedSetId }), scores: set.scores.map(readPerformanceScore) }
  })
  const performance: GeneratedPerformance = {
    id: idValue(value.id),
    generatedAt: timestampValue(value.generatedAt),
    preset: value.preset,
    seed: integerValue(value.seed, 0, 0xffff_ffff),
    setCount,
    scoresPerSet,
    sets,
    warnings,
  }
  if (allowVariableSetSize) assertSavedPerformanceValid(performance)
  else assertPerformanceValid(performance)
  return performance
}

function readScan(value: unknown): FolderScan {
  if (!isRecord(value) || (value.kind !== 'import' && value.kind !== 'realignment') || !isRecord(value.summary)) {
    throw new Error('Cloud state contains a malformed scan.')
  }
  const rawSummary = value.summary
  const summaryKeys: Array<keyof FolderScanSummary> = ['unchanged', 'renamed', 'added', 'missing', 'reappeared', 'renumbered', 'malformed', 'duplicateFiles', 'ignored']
  const summary = Object.fromEntries(summaryKeys.map((key) => [key, integerValue(rawSummary[key], 0, 100_000)])) as unknown as FolderScanSummary
  return {
    id: idValue(value.id),
    ...(value.collection === undefined ? {} : { collection: readCollection(value.collection) }),
    kind: value.kind,
    scannedAt: timestampValue(value.scannedAt),
    appliedAt: timestampValue(value.appliedAt),
    summary,
  }
}

function readSetList(value: unknown): SavedSetList {
  if (!isRecord(value)) throw new Error('Cloud state contains a malformed saved set list.')
  const id = idValue(value.id)
  const performance = readPerformance(value.performance, true)
  if (performance.id !== id) throw new Error('Cloud state contains an inconsistent saved set list.')
  return {
    id,
    name: stringValue(value.name, 120),
    createdAt: timestampValue(value.createdAt),
    updatedAt: timestampValue(value.updatedAt),
    performance,
  }
}

function readSavedSet(value: unknown): SavedSet {
  if (!isRecord(value) || !Array.isArray(value.scores) || value.scores.length < MIN_SCORES_PER_SET || value.scores.length > MAX_SCORES_PER_SET) {
    throw new Error('Cloud state contains a malformed saved set.')
  }
  const savedSet: SavedSet = {
    id: idValue(value.id),
    name: stringValue(value.name, 120),
    createdAt: timestampValue(value.createdAt),
    updatedAt: timestampValue(value.updatedAt),
    scores: value.scores.map(readPerformanceScore),
  }
  assertSavedSetValid(savedSet)
  return savedSet
}

export function parseCloudState(value: unknown): CloudState {
  if (!isRecord(value) || value.format !== CLOUD_STATE_FORMAT || (value.version !== 1 && value.version !== 2 && value.version !== 3 && value.version !== CLOUD_STATE_VERSION)
    || !Array.isArray(value.scores) || value.scores.length > 20_000
    || !Array.isArray(value.setLists) || value.setLists.length > 2_000) {
    throw new Error('The cloud library is malformed or unsupported.')
  }
  const scores = value.scores.map(readScore)
  const rawCollections = value.collections === undefined && (value.version === 1 || value.version === 2) ? [] : value.collections
  if (!Array.isArray(rawCollections) || rawCollections.length > 20_000) throw new Error('Cloud state contains invalid collections.')
  const collections = rawCollections.map((name) => readCollection(stringValue(name, 120)))
  if (new Set(collections.map((name) => name.toLocaleLowerCase('en'))).size !== collections.length) throw new Error('Cloud state contains duplicate collections.')
  const scoreIds = new Set(scores.map((score) => score.id))
  const scoreNumbers = new Set(scores.map(pieceKey))
  if (scoreIds.size !== scores.length || scoreNumbers.size !== scores.length) throw new Error('The cloud library contains duplicate pieces.')
  const setLists = value.setLists.map(readSetList)
  const setListIds = new Set(setLists.map((setList) => setList.id))
  if (setListIds.size !== setLists.length) throw new Error('The cloud library contains duplicate set lists.')
  const rawSavedSets = value.savedSets === undefined ? [] : value.savedSets
  if (!Array.isArray(rawSavedSets) || rawSavedSets.length > 5_000) throw new Error('The cloud library contains malformed saved sets.')
  const savedSets = rawSavedSets.map(readSavedSet)
  if (new Set(savedSets.map((set) => set.id)).size !== savedSets.length) throw new Error('The cloud library contains duplicate saved sets.')
  return {
    format: CLOUD_STATE_FORMAT,
    version: CLOUD_STATE_VERSION,
    scores: scores.sort(comparePieces),
    collections: collectionNames(scores, collections),
    lastScan: value.lastScan === null ? null : readScan(value.lastScan),
    lastPerformance: value.lastPerformance === null ? null : readPerformance(value.lastPerformance, true),
    setLists: setLists.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    savedSets: savedSets.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  }
}

export function parseCloudEnvelope(value: unknown): CloudStateEnvelope {
  if (!isRecord(value)) throw new Error('The cloud response is malformed.')
  return { revision: integerValue(value.revision, 0, Number.MAX_SAFE_INTEGER), state: parseCloudState(value.state) }
}
