import { MAX_SCORES_PER_SET, MAX_SETS, MIN_SCORES_PER_SET } from './generator'
import type { GeneratedPerformance, PerformanceScoreSnapshot, PerformanceSet, SavedSet, SavedSetList, Score } from './types'
import { pieceKey } from './collections'

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
  if (set.orderOverride) return true
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
    ...(score.collection ? { collection: score.collection } : {}),
    displayNumber: score.displayNumber,
    title: score.title,
    hotness: score.hotness,
    drumsIntro: score.drumsIntro,
    ...(score.drummerNotes ? { drummerNotes: score.drummerNotes } : {}),
    ...(score.drummerTiming === undefined ? {} : { drummerTiming: { ...score.drummerTiming } }),
    goesHigh: score.goesHigh,
    canStart: score.canStart,
  }
}

function updated(setList: SavedSetList, updatedAt: string): SavedSetList {
  return { ...setList, updatedAt }
}

export function renameSetList(setList: SavedSetList, name: string, updatedAt: string): SavedSetList {
  if (setList.locked) return setList
  return updated({ ...setList, name: name.trim() }, updatedAt)
}

export function renameSet(setList: SavedSetList, setIndex: number, name: string, updatedAt: string): SavedSetList {
  if (setList.locked) return setList
  return updated({
    ...setList,
    performance: {
      ...setList.performance,
      sets: setList.performance.sets.map((set, index) => index === setIndex ? { ...set, name: name.trim() } : set),
    },
  }, updatedAt)
}

export function linkSavedSet(setList: SavedSetList, setIndex: number, savedSet: SavedSet, updatedAt: string): SavedSetList {
  if (setList.locked) return setList
  const sets = setList.performance.sets.map((set, index) => index === setIndex ? { ...set, name: savedSet.name, savedSetId: savedSet.id } : set)
  return updated({ ...setList, performance: { ...setList.performance, sets } }, updatedAt)
}

export function moveSet(setList: SavedSetList, from: number, to: number, updatedAt: string): SavedSetList {
  if (setList.locked) return setList
  const sets = moved(setList.performance.sets, from, to).map((set, index) => ({ ...set, number: index + 1 }))
  return updated({ ...setList, performance: { ...setList.performance, sets } }, updatedAt)
}

export function canMovePiece(set: PerformanceSet, from: number, to: number): boolean {
  return Number.isInteger(from) && Number.isInteger(to) && from !== to && from > 0 && from < set.scores.length && to > 0 && to < set.scores.length && validPieceOrder({ ...set, scores: moved(set.scores, from, to) })
}

export function setOrderOverride(setList: SavedSetList, setIndex: number, enabled: boolean, updatedAt: string): SavedSetList {
  if (setList.locked) return setList
  const target = setList.performance.sets[setIndex]
  if (!target) return setList
  const [starter, ...remaining] = target.scores
  if (!starter) return setList
  const scores = enabled ? target.scores : [starter, ...remaining.filter((score) => score.goesHigh), ...remaining.filter((score) => !score.goesHigh)]
  const sets = setList.performance.sets.map((set, index) => index === setIndex ? { ...set, orderOverride: enabled, scores } : set)
  return updated({ ...setList, performance: { ...setList.performance, sets } }, updatedAt)
}

export function movePiece(setList: SavedSetList, setIndex: number, from: number, to: number, updatedAt: string): SavedSetList {
  if (setList.locked) return setList
  const target = setList.performance.sets[setIndex]
  if (!target || !canMovePiece(target, from, to)) return setList
  const sets = setList.performance.sets.map((set, index) => index === setIndex ? { ...set, scores: moved(set.scores, from, to) } : set)
  return updated({ ...setList, performance: { ...setList.performance, sets } }, updatedAt)
}

export function canAddPiece(setList: SavedSetList, score: Score): boolean {
  return !setList.locked && snapshot(score) !== undefined && !setList.performance.sets.some((set) => set.scores.some((candidate) => candidate.id === score.id || pieceKey(candidate) === pieceKey(score)))
}

export function addPiece(setList: SavedSetList, setIndex: number, score: Score, updatedAt: string): SavedSetList {
  if (setList.locked) return setList
  const target = setList.performance.sets[setIndex]
  const candidate = snapshot(score)
  if (!target || !candidate || !canAddPiece(setList, score) || target.scores.length >= MAX_SCORES_PER_SET) return setList
  const firstRegularIndex = candidate.goesHigh && !target.orderOverride ? target.scores.findIndex((piece, index) => index > 0 && !piece.goesHigh) : -1
  const insertAt = firstRegularIndex < 0 ? target.scores.length : firstRegularIndex
  const scores = [...target.scores]
  scores.splice(insertAt, 0, candidate)
  const nextSet = { ...target, scores }
  if (!validPieceOrder(nextSet)) return setList
  const sets = setList.performance.sets.map((set, index) => index === setIndex ? nextSet : set)
  return updated({ ...setList, performance: { ...setList.performance, sets } }, updatedAt)
}

export function removePiece(setList: SavedSetList, setIndex: number, scoreIndex: number, updatedAt: string): SavedSetList {
  if (setList.locked) return setList
  const target = setList.performance.sets[setIndex]
  if (!target || scoreIndex < 0 || target.scores.length <= MIN_SCORES_PER_SET || scoreIndex >= target.scores.length) return setList
  const scores = target.scores.filter((_score, index) => index !== scoreIndex)
  if (!validPieceOrder({ ...target, scores })) return setList
  const sets = setList.performance.sets.map((set, index) => index === setIndex ? { ...set, scores } : set)
  return updated({ ...setList, performance: { ...setList.performance, sets } }, updatedAt)
}

export function canMoveBetweenSets(setList: SavedSetList, from: number, scoreIndex: number, to: number): boolean {
  if (setList.locked) return false
  const source = setList.performance.sets[from]
  const destination = setList.performance.sets[to]
  const score = source?.scores[scoreIndex]
  if (!source || !destination || !score || from === to || source.scores.length <= MIN_SCORES_PER_SET || destination.scores.length >= MAX_SCORES_PER_SET) return false
  return validPieceOrder({ ...source, scores: source.scores.filter((_, index) => index !== scoreIndex) })
}

export function moveBetweenSets(setList: SavedSetList, from: number, scoreIndex: number, to: number, updatedAt: string): SavedSetList {
  if (setList.locked) return setList
  if (!canMoveBetweenSets(setList, from, scoreIndex, to)) return setList
  const source = setList.performance.sets[from]!
  const destination = setList.performance.sets[to]!
  const score = source.scores[scoreIndex]!
  const scores = [...destination.scores]
  const firstRegular = score.goesHigh && !destination.orderOverride ? scores.findIndex((piece, index) => index > 0 && !piece.goesHigh) : -1
  scores.splice(firstRegular < 0 ? scores.length : firstRegular, 0, score)
  const sets = setList.performance.sets.map((set, index) => index === from ? { ...set, scores: source.scores.filter((_, i) => i !== scoreIndex) } : index === to ? { ...set, scores } : set)
  return updated({ ...setList, performance: { ...setList.performance, sets } }, updatedAt)
}

export function addNewSet(setList: SavedSetList, starter: Score, updatedAt: string): SavedSetList {
  if (setList.locked) return setList
  const candidate = snapshot(starter)
  if (!candidate?.canStart || !canAddPiece(setList, starter) || setList.performance.sets.length >= MAX_SETS) return setList
  const sets = [...setList.performance.sets, { number: setList.performance.sets.length + 1, scores: [candidate] }]
  return updated({ ...setList, performance: { ...setList.performance, setCount: sets.length, sets } }, updatedAt)
}

export function createProgramFromStarter(starter: Score, now: string, id: string): SavedSetList {
  const candidate = snapshot(starter)
  if (!candidate?.canStart) throw new Error('Choose a ready starter.')
  return { id, name: '', createdAt: now, updatedAt: now, performance: { id, generatedAt: now, preset: 'mix', seed: 0, setCount: 1, scoresPerSet: 1, sets: [{ number: 1, scores: [candidate] }], warnings: [] } }
}

export function assertSavedPerformanceValid(performance: GeneratedPerformance): void {
  if (performance.sets.length < 1 || performance.sets.length > MAX_SETS) throw new Error('Invalid saved program: set count out of range.')
  if (performance.sets.length !== performance.setCount) throw new Error('Invalid saved program: set count mismatch.')
  const ids = new Set<string>()
  const numbers = new Set<string>()
  for (const [setIndex, set] of performance.sets.entries()) {
    if (set.number !== setIndex + 1 || set.scores.length < MIN_SCORES_PER_SET || set.scores.length > MAX_SCORES_PER_SET || !validPieceOrder(set)) {
      throw new Error(`Invalid saved program: malformed Set ${setIndex + 1}.`)
    }
    for (const score of set.scores) {
      if (ids.has(score.id) || numbers.has(pieceKey(score))) throw new Error(`Invalid saved program: duplicate score ${score.id}.`)
      ids.add(score.id)
      numbers.add(pieceKey(score))
    }
  }
}

export function assertSavedSetValid(savedSet: SavedSet): void {
  if (savedSet.scores.length < MIN_SCORES_PER_SET || savedSet.scores.length > MAX_SCORES_PER_SET
    || !validPieceOrder({ number: 1, ...savedSet })) throw new Error('Invalid saved set.')
  if (new Set(savedSet.scores.map((score) => score.id)).size !== savedSet.scores.length
    || new Set(savedSet.scores.map(pieceKey)).size !== savedSet.scores.length) throw new Error('Invalid saved set: duplicate piece.')
}

export function canAddSavedSet(performance: GeneratedPerformance, savedSet: SavedSet): boolean {
  const usedIds = new Set(performance.sets.flatMap((set) => set.scores.map((score) => score.id)))
  const usedNumbers = new Set(performance.sets.flatMap((set) => set.scores.map(pieceKey)))
  return performance.sets.length < MAX_SETS && savedSet.scores.every((score) => !usedIds.has(score.id) && !usedNumbers.has(pieceKey(score)))
}

export function createProgramFromSavedSet(savedSet: SavedSet, now: string, id: string): SavedSetList {
  const performance: GeneratedPerformance = {
    id,
    generatedAt: now,
    preset: 'mix',
    seed: 0,
    setCount: 1,
    scoresPerSet: savedSet.scores.length,
    sets: [{ number: 1, name: savedSet.name, savedSetId: savedSet.id, ...(savedSet.orderOverride === undefined ? {} : { orderOverride: savedSet.orderOverride }), scores: [...savedSet.scores] }],
    warnings: [],
  }
  assertSavedPerformanceValid(performance)
  return { id, name: '', createdAt: now, updatedAt: now, performance }
}

export function addSavedSetToProgram(setList: SavedSetList, savedSet: SavedSet, updatedAt: string): SavedSetList {
  if (setList.locked) return setList
  if (!canAddSavedSet(setList.performance, savedSet)) return setList
  const sets = [...setList.performance.sets, { number: setList.performance.sets.length + 1, name: savedSet.name, savedSetId: savedSet.id, ...(savedSet.orderOverride === undefined ? {} : { orderOverride: savedSet.orderOverride }), scores: [...savedSet.scores] }]
  return updated({ ...setList, performance: { ...setList.performance, setCount: sets.length, sets } }, updatedAt)
}

export function removeSetFromProgram(setList: SavedSetList, setIndex: number, updatedAt: string): SavedSetList {
  if (setList.locked) return setList
  if (setList.performance.sets.length <= 1 || setIndex < 0 || setIndex >= setList.performance.sets.length) return setList
  const sets = setList.performance.sets.filter((_set, index) => index !== setIndex).map((set, index) => ({ ...set, number: index + 1 }))
  return updated({ ...setList, performance: { ...setList.performance, setCount: sets.length, sets } }, updatedAt)
}
