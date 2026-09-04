import type { CloudState } from './cloudState'
import { CLOUD_STATE_FORMAT, CLOUD_STATE_VERSION, parseCloudState } from './cloudState'
import type { CloudSyncRecord, PieceSelectorDatabase } from './database'

export async function readCachedState(database: PieceSelectorDatabase): Promise<CloudState> {
  const [scores, lastScan, storedPerformance, setLists] = await database.transaction(
    'r',
    database.scores,
    database.scans,
    database.performances,
    database.savedSetLists,
    async () => Promise.all([
      database.scores.orderBy('scoreNumber').toArray(),
      database.scans.orderBy('appliedAt').last(),
      database.performances.get('last'),
      database.savedSetLists.orderBy('updatedAt').reverse().toArray(),
    ]),
  )
  return parseCloudState({
    format: CLOUD_STATE_FORMAT,
    version: CLOUD_STATE_VERSION,
    scores,
    lastScan: lastScan ?? null,
    lastPerformance: storedPerformance?.performance ?? null,
    setLists,
  })
}

export async function replaceCachedState(database: PieceSelectorDatabase, state: CloudState, sync: CloudSyncRecord): Promise<void> {
  await database.transaction(
    'rw',
    database.scores,
    database.scans,
    database.performances,
    database.savedSetLists,
    database.cloudSync,
    async () => {
      await Promise.all([
        database.scores.clear(),
        database.scans.clear(),
        database.performances.clear(),
        database.savedSetLists.clear(),
      ])
      await Promise.all([
        state.scores.length ? database.scores.bulkPut(state.scores) : Promise.resolve(),
        state.lastScan ? database.scans.put(state.lastScan) : Promise.resolve(),
        state.lastPerformance ? database.performances.put({ key: 'last', performance: state.lastPerformance }) : Promise.resolve(),
        state.setLists.length ? database.savedSetLists.bulkPut(state.setLists) : Promise.resolve(),
        database.cloudSync.put(sync),
      ])
    },
  )
}

export function readSyncRecord(database: PieceSelectorDatabase): Promise<CloudSyncRecord | undefined> {
  return database.cloudSync.get('cloud')
}
