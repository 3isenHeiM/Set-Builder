import { collectionKey } from './collections'
import type { GeneratedPerformance, PerformanceScoreSnapshot, PieceCode } from './types'

export interface PieceIdentity {
  id?: string
  scoreNumber?: PieceCode
  displayNumber: string
  collection?: string
}

export function entryKey(piece: PerformanceScoreSnapshot): string { return piece.entryId ?? piece.id }

export function uniqueEntries(pieces: readonly PerformanceScoreSnapshot[], existing: readonly PerformanceScoreSnapshot[] = []): PerformanceScoreSnapshot[] {
  const used = new Set(existing.map(entryKey))
  let next = 1
  return pieces.map((piece) => {
    let result = piece
    if (used.has(entryKey(piece))) {
      while (used.has(`repeat:${next}`)) next += 1
      result = { ...piece, entryId: `repeat:${next++}` }
    }
    used.add(entryKey(result))
    return result
  })
}

export function normalizePerformanceEntries(performance: GeneratedPerformance): GeneratedPerformance {
  const used: PerformanceScoreSnapshot[] = []
  const sets = performance.sets.map((set) => {
    const scores = uniqueEntries(set.scores, used)
    used.push(...scores)
    return scores.some((score, index) => score !== set.scores[index]) ? { ...set, scores } : set
  })
  return sets.some((set, index) => set !== performance.sets[index]) ? { ...performance, sets } : performance
}

function identityKey(piece: PieceIdentity): string {
  const display = piece.displayNumber.trim()
  const code = piece.scoreNumber ?? (/^\d+$/.test(display) ? Number(display) : display)
  return JSON.stringify([collectionKey(piece.collection), code])
}

export function pieceOccurrenceCounts(pieces: readonly PieceIdentity[]): (piece: PieceIdentity) => number {
  const ids = new Map<string, number>()
  const codes = new Map<string, number>()
  for (const piece of pieces) {
    if (piece.id) ids.set(piece.id, (ids.get(piece.id) ?? 0) + 1)
    const key = identityKey(piece)
    codes.set(key, (codes.get(key) ?? 0) + 1)
  }
  return (piece) => Math.max(piece.id ? ids.get(piece.id) ?? 0 : 0, codes.get(identityKey(piece)) ?? 0)
}

// Shared views use public metadata only; never expose internal piece or entry IDs.
export function sharedSetKeys(sets: readonly { name: string; scores: readonly PieceIdentity[] }[]): string[] {
  const used = new Map<string, number>()
  return sets.map((set) => {
    const first = set.scores[0]
    const base = JSON.stringify([first ? identityKey(first) : '', set.name])
    const occurrence = used.get(base) ?? 0
    used.set(base, occurrence + 1)
    return `${base}:${occurrence}`
  })
}
