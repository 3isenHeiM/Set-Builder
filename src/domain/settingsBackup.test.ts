import { makeScore } from '../test/fixtures'
import {
  SETTINGS_BACKUP_FORMAT,
  applySettingsBackup,
  createSettingsBackup,
  parseSettingsBackupJson,
  settingsBackupToJson,
} from './settingsBackup'

describe('settings backup', () => {
  it('exports a readable, versioned settings-only document sorted by score number', () => {
    const backup = createSettingsBackup([
      makeScore({ id: 'second', scoreNumber: 8, title: 'Billie Jean', fileName: 'secret-name', relativePath: 'secret-path' }),
      makeScore({ id: 'first', scoreNumber: 2, title: 'Africa', tags: ['80s'], hotness: 5, drumsIntro: true }),
    ], '2026-09-02T12:00:00.000Z')
    const json = settingsBackupToJson(backup)

    expect(backup).toMatchObject({ format: SETTINGS_BACKUP_FORMAT, version: 1, pieces: [
      { scoreNumber: 2, name: 'Africa', settings: { in80s: true, hotness: 5, drumsIntro: true } },
      { scoreNumber: 8, name: 'Billie Jean', settings: { in80s: false } },
    ] })
    expect(json).not.toContain('secret-name')
    expect(json).not.toContain('secret-path')
    expect(json).not.toContain('"id"')
  })

  it('restores settings by number while preserving score identity and folder metadata', () => {
    const current = makeScore({
      id: 'immutable',
      scoreNumber: 2,
      title: 'Africa (new name)',
      tags: [],
      availability: 'missing',
      updatedAt: 'before',
    })
    const absent = makeScore({ id: 'untouched', scoreNumber: 3, title: 'Not in backup', hotness: 2 })
    const backup = parseSettingsBackupJson(JSON.stringify({
      format: SETTINGS_BACKUP_FORMAT,
      version: 1,
      exportedAt: '2026-09-01T12:00:00.000Z',
      pieces: [
        { scoreNumber: 2, name: 'Africa', settings: { in80s: true, canStart: false, hotness: 5, drumsIntro: true, enabled: false } },
        { scoreNumber: 9, name: 'No longer here', settings: { in80s: false, canStart: true, hotness: 1, drumsIntro: false, enabled: true } },
      ],
    }))

    const result = applySettingsBackup([current, absent], backup, 'restored')

    expect(result.scores[0]).toEqual({ ...current, tags: ['80s'], canStart: false, hotness: 5, drumsIntro: true, enabled: false, configuration: 'complete', updatedAt: 'restored' })
    expect(result.scores[1]).toBe(absent)
    expect(result.report).toEqual({
      matched: 1,
      notFound: 1,
      titleMismatches: [{ scoreNumber: 2, backupName: 'Africa', currentName: 'Africa (new name)' }],
    })
  })

  it('rejects duplicate numbers and malformed setting values', () => {
    const piece = { scoreNumber: 2, name: 'Africa', settings: { in80s: true, canStart: false, hotness: 5, drumsIntro: true, enabled: true } }
    expect(() => parseSettingsBackupJson(JSON.stringify({ format: SETTINGS_BACKUP_FORMAT, version: 1, exportedAt: 'now', pieces: [piece, piece] }))).toThrow('appears more than once')
    expect(() => parseSettingsBackupJson(JSON.stringify({ format: SETTINGS_BACKUP_FORMAT, version: 1, exportedAt: 'now', pieces: [{ ...piece, settings: { ...piece.settings, hotness: 10 } }] }))).toThrow('malformed settings')
    expect(() => parseSettingsBackupJson('{}')).toThrow('not a Piece Selector settings file')
  })
})
