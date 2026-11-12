import type { CloudState } from './cloudState'
import { CLOUD_STATE_FORMAT, CLOUD_STATE_VERSION, parseCloudState } from './cloudState'
import type { CloudSyncRecord, PieceSelectorDatabase } from './database'
import { collectionKey } from '../domain/collections'

export async function readCachedState(database: PieceSelectorDatabase): Promise<CloudState> {
  const [scores, lastScan, storedPerformance, setLists, savedSets, collections] = await database.transaction(
    'r',
    [database.scores, database.scans, database.performances, database.savedSetLists, database.savedSets, database.collections],
    async () => Promise.all([
      database.scores.orderBy('scoreNumber').toArray(),
      database.scans.orderBy('appliedAt').last(),
      database.performances.get('last'),
      database.savedSetLists.orderBy('updatedAt').reverse().toArray(),
      database.savedSets.orderBy('updatedAt').reverse().toArray(),
      database.collections.toArray(),
    ]),
  )
  return parseCloudState({
    format: CLOUD_STATE_FORMAT,
    version: CLOUD_STATE_VERSION,
    scores,
    collections: collections.map((value) => value.name),
    lastScan: lastScan ?? null,
    lastPerformance: storedPerformance?.performance ?? null,
    setLists,
    savedSets,
  })
}

export async function replaceCachedState(database: PieceSelectorDatabase, state: CloudState, sync: CloudSyncRecord): Promise<void> {
  await database.transaction(
    'rw',
    [database.scores, database.scans, database.performances, database.savedSetLists, database.savedSets, database.cloudSync, database.collections],
    async () => {
      await Promise.all([
        database.scores.clear(),
        database.scans.clear(),
        database.performances.clear(),
        database.savedSetLists.clear(),
        database.savedSets.clear(),
        database.collections.clear(),
      ])
      await Promise.all([
        state.scores.length ? database.scores.bulkPut(state.scores) : Promise.resolve(),
        state.lastScan ? database.scans.put(state.lastScan) : Promise.resolve(),
        state.lastPerformance ? database.performances.put({ key: 'last', performance: state.lastPerformance }) : Promise.resolve(),
        state.setLists.length ? database.savedSetLists.bulkPut(state.setLists) : Promise.resolve(),
        state.savedSets.length ? database.savedSets.bulkPut(state.savedSets) : Promise.resolve(),
        database.cloudSync.put(sync),
        database.collections.bulkPut(state.collections.map((name) => ({ key: collectionKey(name), name }))),
      ])
    },
  )
}

export function readSyncRecord(database: PieceSelectorDatabase): Promise<CloudSyncRecord | undefined> {
  return database.cloudSync.get('cloud')
}

export async function clearCachedState(database: PieceSelectorDatabase): Promise<void> {
  await database.transaction(
    'rw',
    [database.scores, database.scans, database.performances, database.savedSetLists, database.savedSets, database.cloudSync, database.collections, database.tonight],
    async () => Promise.all([
      database.scores.clear(),
      database.scans.clear(),
      database.performances.clear(),
      database.savedSetLists.clear(),
      database.savedSets.clear(),
      database.cloudSync.clear(),
      database.collections.clear(),
      database.tonight.clear(),
    ]).then(() => undefined),
  )
}
