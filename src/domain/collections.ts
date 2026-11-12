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

export function collectionNames(scores: readonly { collection?: string }[], names: readonly string[] = []): string[] {
  const unique = new Map([[collectionKey(DEFAULT_COLLECTION), DEFAULT_COLLECTION]])
  for (const name of [...names, ...scores.map((score) => collectionName(score.collection))]) {
    const normalized = readCollection(name)
    if (!unique.has(collectionKey(normalized))) unique.set(collectionKey(normalized), normalized)
  }
  return [...unique.values()].sort((a, b) => a === DEFAULT_COLLECTION ? -1 : b === DEFAULT_COLLECTION ? 1 : a.localeCompare(b))
}

export function createCollectionNames(scores: readonly Score[], names: readonly string[], name: string): string[] {
  const nextName = readCollection(name)
  const existing = collectionNames(scores, names)
  if (existing.some((value) => collectionKey(value) === collectionKey(nextName))) throw new Error('A collection already uses this name.')
  return collectionNames(scores, [...existing, nextName])
}

export function assignPiecesToCollection(scores: readonly Score[], ids: readonly string[], name: string, updatedAt: string): Score[] {
  const target = readCollection(name)
  const selected = new Set(ids)
  if (!selected.size || scores.filter((score) => selected.has(score.id)).length !== selected.size) throw new Error('This score no longer exists.')
  const result = scores.map((score) => selected.has(score.id) ? { ...score, collection: target, updatedAt } : score)
  const keys = new Set<string>()
  for (const score of result) {
    const key = pieceKey(score)
    if (keys.has(key)) throw new Error(`Collection already contains identifier ${score.displayNumber}. No pieces were moved.`)
    keys.add(key)
  }
  return result.sort(comparePieces)
}

export function renameCollectionData(data: { scores: Score[]; collections?: string[]; lastPerformance: GeneratedPerformance | null; setLists: SavedSetList[]; savedSets: SavedSet[] }, previous: string, name: string) {
  const nextName = readCollection(name)
  const key = collectionKey(previous)
  const names = collectionNames(data.scores, data.collections)
  if (!names.some((value) => collectionKey(value) === key)) throw new Error('Collection no longer exists.')
  const referencedPieces = [...data.scores, ...data.setLists.flatMap((list) => list.performance.sets.flatMap((set) => set.scores)), ...data.savedSets.flatMap((set) => set.scores), ...(data.lastPerformance?.sets.flatMap((set) => set.scores) ?? [])]
  if (collectionKey(nextName) !== key && [...names, ...referencedPieces.map((piece) => collectionName(piece.collection))].some((value) => collectionKey(value) === collectionKey(nextName))) throw new Error('A collection already uses this name.')
  const rename = <T extends { collection?: string }>(piece: T): T => collectionKey(piece.collection) === key ? { ...piece, collection: nextName } : piece
  const performance = (value: GeneratedPerformance): GeneratedPerformance => ({ ...value, sets: value.sets.map((set) => ({ ...set, scores: set.scores.map(rename) })) })
  return {
    collections: collectionNames([], names.map((value) => collectionKey(value) === key ? nextName : value)),
    scores: data.scores.map(rename),
    lastPerformance: data.lastPerformance ? data.setLists.find((list) => list.id === data.lastPerformance?.id && list.locked)?.performance ?? performance(data.lastPerformance) : null,
    setLists: data.setLists.map((list) => list.locked ? list : ({ ...list, performance: performance(list.performance) })),
    savedSets: data.savedSets.map((set) => ({ ...set, scores: set.scores.map(rename) })),
  }
}
