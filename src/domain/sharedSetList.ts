import { MAX_SCORES_PER_SET, MAX_SETS } from './generator'
import type { Hotness, SavedSetList, DrummerTiming, Score } from './types'
import { readDrummerNotes, readDrummerTiming } from './drummerNotes'
import { pieceKey } from './collections'

export interface SharedPiece {
  displayNumber: string
  title: string
  collection: string
  drumsIntro: boolean
  drummerNotes?: string
  drummerTiming?: DrummerTiming
  hotness?: Hotness
  goesHigh?: boolean
  canStart?: boolean
}

export interface SharedSetList {
  name: string
  updatedAt: string
  generatedAt?: string
  warnings?: string[]
  sets: Array<{ name: string; scores: SharedPiece[] }>
}

export function toSharedSetList(saved: SavedSetList, library: readonly Score[] = []): SharedSetList {
  const byId = new Map(library.map((piece) => [piece.id, piece]))
  const byKey = new Map(library.map((piece) => [pieceKey(piece), piece]))
  return {
    name: saved.name,
    updatedAt: saved.updatedAt,
    generatedAt: saved.performance.generatedAt,
    warnings: [...saved.performance.warnings],
    sets: saved.performance.sets.map((set) => ({ name: set.name ?? '', scores: set.scores.map((score) => {
      const piece = byId.get(score.id) ?? byKey.get(pieceKey(score))
      // Legacy or unconfigured snapshots can lack the Library's timing. Existing
      // notation still wins; this fallback never changes the stored program.
      const savedTiming = score.drummerTiming
      const hasSavedTiming = savedTiming && (savedTiming.bpm !== null || savedTiming.measure !== null || savedTiming.anacrusis !== null)
      const timing = hasSavedTiming ? savedTiming : piece?.drummerTiming ?? savedTiming
      return {
        displayNumber: score.displayNumber, title: score.title, collection: score.collection ?? 'General', drumsIntro: score.drumsIntro,
        drummerNotes: readDrummerNotes(score.drummerNotes ?? piece?.drummerNotes),
        ...(timing === undefined ? {} : { drummerTiming: readDrummerTiming(timing) }),
        hotness: score.hotness, goesHigh: score.goesHigh, canStart: score.canStart,
      }
    }) })),
  }
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum) throw new Error('This shared setlist is unavailable.')
  return value
}

export function parseSharedSetList(value: unknown): SharedSetList {
  if (!record(value) || !Array.isArray(value.sets) || value.sets.length < 1 || value.sets.length > MAX_SETS) throw new Error('This shared setlist is unavailable.')
  const updatedAt = text(value.updatedAt, 100)
  if (Number.isNaN(Date.parse(updatedAt))) throw new Error('This shared setlist is unavailable.')
  const generatedAt = value.generatedAt === undefined ? undefined : text(value.generatedAt, 100)
  if (generatedAt !== undefined && Number.isNaN(Date.parse(generatedAt))) throw new Error('This shared setlist is unavailable.')
  const warnings = value.warnings === undefined ? [] : value.warnings
  if (!Array.isArray(warnings) || warnings.length > 100) throw new Error('This shared setlist is unavailable.')
  return { name: text(value.name, 120), updatedAt, ...(generatedAt ? { generatedAt } : {}), warnings: warnings.map((warning) => text(warning, 500)), sets: value.sets.map((set) => {
    if (!record(set) || !Array.isArray(set.scores) || set.scores.length < 1 || set.scores.length > MAX_SCORES_PER_SET) throw new Error('This shared setlist is unavailable.')
    return { name: text(set.name, 120), scores: set.scores.map((score) => {
      if (!record(score) || typeof score.drumsIntro !== 'boolean') throw new Error('This shared setlist is unavailable.')
      if (score.hotness !== undefined && score.hotness !== 1 && score.hotness !== 2 && score.hotness !== 3) throw new Error('This shared setlist is unavailable.')
      if ((score.goesHigh !== undefined && typeof score.goesHigh !== 'boolean') || (score.canStart !== undefined && typeof score.canStart !== 'boolean')) throw new Error('This shared setlist is unavailable.')
      return { displayNumber: text(score.displayNumber, 100), title: text(score.title, 500), collection: text(score.collection, 120), drumsIntro: score.drumsIntro, drummerNotes: readDrummerNotes(score.drummerNotes), ...(score.drummerTiming === undefined ? {} : { drummerTiming: readDrummerTiming(score.drummerTiming) }), ...(score.hotness === undefined ? {} : { hotness: score.hotness }), ...(score.goesHigh === undefined ? {} : { goesHigh: score.goesHigh }), ...(score.canStart === undefined ? {} : { canStart: score.canStart }) }
    }) }
  }) }
}
