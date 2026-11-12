import { pieceKey } from './collections'
import type { GeneratedPerformance, PerformanceScoreSnapshot, SavedSet, SavedSetList, Score } from './types'

export const MAX_DRUMMER_NOTES_LENGTH = 2000

export function readDrummerNotes(value: unknown): string {
  if (value === undefined) return ''
  if (typeof value !== 'string' || value.length > MAX_DRUMMER_NOTES_LENGTH) throw new Error('Drummer notes must be text of at most 2000 characters.')
  return value
}

export function updateSavedDrummerNotes(data: { lastPerformance: GeneratedPerformance | null; setLists: SavedSetList[]; savedSets: SavedSet[] }, pieces: readonly Score[], updatedAt: string) {
  const byId = new Map(pieces.map((piece) => [piece.id, piece]))
  const byKey = new Map(pieces.map((piece) => [pieceKey(piece), piece]))
  const update = (snapshot: PerformanceScoreSnapshot): PerformanceScoreSnapshot => {
    // Imported setlists use fresh IDs, so also match their collection-qualified identifier.
    const piece = byId.get(snapshot.id) ?? byKey.get(pieceKey(snapshot))
    if (!piece || readDrummerNotes(snapshot.drummerNotes) === readDrummerNotes(piece.drummerNotes)) return snapshot
    return { ...snapshot, drummerNotes: readDrummerNotes(piece.drummerNotes) }
  }
  const performance = (value: GeneratedPerformance): GeneratedPerformance => {
    const sets = value.sets.map((set) => {
      const scores = set.scores.map(update)
      return scores.some((score, index) => score !== set.scores[index]) ? { ...set, scores } : set
    })
    return sets.some((set, index) => set !== value.sets[index]) ? { ...value, sets } : value
  }
  return {
    lastPerformance: data.lastPerformance ? data.setLists.find((saved) => saved.id === data.lastPerformance?.id && saved.locked)?.performance ?? performance(data.lastPerformance) : null,
    setLists: data.setLists.map((saved) => {
      if (saved.locked) return saved
      const next = performance(saved.performance)
      return next === saved.performance ? saved : { ...saved, performance: next, updatedAt }
    }),
    savedSets: data.savedSets.map((saved) => {
      const scores = saved.scores.map(update)
      return scores.some((score, index) => score !== saved.scores[index]) ? { ...saved, scores, updatedAt } : saved
    }),
  }
}
