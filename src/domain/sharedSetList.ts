import { MAX_SCORES_PER_SET, MAX_SETS } from './generator'
import type { SavedSetList } from './types'
import { readDrummerNotes } from './drummerNotes'

export interface SharedPiece {
  displayNumber: string
  title: string
  collection: string
  drumsIntro: boolean
  drummerNotes?: string
}

export interface SharedSetList {
  name: string
  updatedAt: string
  sets: Array<{ name: string; scores: SharedPiece[] }>
}

export function toSharedSetList(saved: SavedSetList): SharedSetList {
  return {
    name: saved.name,
    updatedAt: saved.updatedAt,
    sets: saved.performance.sets.map((set) => ({ name: set.name ?? '', scores: set.scores.map((score) => ({
      displayNumber: score.displayNumber, title: score.title, collection: score.collection ?? 'General', drumsIntro: score.drumsIntro,
      drummerNotes: readDrummerNotes(score.drummerNotes),
    })) })),
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
  return { name: text(value.name, 120), updatedAt, sets: value.sets.map((set) => {
    if (!record(set) || !Array.isArray(set.scores) || set.scores.length < 1 || set.scores.length > MAX_SCORES_PER_SET) throw new Error('This shared setlist is unavailable.')
    return { name: text(set.name, 120), scores: set.scores.map((score) => {
      if (!record(score) || typeof score.drumsIntro !== 'boolean') throw new Error('This shared setlist is unavailable.')
      return { displayNumber: text(score.displayNumber, 100), title: text(score.title, 500), collection: text(score.collection, 120), drumsIntro: score.drumsIntro, drummerNotes: readDrummerNotes(score.drummerNotes) }
    }) }
  }) }
}
