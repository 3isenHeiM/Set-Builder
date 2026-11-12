import type { GeneratedPerformance, PieceCode, SavedSet, SavedSetList, Score } from './types'

export const DEFAULT_COLLECTION = 'General'
export function readCollection(value: unknown): string {
  if (value === undefined) return DEFAULT_COLLECTION
  if (typeof value !== 'string' || !value.trim() || value.length > 120) throw new Error('Invalid collection name.')
  return collectionName(value)
}
export function collectionName(value?: string): string { return value?.trim().normalize('NFKC') || DEFAULT_COLLECTION }
export function collectionKey(value?: string): string { return collectionName(value).toLocaleLowerCase('en') }
export function validCode(value: unknown): value is PieceCode {
  return typeof value === 'number' ? Number.isSafeInteger(value) && value > 0 : typeof value === 'string' && /^[A-Z]+$/.test(value) && value.length <= 20
}
export function matchesDisplay(code: PieceCode, display: string): boolean {
  return typeof code === 'number' ? /^\d+$/.test(display) && Number(display) === code : display === code
}
export function pieceKey(piece: { scoreNumber: PieceCode; collection?: string }): string {
  return JSON.stringify([collectionKey(piece.collection), piece.scoreNumber])
}
export function compareCodes(a: PieceCode, b: PieceCode): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'number') return -1
  if (typeof b === 'number') return 1
  return a.length - b.length || a.localeCompare(b, 'en')
}
export function comparePieces(a: { scoreNumber: PieceCode; collection?: string }, b: { scoreNumber: PieceCode; collection?: string }): number {
  return collectionKey(a.collection).localeCompare(collectionKey(b.collection)) || compareCodes(a.scoreNumber, b.scoreNumber)
}

export function renameCollectionData(data: { scores: Score[]; lastPerformance: GeneratedPerformance | null; setLists: SavedSetList[]; savedSets: SavedSet[] }, previous: string, name: string) {
  const nextName = readCollection(name)
  const key = collectionKey(previous)
  if (!data.scores.some((score) => collectionKey(score.collection) === key)) throw new Error('Collection no longer exists.')
  const referencedPieces = [...data.scores, ...data.setLists.flatMap((list) => list.performance.sets.flatMap((set) => set.scores)), ...data.savedSets.flatMap((set) => set.scores), ...(data.lastPerformance?.sets.flatMap((set) => set.scores) ?? [])]
  if (collectionKey(nextName) !== key && referencedPieces.some((score) => collectionKey(score.collection) === collectionKey(nextName))) throw new Error('A collection already uses this name.')
  const rename = <T extends { collection?: string }>(piece: T): T => collectionKey(piece.collection) === key ? { ...piece, collection: nextName } : piece
  const performance = (value: GeneratedPerformance): GeneratedPerformance => ({ ...value, sets: value.sets.map((set) => ({ ...set, scores: set.scores.map(rename) })) })
  return {
    scores: data.scores.map(rename),
    lastPerformance: data.lastPerformance ? performance(data.lastPerformance) : null,
    setLists: data.setLists.map((list) => ({ ...list, performance: performance(list.performance) })),
    savedSets: data.savedSets.map((set) => ({ ...set, scores: set.scores.map(rename) })),
  }
}
