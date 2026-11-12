import type { PerformanceScoreSnapshot, SavedSetList } from './types'
import { addNewSet, addPiece, addSavedSetToProgram, assertSavedPerformanceValid, assertSavedSetValid, canAddPiece, canAddSavedSet, canMoveBetweenSets, canMovePiece, createProgramFromSavedSet, createProgramFromStarter, linkSavedSet, moveBetweenSets, movePiece, moveSet, removePiece, removeSetFromProgram, renameSet, renameSetList } from './setList'
import { makePerformance, makeScore } from '../test/fixtures'

function piece(id: string, goesHigh = false, canStart = false): PerformanceScoreSnapshot {
  return { id, scoreNumber: Number(id), displayNumber: id, title: `Piece ${id}`, hotness: 2, drumsIntro: false, goesHigh, canStart }
}

function saved(): SavedSetList {
  return {
    id: 'list',
    name: 'Original',
    createdAt: 'created',
    updatedAt: 'created',
    performance: makePerformance({
      setCount: 2,
      scoresPerSet: 4,
      sets: [
        { number: 1, name: 'First', scores: [piece('1', false, true), piece('2', true), piece('3'), piece('4')] },
        { number: 2, name: 'Second', scores: [piece('5', false, true), piece('6', true), piece('7'), piece('8')] },
      ],
    }),
  }
}

describe('editable set lists', () => {
  it('creates a program and a second set from unused ready starters', () => {
    const first = makeScore()
    const second = makeScore({ id: 'score-2', scoreNumber: 2, displayNumber: '02' })
    const program = createProgramFromStarter(first, '2026-01-01T00:00:00Z', 'program')
    const next = addNewSet(program, second, 'later')
    expect(next.performance.sets.map((set) => set.scores[0]?.id)).toEqual(['score-1', 'score-2'])
    expect(addNewSet(next, first, 'later')).toBe(next)
    expect(() => assertSavedPerformanceValid(next.performance)).not.toThrow()
  })

  it('moves a piece between sets while retaining valid starters and high-piece ordering', () => {
    const original = saved()
    expect(canMoveBetweenSets(original, 0, 1, 1)).toBe(true)
    const result = moveBetweenSets(original, 0, 1, 1, 'moved')
    expect(result.performance.sets[0]?.scores.map((score) => score.id)).toEqual(['1', '3', '4'])
    expect(result.performance.sets[1]?.scores.map((score) => score.id)).toEqual(['5', '6', '2', '7', '8'])
    expect(canMoveBetweenSets(original, 0, 0, 1)).toBe(false)
    expect(() => assertSavedPerformanceValid(result.performance)).not.toThrow()
  })
  it('renames lists and individual sets', () => {
    const list = renameSetList(saved(), '  Parade  ', 'renamed')
    expect(list).toMatchObject({ name: 'Parade', updatedAt: 'renamed' })
    expect(renameSet(list, 0, ' Opening ', 'set-renamed').performance.sets[0]).toMatchObject({ name: 'Opening' })
  })

  it('moves whole sets and updates their displayed numbers', () => {
    const result = moveSet(saved(), 1, 0, 'moved')
    expect(result.performance.sets.map((set) => [set.number, set.name])).toEqual([[1, 'Second'], [2, 'First']])
  })

  it('reorders pieces without displacing a starter or a goes-high piece', () => {
    const set = saved().performance.sets[0]
    if (!set) throw new Error('missing fixture set')
    expect(canMovePiece(set, 3, 2)).toBe(true)
    expect(canMovePiece(set, 2, 1)).toBe(false)
    expect(canMovePiece(set, 1, 2)).toBe(false)
    expect(canMovePiece(set, 1, 0)).toBe(false)
    expect(movePiece(saved(), 0, 3, 2, 'moved').performance.sets[0]?.scores.map((score) => score.id)).toEqual(['1', '2', '4', '3'])
  })

  it('adds eligible unused pieces and removes non-starters', () => {
    const program = saved()
    const newPiece = makeScore({ id: '9', scoreNumber: 9, displayNumber: '09', title: 'Africa' })
    const added = addPiece(program, 0, newPiece, 'added')
    expect(canAddPiece(program, newPiece)).toBe(true)
    expect(added.performance.sets[0]?.scores.map((score) => score.id)).toEqual(['1', '2', '3', '4', '9'])
    expect(canAddPiece(added, newPiece)).toBe(false)
    expect(removePiece(added, 0, 1, 'removed').performance.sets[0]?.scores.map((score) => score.id)).toEqual(['1', '3', '4', '9'])
    expect(removePiece(added, 0, 0, 'unchanged')).toBe(added)
    expect(() => assertSavedPerformanceValid(added.performance)).not.toThrow()
  })

  it('links a reusable named set without changing its pieces', () => {
    const program = saved()
    const reusable = { id: 'saved-opening', name: 'Hot Set', createdAt: 'created', updatedAt: 'saved', scores: program.performance.sets[0]!.scores }
    const linked = linkSavedSet(program, 0, reusable, 'linked')
    expect(linked.performance.sets[0]).toMatchObject({ savedSetId: 'saved-opening', name: 'Hot Set' })
    expect(() => assertSavedSetValid(reusable)).not.toThrow()
  })

  it('builds a program from reusable sets without repeated pieces', () => {
    const first = { id: 'hot', name: 'Hot Set', createdAt: 'created', updatedAt: 'created', scores: [piece('1', false, true), piece('2')] }
    const second = { id: 'slow', name: 'Slow Set', createdAt: 'created', updatedAt: 'created', scores: [piece('3', false, true), piece('4')] }
    const program = createProgramFromSavedSet(first, 'created', 'program')
    expect(canAddSavedSet(program.performance, second)).toBe(true)
    const combined = addSavedSetToProgram(program, second, 'combined')
    expect(combined.performance.sets.map((set) => [set.number, set.name])).toEqual([[1, 'Hot Set'], [2, 'Slow Set']])
    expect(canAddSavedSet(combined.performance, first)).toBe(false)
    expect(removeSetFromProgram(combined, 0, 'removed').performance.sets).toMatchObject([{ number: 1, name: 'Slow Set' }])
  })
})
