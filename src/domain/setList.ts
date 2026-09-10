import { MAX_SCORES_PER_SET, MIN_SCORES_PER_SET } from './generator'
import type { GeneratedPerformance, PerformanceScoreSnapshot, PerformanceSet, SavedSetList, Score } from './types'

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

function snapshot(score: Score): PerformanceScoreSnapshot | undefined {
  if (score.availability !== 'active' || score.configuration !== 'complete' || !score.enabled
    || score.canStart === null || score.hotness === null || score.drumsIntro === null || score.goesHigh === null) return undefined
  return {
    id: score.id,
    scoreNumber: score.scoreNumber,
    displayNumber: score.displayNumber,
    title: score.title,
    hotness: score.hotness,
    drumsIntro: score.drumsIntro,
    goesHigh: score.goesHigh,
    canStart: score.canStart,
  }
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

export function canAddPiece(setList: SavedSetList, score: Score): boolean {
  return snapshot(score) !== undefined && !setList.performance.sets.some((set) => set.scores.some((candidate) => candidate.id === score.id))
}

export function addPiece(setList: SavedSetList, setIndex: number, score: Score, updatedAt: string): SavedSetList {
  const target = setList.performance.sets[setIndex]
  const candidate = snapshot(score)
  if (!target || !candidate || !canAddPiece(setList, score) || target.scores.length >= MAX_SCORES_PER_SET) return setList
  const firstRegularIndex = candidate.goesHigh ? target.scores.findIndex((piece, index) => index > 0 && !piece.goesHigh) : -1
  const insertAt = firstRegularIndex < 0 ? target.scores.length : firstRegularIndex
  const scores = [...target.scores]
  scores.splice(insertAt, 0, candidate)
  const nextSet = { ...target, scores }
  if (!validPieceOrder(nextSet)) return setList
  const sets = setList.performance.sets.map((set, index) => index === setIndex ? nextSet : set)
  return updated({ ...setList, performance: { ...setList.performance, sets } }, updatedAt)
}

export function removePiece(setList: SavedSetList, setIndex: number, scoreIndex: number, updatedAt: string): SavedSetList {
  const target = setList.performance.sets[setIndex]
  if (!target || scoreIndex <= 0 || target.scores.length <= MIN_SCORES_PER_SET || scoreIndex >= target.scores.length) return setList
  const scores = target.scores.filter((_score, index) => index !== scoreIndex)
  const sets = setList.performance.sets.map((set, index) => index === setIndex ? { ...set, scores } : set)
  return updated({ ...setList, performance: { ...setList.performance, sets } }, updatedAt)
}

export function assertSavedPerformanceValid(performance: GeneratedPerformance): void {
  if (performance.sets.length !== performance.setCount) throw new Error('Invalid saved program: set count mismatch.')
  const ids = new Set<string>()
  for (const [setIndex, set] of performance.sets.entries()) {
    if (set.number !== setIndex + 1 || set.scores.length < MIN_SCORES_PER_SET || set.scores.length > MAX_SCORES_PER_SET || !validPieceOrder(set)) {
      throw new Error(`Invalid saved program: malformed Set ${setIndex + 1}.`)
    }
    for (const score of set.scores) {
      if (ids.has(score.id)) throw new Error(`Invalid saved program: duplicate score ${score.id}.`)
      ids.add(score.id)
    }
  }
}
