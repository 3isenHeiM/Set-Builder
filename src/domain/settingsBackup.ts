import type { Hotness, PieceCode, Score } from './types'
import { readCollection, comparePieces, pieceKey, validCode } from './collections'
import { configurationStatus } from './configuration'
import { readDrummerNotes } from './drummerNotes'

export const SETTINGS_BACKUP_FORMAT = 'piece-selector-settings'
export const SETTINGS_BACKUP_VERSION = 5

export interface BackedUpScoreSettings {
  scoreNumber: PieceCode
  collection?: string
  name: string
  settings: {
    in80s: boolean
    canStart: boolean | null
    hotness: Hotness | null
    drumsIntro: boolean | null
    drummerNotes?: string
    goesHigh: boolean | null
    enabled: boolean
  }
}

export interface SettingsBackup {
  format: typeof SETTINGS_BACKUP_FORMAT
  version: typeof SETTINGS_BACKUP_VERSION
  exportedAt: string
  pieces: BackedUpScoreSettings[]
}

export interface SettingsTitleMismatch {
  scoreNumber: PieceCode
  collection?: string
  backupName: string
  currentName: string
}

export interface SettingsImportReport {
  matched: number
  notFound: number
  titleMismatches: SettingsTitleMismatch[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return typeof value === 'boolean' || value === null
}

function isHotness(value: unknown): value is Hotness {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 3
}

export function createSettingsBackup(scores: readonly Score[], exportedAt: string): SettingsBackup {
  return {
    format: SETTINGS_BACKUP_FORMAT,
    version: SETTINGS_BACKUP_VERSION,
    exportedAt,
    pieces: [...scores]
      .sort(comparePieces)
      .map((score) => ({
        scoreNumber: score.scoreNumber,
        collection: readCollection(score.collection),
        name: score.title,
        settings: {
          in80s: score.tags.includes('80s'),
          canStart: score.canStart,
          hotness: score.hotness,
          drumsIntro: score.drumsIntro,
          drummerNotes: readDrummerNotes(score.drummerNotes),
          goesHigh: score.goesHigh,
          enabled: score.enabled,
        },
      })),
  }
}

export function settingsBackupToJson(backup: SettingsBackup): string {
  return `${JSON.stringify(backup, null, 2)}\n`
}

export function parseSettingsBackupJson(source: string): SettingsBackup {
  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch {
    throw new Error('Settings file is not valid JSON.')
  }

  if (!isRecord(raw) || raw.format !== SETTINGS_BACKUP_FORMAT) {
    throw new Error('This is not a Piece Selector settings file.')
  }
  const usesFiveLevelHotness = raw.version === 1
  const predatesGoesHigh = raw.version === 1 || raw.version === 2
  if (!predatesGoesHigh && raw.version !== 3 && raw.version !== 4 && raw.version !== SETTINGS_BACKUP_VERSION) {
    throw new Error('This settings file version is not supported.')
  }
  if (typeof raw.exportedAt !== 'string' || !Array.isArray(raw.pieces)) {
    throw new Error('This Piece Selector settings file is malformed.')
  }

  const seen = new Set<string>()
  const pieces = raw.pieces.map((piece, index): BackedUpScoreSettings => {
    if (!isRecord(piece) || !isRecord(piece.settings)) {
      throw new Error(`Piece ${index + 1} has malformed settings.`)
    }
    if (!validCode(piece.scoreNumber)) {
      throw new Error(`Piece ${index + 1} has an invalid score number.`)
    }
    const collection = readCollection(piece.collection)
    const key = pieceKey({ scoreNumber: piece.scoreNumber, collection })
    if (seen.has(key)) {
      throw new Error(`Score number ${piece.scoreNumber} appears more than once in the settings file.`)
    }
    seen.add(key)
    if (typeof piece.name !== 'string' || piece.name.trim() === '') {
      throw new Error(`Score number ${piece.scoreNumber} has no name.`)
    }

    const { settings } = piece
    if (
      typeof settings.in80s !== 'boolean'
      || !isNullableBoolean(settings.canStart)
      || !(settings.hotness === null || isHotness(settings.hotness) || (usesFiveLevelHotness && (settings.hotness === 4 || settings.hotness === 5)))
      || !isNullableBoolean(settings.drumsIntro)
      || !(isNullableBoolean(settings.goesHigh) || (predatesGoesHigh && settings.goesHigh === undefined))
      || typeof settings.enabled !== 'boolean'
      || (raw.version === SETTINGS_BACKUP_VERSION && typeof settings.drummerNotes !== 'string')
    ) {
      throw new Error(`Score number ${piece.scoreNumber} has malformed settings.`)
    }

    return {
      scoreNumber: piece.scoreNumber,
      collection,
      name: piece.name.trim(),
      settings: {
        in80s: settings.in80s,
        canStart: settings.canStart,
        hotness: settings.hotness === 4 || settings.hotness === 5 ? 3 : settings.hotness,
        drumsIntro: settings.drumsIntro,
        ...(settings.drummerNotes === undefined ? {} : { drummerNotes: readDrummerNotes(settings.drummerNotes) }),
        goesHigh: settings.goesHigh === undefined ? null : settings.goesHigh,
        enabled: settings.enabled,
      },
    }
  })

  return { format: SETTINGS_BACKUP_FORMAT, version: SETTINGS_BACKUP_VERSION, exportedAt: raw.exportedAt, pieces }
}

export function previewSettingsImport(scores: readonly Score[], backup: SettingsBackup): SettingsImportReport {
  const currentByNumber = new Map(scores.map((score) => [pieceKey(score), score]))
  const titleMismatches: SettingsTitleMismatch[] = []
  let matched = 0

  for (const piece of backup.pieces) {
    const current = currentByNumber.get(pieceKey(piece))
    if (!current) continue
    matched += 1
    if (current.title !== piece.name) {
      titleMismatches.push({ scoreNumber: piece.scoreNumber, ...(piece.collection && piece.collection !== 'General' ? { collection: piece.collection } : {}), backupName: piece.name, currentName: current.title })
    }
  }

  return { matched, notFound: backup.pieces.length - matched, titleMismatches }
}

export function applySettingsBackup(
  scores: readonly Score[],
  backup: SettingsBackup,
  updatedAt: string,
): { scores: Score[]; report: SettingsImportReport } {
  const settingsByNumber = new Map(backup.pieces.map((piece) => [pieceKey(piece), piece.settings]))

  return {
    scores: scores.map((score) => {
      const settings = settingsByNumber.get(pieceKey(score))
      if (!settings) return score
      return {
        ...score,
        canStart: settings.canStart,
        hotness: settings.hotness,
        drumsIntro: settings.drumsIntro,
        drummerNotes: settings.drummerNotes === undefined ? readDrummerNotes(score.drummerNotes) : readDrummerNotes(settings.drummerNotes),
        goesHigh: settings.goesHigh,
        enabled: settings.enabled,
        tags: [...score.tags.filter((tag) => tag !== '80s'), ...(settings.in80s ? ['80s'] : [])],
        configuration: configurationStatus(settings),
        updatedAt,
      }
    }),
    report: previewSettingsImport(scores, backup),
  }
}
