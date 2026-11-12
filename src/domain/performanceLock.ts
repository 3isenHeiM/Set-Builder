import type { GeneratedPerformance, SavedSetList } from './types'

export const LOCKED_SET_LIST_ERROR = 'This setlist is locked. Unlock it before editing.'

export function assertSetListEditable(saved: SavedSetList | undefined): void {
  if (saved?.locked) throw new Error(LOCKED_SET_LIST_ERROR)
}

export function changeSetListLock(saved: SavedSetList, locked: boolean, updatedAt: string): SavedSetList {
  return { ...saved, locked, updatedAt }
}

// Also protects against stale clients dropping a lock or unlocking and editing in one save.
export function assertLockedProgramsUnchanged(previous: SavedSetList[], next: SavedSetList[], lastPerformance: GeneratedPerformance | null): void {
  for (const saved of previous.filter((list) => list.locked)) {
    const replacement = next.find((list) => list.id === saved.id)
    if (!replacement || typeof replacement.locked !== 'boolean'
      || saved.name !== replacement.name || saved.createdAt !== replacement.createdAt
      || JSON.stringify(saved.performance) !== JSON.stringify(replacement.performance)
      || (lastPerformance?.id === saved.id && JSON.stringify(lastPerformance) !== JSON.stringify(saved.performance))) {
      throw new Error(LOCKED_SET_LIST_ERROR)
    }
  }
}
