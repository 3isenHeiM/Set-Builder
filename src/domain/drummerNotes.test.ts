import { readDrummerNotes, updateSavedDrummerNotes } from './drummerNotes'
import { makePerformance, makeScore } from '../test/fixtures'
import { createSettingsBackup, parseSettingsBackupJson, applySettingsBackup } from './settingsBackup'
import { createSetListBackup, parseSetListBackupJson, restoreSetList } from './setListBackup'
import { generatePerformance } from './generator'
import { parseCloudState, emptyCloudState } from '../data/cloudState'
import { toSharedSetList } from './sharedSetList'

const now = '2026-11-12T20:00:00.000Z'
const note = '4 bars on the snare\nBreak after the chorus — doucement !'

describe('drummer notes', () => {
  it('accepts optional plain text and rejects malformed or oversized notes', () => {
    expect(readDrummerNotes(undefined)).toBe('')
    expect(readDrummerNotes(note)).toBe(note)
    expect(readDrummerNotes('x'.repeat(2000))).toHaveLength(2000)
    for (const value of [null, 42, 'x'.repeat(2001)]) expect(() => readDrummerNotes(value)).toThrow('2000 characters')
    expect(() => parseCloudState({ ...emptyCloudState(), scores: [makeScore({ drummerNotes: 'x'.repeat(2001) })] })).toThrow('2000 characters')
  })

  it('updates only notes in existing sets and imported copies while preserving arrangement and metrics', () => {
    const performance = makePerformance()
    const imported = structuredClone(performance)
    imported.id = 'imported'
    imported.sets[0]!.scores[0]!.id = 'fresh-import-id'
    const other = makeScore({ id: 'other-piece', collection: 'Christmas', drummerNotes: 'Different repertoire' })
    const oldSet = { id: 'reusable', name: 'Opening', createdAt: now, updatedAt: now, scores: performance.sets[0]!.scores }
    const saved = { id: 'imported', name: 'Event', createdAt: now, updatedAt: now, performance: imported }
    const next = updateSavedDrummerNotes({ lastPerformance: performance, setLists: [saved], savedSets: [oldSet] }, [makeScore({ drummerNotes: note })], now)
    expect(next.setLists[0]?.performance.sets[0]?.scores[0]).toEqual({ ...imported.sets[0]!.scores[0], drummerNotes: note })
    expect(next.savedSets[0]?.scores[0]?.drummerNotes).toBe(note)
    expect(next.lastPerformance?.sets[0]?.scores[0]?.drummerNotes).toBe(note)
    expect(performance.sets[0]?.scores[0]?.drummerNotes).toBeUndefined()
    expect(updateSavedDrummerNotes({ lastPerformance: performance, setLists: [saved], savedSets: [oldSet] }, [other], now).lastPerformance).toBe(performance)
    expect(toSharedSetList(next.setLists[0]!).sets[0]?.scores[0]?.drummerNotes).toBe(note)
  })

  it('round-trips settings notes and preserves existing notes when an older backup omits them', () => {
    const score = makeScore({ drummerNotes: note })
    const backup = createSettingsBackup([score], now)
    expect(backup.version).toBe(6)
    const parsed = parseSettingsBackupJson(JSON.stringify(backup))
    expect(applySettingsBackup([makeScore()], parsed, now).scores[0]?.drummerNotes).toBe(note)
    const old = { ...backup, version: 4, pieces: backup.pieces.map((piece) => { const { drummerNotes: omitted, ...settings } = piece.settings; void omitted; return { ...piece, settings } }) }
    expect(applySettingsBackup([score], parseSettingsBackupJson(JSON.stringify(old)), now).scores[0]?.drummerNotes).toBe(note)
    backup.pieces[0]!.settings.drummerNotes = ''
    expect(applySettingsBackup([score], backup, now).scores[0]?.drummerNotes).toBe('')
  })

  it('includes notes in generated sets, exported programs, and public projections', () => {
    const performance = generatePerformance([makeScore({ drummerNotes: note })], { preset: 'mix', setCount: 1, scoresPerSet: 1, seed: 1 }, { now, createId: () => 'new' })
    const saved = { id: performance.id, name: 'Event', createdAt: now, updatedAt: now, performance }
    const backup = createSetListBackup(saved, now)
    expect(backup.version).toBe(4)
    const restored = restoreSetList(parseSetListBackupJson(JSON.stringify(backup)), now, () => crypto.randomUUID())
    expect(restored.performance.sets[0]?.scores[0]?.drummerNotes).toBe(note)
    expect(toSharedSetList(restored).sets[0]?.scores[0]?.drummerNotes).toBe(note)
  })
})
