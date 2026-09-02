import { MAX_SCORES_PER_SET, MAX_SETS } from './generator'
import type { Hotness, PerformanceScoreSnapshot, Preset, SavedSetList } from './types'

export const SET_LIST_BACKUP_FORMAT = 'piece-selector-set-list'
export const SET_LIST_BACKUP_VERSION = 1

type SetListBackupScore = Omit<PerformanceScoreSnapshot, 'id'>

export interface SetListBackup {
  format: typeof SET_LIST_BACKUP_FORMAT
  version: typeof SET_LIST_BACKUP_VERSION
  exportedAt: string
  setList: {
    name: string
    generatedAt: string
    preset: Preset
    seed: number
    warnings: string[]
    sets: Array<{ name: string; scores: SetListBackupScore[] }>
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function readScore(value: unknown): SetListBackupScore {
  if (!isRecord(value)
    || !Number.isSafeInteger(value.scoreNumber) || Number(value.scoreNumber) <= 0
    || typeof value.displayNumber !== 'string' || !/^\d+$/.test(value.displayNumber)
    || typeof value.title !== 'string' || value.title.trim() === ''
    || !Number.isInteger(value.hotness) || Number(value.hotness) < 1 || Number(value.hotness) > 3
    || typeof value.drumsIntro !== 'boolean'
    || typeof value.goesHigh !== 'boolean'
    || typeof value.canStart !== 'boolean') {
    throw new Error('This Piece Selector set-list file is malformed.')
  }
  return {
    scoreNumber: Number(value.scoreNumber),
    displayNumber: value.displayNumber,
    title: value.title.trim(),
    hotness: Number(value.hotness) as Hotness,
    drumsIntro: value.drumsIntro,
    goesHigh: value.goesHigh,
    canStart: value.canStart,
  }
}

export function createSetListBackup(saved: SavedSetList, exportedAt: string): SetListBackup {
  return {
    format: SET_LIST_BACKUP_FORMAT,
    version: SET_LIST_BACKUP_VERSION,
    exportedAt,
    setList: {
      name: saved.name,
      generatedAt: saved.performance.generatedAt,
      preset: saved.performance.preset,
      seed: saved.performance.seed,
      warnings: [...saved.performance.warnings],
      sets: saved.performance.sets.map((set) => ({
        name: set.name?.trim() ?? '',
        scores: set.scores.map(({ id: _, ...score }) => {
          void _
          return score
        }),
      })),
    },
  }
}

export function setListBackupToJson(backup: SetListBackup): string {
  return `${JSON.stringify(backup, null, 2)}\n`
}

export function parseSetListBackupJson(source: string): SetListBackup {
  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch {
    throw new Error('Set-list file is not valid JSON.')
  }
  if (!isRecord(raw) || raw.format !== SET_LIST_BACKUP_FORMAT) throw new Error('This is not a Piece Selector set-list file.')
  if (raw.version !== SET_LIST_BACKUP_VERSION) throw new Error('This set-list file version is not supported.')
  if (!isIsoDate(raw.exportedAt) || !isRecord(raw.setList)) throw new Error('This Piece Selector set-list file is malformed.')

  const { setList } = raw
  if (typeof setList.name !== 'string' || setList.name.length > 120
    || !isIsoDate(setList.generatedAt)
    || (setList.preset !== '80s' && setList.preset !== 'mix')
    || !Number.isSafeInteger(setList.seed) || Number(setList.seed) < 0
    || !Array.isArray(setList.warnings)
    || !Array.isArray(setList.sets) || setList.sets.length < 1 || setList.sets.length > MAX_SETS) {
    throw new Error('This Piece Selector set-list file is malformed.')
  }

  const warnings: string[] = []
  for (const warning of setList.warnings) {
    if (typeof warning !== 'string' || warning.length > 500) throw new Error('This Piece Selector set-list file is malformed.')
    warnings.push(warning)
  }

  const numbers = new Set<number>()
  let expectedSize: number | undefined
  const sets = setList.sets.map((set) => {
    if (!isRecord(set) || typeof set.name !== 'string' || set.name.length > 120
      || !Array.isArray(set.scores) || set.scores.length < 1 || set.scores.length > MAX_SCORES_PER_SET) {
      throw new Error('This Piece Selector set-list file is malformed.')
    }
    expectedSize ??= set.scores.length
    if (set.scores.length !== expectedSize) throw new Error('Every imported set must contain the same number of pieces.')
    const scores = set.scores.map(readScore)
    if (!scores[0]?.canStart) throw new Error('Every imported set must start with an eligible starter.')
    let regularPieceSeen = false
    for (const score of scores) {
      if (numbers.has(score.scoreNumber)) throw new Error('A piece appears more than once in the imported set list.')
      numbers.add(score.scoreNumber)
      if (score !== scores[0] && score.goesHigh && regularPieceSeen) throw new Error('Pieces that go high must remain near the start of their set.')
      if (score !== scores[0]) regularPieceSeen ||= !score.goesHigh
    }
    return { name: set.name.trim(), scores }
  })

  return {
    format: SET_LIST_BACKUP_FORMAT,
    version: SET_LIST_BACKUP_VERSION,
    exportedAt: raw.exportedAt,
    setList: {
      name: setList.name.trim(),
      generatedAt: setList.generatedAt,
      preset: setList.preset,
      seed: Number(setList.seed),
      warnings,
      sets,
    },
  }
}

export function restoreSetList(backup: SetListBackup, now: string, createId: () => string): SavedSetList {
  const id = createId()
  const setSize = backup.setList.sets[0]?.scores.length ?? 0
  return {
    id,
    name: backup.setList.name,
    createdAt: now,
    updatedAt: now,
    performance: {
      id,
      generatedAt: backup.setList.generatedAt,
      preset: backup.setList.preset,
      seed: backup.setList.seed,
      setCount: backup.setList.sets.length,
      scoresPerSet: setSize,
      sets: backup.setList.sets.map((set, index) => ({
        number: index + 1,
        name: set.name,
        scores: set.scores.map((score) => ({ ...score, id: createId() })),
      })),
      warnings: backup.setList.warnings,
    },
  }
}
