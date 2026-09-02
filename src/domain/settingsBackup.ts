import type { Hotness, Score } from './types'

export const SETTINGS_BACKUP_FORMAT = 'piece-selector-settings'
export const SETTINGS_BACKUP_VERSION = 1

export interface BackedUpScoreSettings {
  scoreNumber: number
  name: string
  settings: {
    in80s: boolean
    canStart: boolean | null
    hotness: Hotness | null
    drumsIntro: boolean | null
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
  scoreNumber: number
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
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
}

export function createSettingsBackup(scores: readonly Score[], exportedAt: string): SettingsBackup {
  return {
    format: SETTINGS_BACKUP_FORMAT,
    version: SETTINGS_BACKUP_VERSION,
    exportedAt,
    pieces: [...scores]
      .sort((left, right) => left.scoreNumber - right.scoreNumber)
      .map((score) => ({
        scoreNumber: score.scoreNumber,
        name: score.title,
        settings: {
          in80s: score.tags.includes('80s'),
          canStart: score.canStart,
          hotness: score.hotness,
          drumsIntro: score.drumsIntro,
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
  if (raw.version !== SETTINGS_BACKUP_VERSION) {
    throw new Error('This settings file version is not supported.')
  }
  if (typeof raw.exportedAt !== 'string' || !Array.isArray(raw.pieces)) {
    throw new Error('This Piece Selector settings file is malformed.')
  }

  const seen = new Set<number>()
  const pieces = raw.pieces.map((piece, index): BackedUpScoreSettings => {
    if (!isRecord(piece) || !isRecord(piece.settings)) {
      throw new Error(`Piece ${index + 1} has malformed settings.`)
    }
    if (typeof piece.scoreNumber !== 'number' || !Number.isSafeInteger(piece.scoreNumber) || piece.scoreNumber <= 0) {
      throw new Error(`Piece ${index + 1} has an invalid score number.`)
    }
    if (seen.has(piece.scoreNumber)) {
      throw new Error(`Score number ${piece.scoreNumber} appears more than once in the settings file.`)
    }
    seen.add(piece.scoreNumber)
    if (typeof piece.name !== 'string' || piece.name.trim() === '') {
      throw new Error(`Score number ${piece.scoreNumber} has no name.`)
    }

    const { settings } = piece
    if (
      typeof settings.in80s !== 'boolean'
      || !isNullableBoolean(settings.canStart)
      || !(settings.hotness === null || isHotness(settings.hotness))
      || !isNullableBoolean(settings.drumsIntro)
      || typeof settings.enabled !== 'boolean'
    ) {
      throw new Error(`Score number ${piece.scoreNumber} has malformed settings.`)
    }

    return {
      scoreNumber: piece.scoreNumber,
      name: piece.name.trim(),
      settings: {
        in80s: settings.in80s,
        canStart: settings.canStart,
        hotness: settings.hotness,
        drumsIntro: settings.drumsIntro,
        enabled: settings.enabled,
      },
    }
  })

  return { format: SETTINGS_BACKUP_FORMAT, version: SETTINGS_BACKUP_VERSION, exportedAt: raw.exportedAt, pieces }
}

export function previewSettingsImport(scores: readonly Score[], backup: SettingsBackup): SettingsImportReport {
  const currentByNumber = new Map(scores.map((score) => [score.scoreNumber, score]))
  const titleMismatches: SettingsTitleMismatch[] = []
  let matched = 0

  for (const piece of backup.pieces) {
    const current = currentByNumber.get(piece.scoreNumber)
    if (!current) continue
    matched += 1
    if (current.title !== piece.name) {
      titleMismatches.push({ scoreNumber: piece.scoreNumber, backupName: piece.name, currentName: current.title })
    }
  }

  return { matched, notFound: backup.pieces.length - matched, titleMismatches }
}

export function applySettingsBackup(
  scores: readonly Score[],
  backup: SettingsBackup,
  updatedAt: string,
): { scores: Score[]; report: SettingsImportReport } {
  const settingsByNumber = new Map(backup.pieces.map((piece) => [piece.scoreNumber, piece.settings]))

  return {
    scores: scores.map((score) => {
      const settings = settingsByNumber.get(score.scoreNumber)
      if (!settings) return score
      const configuration = settings.canStart !== null && settings.hotness !== null && settings.drumsIntro !== null ? 'complete' : 'pending'
      return {
        ...score,
        canStart: settings.canStart,
        hotness: settings.hotness,
        drumsIntro: settings.drumsIntro,
        enabled: settings.enabled,
        tags: [...score.tags.filter((tag) => tag !== '80s'), ...(settings.in80s ? ['80s'] : [])],
        configuration,
        updatedAt,
      }
    }),
    report: previewSettingsImport(scores, backup),
  }
}
