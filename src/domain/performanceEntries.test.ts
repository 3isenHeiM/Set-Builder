import { makePerformance, makeScore, makeSetList } from '../test/fixtures'
import { entryKey, normalizePerformanceEntries, pieceOccurrenceCounts, uniqueEntries } from './performanceEntries'
import { addNewSet, addPiece, assertSavedPerformanceValid, moveBetweenSets, removePiece } from './setList'
import { assertPerformanceValid } from './generator'

describe('repeated program appearances', () => {
  it('retains piece identities with separate, stable entry keys and normalizes idempotently', () => {
    const piece = makePerformance().sets[0]!.scores[0]!
    const original = makePerformance({ scoresPerSet: 3, sets: [{ number: 1, scores: [piece, piece, { ...piece, id: 'repeat:1', scoreNumber: 2, displayNumber: '02' }] }] })
    const normalized = normalizePerformanceEntries(original)
    const entries = normalized.sets[0]!.scores
    expect(new Set(entries.map(entryKey)).size).toBe(3)
    expect(entries.map((score) => score.id)).toEqual(['score-1', 'score-1', 'repeat:1'])
    expect(normalizePerformanceEntries(normalized)).toBe(normalized)
    expect(piece.entryId).toBeUndefined()
    expect(() => assertSavedPerformanceValid(normalized)).not.toThrow()
    expect(() => assertPerformanceValid(normalized)).toThrow('duplicate')
    expect(new Set(uniqueEntries([piece, piece], entries).map(entryKey)).size).toBe(2)
  })

  it('matches imported IDs, leading zeros, and source IDs without confusing different collections', () => {
    const piece = makePerformance().sets[0]!.scores[0]!
    const imported = { ...piece, id: 'fresh-import', displayNumber: '1' }
    const otherCollection = { ...piece, id: 'other-piece', collection: 'Christmas' }
    const sameIdRenamedCollection = { ...piece, collection: 'Moved' }
    const count = pieceOccurrenceCounts([piece, imported, otherCollection, sameIdRenamedCollection])
    expect(count(piece)).toBeGreaterThan(1)
    expect(count(imported)).toBeGreaterThan(1)
    expect(count(sameIdRenamedCollection)).toBeGreaterThan(1)
    expect(count(otherCollection)).toBe(1)
    const publicCount = pieceOccurrenceCounts([{ displayNumber: '01', collection: 'General' }, { displayNumber: '1', collection: 'GENERAL' }])
    expect(publicCount({ displayNumber: '01' })).toBe(2)
  })

  it('moves and removes one repeat independently while retaining starters and eligibility checks', () => {
    const piece = makeScore()
    let program = addPiece(makeSetList(), 0, piece, 'added')
    program = addNewSet(program, piece, 'new set')
    const moved = moveBetweenSets(program, 0, 1, 1, 'moved')
    expect(moved.performance.sets.map((set) => set.scores.length)).toEqual([1, 2])
    const removed = removePiece(moved, 1, 1, 'removed')
    expect(removed.performance.sets.map((set) => set.scores.length)).toEqual([1, 1])
    expect(new Set(removed.performance.sets.flatMap((set) => set.scores.map(entryKey))).size).toBe(2)
    expect(() => assertSavedPerformanceValid(removed.performance)).not.toThrow()
    expect(addNewSet(program, { ...piece, canStart: false }, 'invalid')).toBe(program)
    expect(addPiece(program, 0, { ...piece, enabled: false }, 'invalid')).toBe(program)
  })
})
