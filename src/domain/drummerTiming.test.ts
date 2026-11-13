import { makeScore } from '../test/fixtures'
import { emptyDrummerTiming, readDrummerTiming, readDrummerNotesInput, updateSavedDrummerNotes } from './drummerNotes'
import { generatePerformance } from './generator'
import { addPiece, createProgramFromStarter } from './setList'
import { createSettingsBackup, parseSettingsBackupJson, applySettingsBackup } from './settingsBackup'
import { createSetListBackup, parseSetListBackupJson, restoreSetList } from './setListBackup'
import { parseSharedSetList, toSharedSetList } from './sharedSetList'
import { emptyCloudState, parseCloudState } from '../data/cloudState'
import type { DrummerTiming } from './types'

const now = '2026-11-13T10:00:00Z'
const timing: DrummerTiming = { bpm: 144, beat: 'quarter', measure: '6/8', anacrusis: 1.5 }

describe('structured drummer timing', () => {
  it('validates BPM, notation, measure, and optional fractional pickup lengths', () => {
    expect(readDrummerTiming(undefined)).toEqual(emptyDrummerTiming())
    expect(readDrummerTiming(timing)).toEqual(timing)
    expect(readDrummerTiming({ ...timing, bpm: 120, beat: 'half', anacrusis: null })).toMatchObject({ bpm: 120, beat: 'half', anacrusis: null })
    for (const invalid of [null, '144', { ...timing, bpm: 19 }, { ...timing, bpm: 301 }, { ...timing, bpm: 144.5 }, { ...timing, beat: 'unknown' }, { ...timing, measure: '0/0' }, { ...timing, anacrusis: 0 }, { ...timing, anacrusis: 1.3 }, { ...timing, anacrusis: 8.25 }]) {
      expect(() => readDrummerTiming(invalid)).toThrow('Invalid drummer timing')
    }
    expect(() => parseCloudState({ ...emptyCloudState(), scores: [makeScore({ drummerTiming: { ...timing, bpm: 999 } })] })).toThrow('Invalid drummer timing')
  })

  it('limits new custom text to 100 characters and preserves unchanged longer legacy notes', () => {
    expect(readDrummerNotesInput('x'.repeat(100), undefined)).toHaveLength(100)
    expect(() => readDrummerNotesInput('x'.repeat(101), undefined)).toThrow('100 characters')
    const legacy = 'x'.repeat(2000)
    expect(readDrummerNotesInput(legacy, legacy)).toBe(legacy)
    expect(() => readDrummerNotesInput('changed' + 'x'.repeat(100), legacy)).toThrow('100 characters')
  })

  it('carries timing through generation, manual composition, backups, cloud validation, and public sharing', () => {
    const score = makeScore({ drummerTiming: timing, drummerNotes: 'Quiet verse' })
    const performance = generatePerformance([score], { preset: 'mix', setCount: 1, scoresPerSet: 1, seed: 1 }, { now, createId: () => 'program' })
    const saved = { id: performance.id, name: 'Event', createdAt: now, updatedAt: now, performance }
    expect(performance.sets[0]?.scores[0]?.drummerTiming).toEqual(timing)
    expect(addPiece(createProgramFromStarter(score, now, 'manual'), 0, makeScore({ ...score, id: 'two', scoreNumber: 2, displayNumber: '02' }), now).performance.sets[0]?.scores[1]?.drummerTiming).toEqual(timing)
    const settings = parseSettingsBackupJson(JSON.stringify(createSettingsBackup([score], now)))
    expect(settings.version).toBe(6)
    expect(applySettingsBackup([makeScore()], settings, now).scores[0]?.drummerTiming).toEqual(timing)
    const backup = createSetListBackup(saved, now)
    expect(backup.version).toBe(4)
    const restored = restoreSetList(parseSetListBackupJson(JSON.stringify(backup)), now, () => crypto.randomUUID())
    expect(restored.performance.sets[0]?.scores[0]?.drummerTiming).toEqual(timing)
    const shared = parseSharedSetList(toSharedSetList(restored))
    expect(shared.sets[0]?.scores[0]?.drummerTiming).toEqual(timing)
    expect(JSON.stringify(shared)).not.toContain('score-1')
    expect(parseCloudState({ ...emptyCloudState(), version: 4, scores: [score], setLists: [saved], lastPerformance: performance }).lastPerformance?.sets[0]?.scores[0]?.drummerTiming).toEqual(timing)
  })

  it('preserves timing with older settings backups and clears it only when explicitly supplied', () => {
    const score = makeScore({ drummerTiming: timing })
    const current = createSettingsBackup([score], now)
    const old = { ...current, version: 5, pieces: current.pieces.map((piece) => { const { drummerTiming: omitted, ...settings } = piece.settings; void omitted; return { ...piece, settings } }) }
    expect(applySettingsBackup([score], parseSettingsBackupJson(JSON.stringify(old)), now).scores[0]?.drummerTiming).toEqual(timing)
    current.pieces[0]!.settings.drummerTiming = emptyDrummerTiming()
    expect(applySettingsBackup([score], current, now).scores[0]?.drummerTiming).toEqual(emptyDrummerTiming())
  })

  it('refreshes imported and reusable appearances while leaving locked snapshots untouched', () => {
    const program = createProgramFromStarter(makeScore(), now, 'program')
    const locked = { ...structuredClone(program), id: 'locked', locked: true, performance: { ...program.performance, id: 'locked' } }
    const imported = structuredClone(program)
    imported.performance.sets[0]!.scores[0]!.id = 'imported-copy'
    const next = updateSavedDrummerNotes({ lastPerformance: locked.performance, setLists: [locked, imported], savedSets: [{ id: 'reusable', name: '', createdAt: now, updatedAt: now, scores: program.performance.sets[0]!.scores }] }, [makeScore({ drummerTiming: timing })], now)
    expect(next.lastPerformance).toBe(locked.performance)
    expect(next.setLists[0]).toBe(locked)
    expect(next.setLists[1]?.performance.sets[0]?.scores[0]?.drummerTiming).toEqual(timing)
    expect(next.savedSets[0]?.scores[0]?.drummerTiming).toEqual(timing)
  })
})
