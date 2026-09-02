import type { PerformanceScoreSnapshot, SavedSetList } from './types'
import { canMovePiece, movePiece, moveSet, renameSet, renameSetList } from './setList'
import { makePerformance } from '../test/fixtures'

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
})
