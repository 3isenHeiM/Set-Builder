import { makeScore, makeSetList } from '../test/fixtures'
import { assertLockedProgramsUnchanged, changeSetListLock } from './performanceLock'
import { addNewSet, addPiece, addSavedSetToProgram, canAddPiece, canMoveBetweenSets, linkSavedSet, moveBetweenSets, movePiece, moveSet, removePiece, removeSetFromProgram, renameSet, renameSetList, setOrderOverride } from './setList'
import { updateSavedDrummerNotes } from './drummerNotes'
import { renameCollectionData } from './collections'

describe('performance locks', () => {
  it('prevents all program editing operations until explicitly unlocked', () => {
    const saved = makeSetList({ locked: true })
    const piece = makeScore({ id: 'second', scoreNumber: 2, displayNumber: '02' })
    const reusable = { id: 'reusable', name: 'New', createdAt: saved.createdAt, updatedAt: saved.updatedAt, scores: saved.performance.sets[0]!.scores }
    const attempts = [renameSetList(saved, 'Changed', 'later'), renameSet(saved, 0, 'Changed', 'later'), moveSet(saved, 0, 1, 'later'), movePiece(saved, 0, 1, 2, 'later'), addPiece(saved, 0, piece, 'later'), removePiece(saved, 0, 0, 'later'), addNewSet(saved, piece, 'later'), removeSetFromProgram(saved, 0, 'later'), setOrderOverride(saved, 0, true, 'later'), moveBetweenSets(saved, 0, 0, 1, 'later'), addSavedSetToProgram(saved, reusable, 'later'), linkSavedSet(saved, 0, reusable, 'later')]
    expect(attempts.every((next) => next === saved)).toBe(true)
    expect(canAddPiece(saved, piece)).toBe(false)
    expect(canMoveBetweenSets(saved, 0, 0, 1)).toBe(false)
    const unlocked = changeSetListLock(saved, false, 'later')
    expect(renameSetList(unlocked, 'Changed', 'later').name).toBe('Changed')
  })

  it('rejects stale saves, deletion, dropped locks and edits combined with unlocking', () => {
    const saved = makeSetList({ locked: true })
    expect(() => assertLockedProgramsUnchanged([saved], [changeSetListLock(saved, false, 'later')], saved.performance)).not.toThrow()
    for (const next of [[], [makeSetList()], [{ ...saved, name: 'Changed' }], [{ ...saved, locked: false, name: 'Changed' }]]) {
      expect(() => assertLockedProgramsUnchanged([saved], next, saved.performance)).toThrow('locked')
    }
    expect(() => assertLockedProgramsUnchanged([saved], [saved], { ...saved.performance, warnings: ['Changed'] })).toThrow('locked')
  })

  it('freezes notes and collection labels in locked programs and their last-performance copy', () => {
    const saved = makeSetList({ locked: true })
    const score = makeScore({ drummerNotes: 'New note' })
    const data = { scores: [score], collections: ['General'], lastPerformance: saved.performance, setLists: [saved], savedSets: [] }
    const notes = updateSavedDrummerNotes(data, [score], 'later')
    const renamed = renameCollectionData(data, 'General', 'New name')
    expect(notes.setLists[0]).toBe(saved)
    expect(notes.lastPerformance).toBe(saved.performance)
    expect(renamed.setLists[0]).toBe(saved)
    expect(renamed.lastPerformance).toBe(saved.performance)
    expect(renamed.scores[0]?.collection).toBe('New name')
  })
})
