import type { SavedSetList } from '../domain/types'
import { assertSavedPerformanceValid } from '../domain/setList'
import type { PieceSelectorDatabase } from './database'
import { normalizePerformanceEntries } from '../domain/performanceEntries'

export async function readTonight(database: PieceSelectorDatabase): Promise<SavedSetList | undefined> {
  const saved = (await database.tonight.get('tonight'))?.setList
  return saved ? { ...saved, performance: normalizePerformanceEntries(saved.performance) } : undefined
}

export async function saveTonight(database: PieceSelectorDatabase, setList: SavedSetList): Promise<void> {
  if (setList.locked !== true) throw new Error('Lock this setlist before loading it for tonight.')
  assertSavedPerformanceValid(setList.performance)
  await database.tonight.put({ key: 'tonight', setList: { ...setList, performance: normalizePerformanceEntries(setList.performance) } })
}
