import type { SavedSetList } from '../domain/types'
import { assertSavedPerformanceValid } from '../domain/setList'
import type { PieceSelectorDatabase } from './database'

export async function readTonight(database: PieceSelectorDatabase): Promise<SavedSetList | undefined> {
  return (await database.tonight.get('tonight'))?.setList
}

export async function saveTonight(database: PieceSelectorDatabase, setList: SavedSetList): Promise<void> {
  if (setList.locked !== true) throw new Error('Lock this setlist before loading it for tonight.')
  assertSavedPerformanceValid(setList.performance)
  await database.tonight.put({ key: 'tonight', setList })
}
