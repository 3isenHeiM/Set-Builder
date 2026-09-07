import type { PerformanceSet, SavedSetList } from './types'

function moved<T>(values: readonly T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= values.length || to >= values.length) return [...values]
  const result = [...values]
  const [item] = result.splice(from, 1)
  if (item === undefined) return result
  result.splice(to, 0, item)
  return result
}

function validPieceOrder(set: PerformanceSet): boolean {
  if (!set.scores[0]?.canStart) return false
  let regularPieceSeen = false
  for (const score of set.scores.slice(1)) {
    if (score.goesHigh && regularPieceSeen) return false
    regularPieceSeen ||= !score.goesHigh
  }
  return true
}

function updated(setList: SavedSetList, updatedAt: string): SavedSetList {
  return { ...setList, updatedAt }
}

export function renameSetList(setList: SavedSetList, name: string, updatedAt: string): SavedSetList {
  return updated({ ...setList, name: name.trim() }, updatedAt)
}

export function renameSet(setList: SavedSetList, setIndex: number, name: string, updatedAt: string): SavedSetList {
  return updated({
    ...setList,
    performance: {
      ...setList.performance,
      sets: setList.performance.sets.map((set, index) => index === setIndex ? { ...set, name: name.trim() } : set),
    },
  }, updatedAt)
}

export function moveSet(setList: SavedSetList, from: number, to: number, updatedAt: string): SavedSetList {
  const sets = moved(setList.performance.sets, from, to).map((set, index) => ({ ...set, number: index + 1 }))
  return updated({ ...setList, performance: { ...setList.performance, sets } }, updatedAt)
}

export function canMovePiece(set: PerformanceSet, from: number, to: number): boolean {
  return from !== to && from > 0 && to > 0 && to < set.scores.length && validPieceOrder({ ...set, scores: moved(set.scores, from, to) })
}

export function movePiece(setList: SavedSetList, setIndex: number, from: number, to: number, updatedAt: string): SavedSetList {
  const target = setList.performance.sets[setIndex]
  if (!target || !canMovePiece(target, from, to)) return setList
  const sets = setList.performance.sets.map((set, index) => index === setIndex ? { ...set, scores: moved(set.scores, from, to) } : set)
  return updated({ ...setList, performance: { ...setList.performance, sets } }, updatedAt)
}
