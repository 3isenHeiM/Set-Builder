import { pieceKey } from './collections'
import type { GeneratedPerformance, PerformanceScoreSnapshot, SavedSet, SavedSetList, Score, DrummerTiming, TempoBeat, TimeSignature } from './types'

export const MAX_DRUMMER_NOTES_LENGTH = 100
// Older saved notes remain readable and exportable without truncation.
const MAX_LEGACY_NOTES_LENGTH = 2000
export const MIN_TEMPO = 20
export const MAX_TEMPO = 300
export const TEMPO_BEATS: readonly TempoBeat[] = ['quarter', 'half', 'eighth', 'dotted-quarter', 'dotted-half', 'dotted-eighth']
export const TIME_SIGNATURES: readonly TimeSignature[] = ['2/4', '3/4', '4/4', '5/4', '6/4', '7/4', '2/2', '3/2', '3/8', '5/8', '6/8', '7/8', '9/8', '12/8']
export const PICKUP_BEATS = Array.from({ length: 32 }, (_, index) => (index + 1) / 4)

export function emptyDrummerTiming(): DrummerTiming {
  return { bpm: null, beat: 'quarter', measure: null, anacrusis: null }
}

export function readDrummerTiming(value: unknown): DrummerTiming {
  if (value === undefined) return emptyDrummerTiming()
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid drummer timing.')
  const timing = value as Record<string, unknown>
  const { bpm, beat, measure, anacrusis } = timing
  if (!(bpm === null || (typeof bpm === 'number' && Number.isInteger(bpm) && bpm >= MIN_TEMPO && bpm <= MAX_TEMPO))
    || !TEMPO_BEATS.some((option) => option === beat)
    || !(measure === null || TIME_SIGNATURES.some((option) => option === measure))
    || !(anacrusis === null || (typeof anacrusis === 'number' && PICKUP_BEATS.includes(anacrusis)))) throw new Error('Invalid drummer timing.')
  return { bpm, beat: beat as TempoBeat, measure: measure as TimeSignature | null, anacrusis }
}

export function readDrummerNotesInput(value: unknown, existing: string | undefined): string {
  const text = readDrummerNotes(value)
  if (text.length > MAX_DRUMMER_NOTES_LENGTH && text !== existing) throw new Error('Custom drummer notes must be text of at most 100 characters.')
  return text
}

export function drummerTimingEqual(left: DrummerTiming | undefined, right: DrummerTiming | undefined): boolean {
  const a = readDrummerTiming(left)
  const b = readDrummerTiming(right)
  return a.bpm === b.bpm && a.beat === b.beat && a.measure === b.measure && a.anacrusis === b.anacrusis
}

export function readDrummerNotes(value: unknown): string {
  if (value === undefined) return ''
  if (typeof value !== 'string' || value.length > MAX_LEGACY_NOTES_LENGTH) throw new Error('Drummer notes must be text of at most 2000 characters.')
  return value
}

export function updateSavedDrummerNotes(data: { lastPerformance: GeneratedPerformance | null; setLists: SavedSetList[]; savedSets: SavedSet[] }, pieces: readonly Score[], updatedAt: string) {
  const byId = new Map(pieces.map((piece) => [piece.id, piece]))
  const byKey = new Map(pieces.map((piece) => [pieceKey(piece), piece]))
  const update = (snapshot: PerformanceScoreSnapshot): PerformanceScoreSnapshot => {
    // Imported setlists use fresh IDs, so also match their collection-qualified identifier.
    const piece = byId.get(snapshot.id) ?? byKey.get(pieceKey(snapshot))
    if (!piece || (readDrummerNotes(snapshot.drummerNotes) === readDrummerNotes(piece.drummerNotes) && drummerTimingEqual(snapshot.drummerTiming, piece.drummerTiming))) return snapshot
    return { ...snapshot, drummerNotes: readDrummerNotes(piece.drummerNotes), ...(piece.drummerTiming === undefined && snapshot.drummerTiming === undefined ? {} : { drummerTiming: readDrummerTiming(piece.drummerTiming) }) }
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

export function formatBeats(beats: number): string {
  const whole = Math.floor(beats)
  const fraction = ['', '¼', '½', '¾'][Math.round((beats - whole) * 4)] ?? ''
  return `${whole || !fraction ? whole : ''}${fraction}`
}
