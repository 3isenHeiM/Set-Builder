import Dexie from 'dexie'
import { assignPiecesToCollection } from '../domain/collections'
import { makePerformance, makeScore } from '../test/fixtures'
import { PieceSelectorDatabase } from './database'
import { PieceSelectorRepository } from './repository'
import { CloudRepository, CloudStateTransport } from './cloudRepository'
import { CLOUD_STATE_VERSION, emptyCloudState, parseCloudState } from './cloudState'

const now = '2026-11-12T15:00:00.000Z'
const databaseName = () => `collection-management-${crypto.randomUUID()}`

describe('collection management', () => {
  it('moves pieces without changing IDs or settings and rejects a whole conflicting batch', () => {
    const first = makeScore({ collection: 'Christmas', scoreNumber: 'A', displayNumber: 'A' })
    const second = makeScore({ id: 'second', collection: 'Christmas', scoreNumber: 'B', displayNumber: 'B', hotness: 3 })
    const scores = [first, second]
    expect(assignPiecesToCollection(scores, [first.id, second.id], 'Holiday', now)).toEqual([
      { ...first, collection: 'Holiday', updatedAt: now }, { ...second, collection: 'Holiday', updatedAt: now },
    ])
    const conflict = makeScore({ id: 'other-a', collection: 'Holiday', scoreNumber: 'A', displayNumber: 'A' })
    expect(() => assignPiecesToCollection([...scores, conflict], [first.id, second.id], 'Holiday', now)).toThrow('identifier A')
    expect(() => assignPiecesToCollection(scores, [first.id, 'missing'], 'Holiday', now)).toThrow('no longer exists')
    expect(first.collection).toBe('Christmas')
    expect(second.collection).toBe('Christmas')
  })

  it('persists empty collections, moves pieces atomically, and preserves saved program snapshots', async () => {
    const name = databaseName()
    const database = new PieceSelectorDatabase(name)
    const repository = new PieceSelectorRepository(database)
    await repository.createCollection(' Christmas ')
    await expect(repository.createCollection('CHRISTMAS')).rejects.toThrow('already uses')
    database.close()
    const reopened = new PieceSelectorDatabase(name)
    const saved = new PieceSelectorRepository(reopened)
    expect(await saved.listCollections()).toEqual(['General', 'Christmas'])
    await saved.renameCollection('Christmas', 'Holiday')
    expect(await saved.listCollections()).toEqual(['General', 'Holiday'])
    await reopened.scores.bulkPut([makeScore(), makeScore({ id: 'two', scoreNumber: 2, displayNumber: '02', hotness: 3 })])
    const performance = makePerformance()
    await saved.saveSetList({ id: performance.id, name: 'Event', createdAt: now, updatedAt: now, performance })
    await saved.assignCollection(['score-1', 'two'], 'holiday', now)
    expect((await saved.listScores()).map((score) => [score.id, score.collection, score.hotness])).toEqual([['score-1', 'Holiday', 2], ['two', 'Holiday', 3]])
    expect(await saved.getLastPerformance()).toEqual(performance)
    await saved.assignCollection(['score-1'], 'General', now)
    expect(await saved.getScore('score-1')).toMatchObject({ collection: 'General', hotness: 2, availability: 'active' })
    await reopened.scores.put(makeScore({ id: 'collision', collection: 'General', scoreNumber: 2, displayNumber: '02' }))
    await expect(saved.assignCollection(['two'], 'General', now)).rejects.toThrow('No pieces were moved')
    expect((await saved.getScore('two'))?.collection).toBe('Holiday')
    expect(await saved.listCollections()).toContain('Holiday')
    reopened.close()
    await Dexie.delete(name)
  })

  it('upgrades version 10 collection names and accepts old cloud states without a registry', async () => {
    const name = databaseName()
    const legacy = new Dexie(name)
    legacy.version(10).stores({ scores: 'id,scoreNumber,collection,availability,configuration,enabled,*tags', scans: 'id,appliedAt', performances: 'key', savedSetLists: 'id,updatedAt', savedSets: 'id,updatedAt', cloudSync: 'key' })
    await legacy.table('scores').put(makeScore({ collection: 'Christmas' }))
    legacy.close()
    const database = new PieceSelectorDatabase(name)
    expect(await new PieceSelectorRepository(database).listCollections()).toEqual(['General', 'Christmas'])
    expect(await database.scores.get('score-1')).toMatchObject({ collection: 'Christmas', hotness: 2 })
    const { collections: ignored, ...previous } = emptyCloudState()
    void ignored
    expect(parseCloudState({ ...previous, version: 2, scores: [makeScore({ collection: 'Christmas' })] })).toMatchObject({ version: CLOUD_STATE_VERSION, collections: ['General', 'Christmas'] })
    expect(() => parseCloudState({ ...emptyCloudState(), collections: ['Holiday', ' HOLIDAY '] })).toThrow('duplicate collections')
    database.close()
    await Dexie.delete(name)
  })

  it('saves a bulk move in one cloud write and queues new collections offline', async () => {
    const name = databaseName()
    const database = new PieceSelectorDatabase(name)
    const initial = { ...emptyCloudState(), collections: ['General', 'Christmas'], scores: [makeScore(), makeScore({ id: 'two', scoreNumber: 2, displayNumber: '02' })] }
    const fetchRequest = vi.fn((_input: string, init?: RequestInit) => {
      if (init?.method !== 'PUT') return Promise.resolve(Response.json({ revision: 1, state: initial }))
      if (typeof init.body !== 'string') throw new Error('Expected a JSON upload')
      const upload = JSON.parse(init.body) as { state: unknown }
      return Promise.resolve(Response.json({ revision: 2, state: upload.state }))
    })
    await new CloudRepository(database, new CloudStateTransport(fetchRequest)).assignCollection(['score-1', 'two'], 'Christmas', now)
    expect(fetchRequest).toHaveBeenCalledTimes(2)
    expect((await database.scores.toArray()).every((score) => score.collection === 'Christmas')).toBe(true)
    const offline = new CloudRepository(database, new CloudStateTransport(() => Promise.reject(new TypeError('offline'))))
    await offline.createCollection('Winter')
    await offline.assignCollection(['score-1'], 'Winter', now)
    expect((await database.cloudSync.get('cloud'))?.pending).toMatchObject({ collections: ['General', 'Christmas', 'Winter'] })
    database.close()
    const reopened = new PieceSelectorDatabase(name)
    const reconnect = vi.fn((_input: string, init?: RequestInit) => {
      if (init?.method === 'PUT' && typeof init.body !== 'string') throw new Error('Expected a JSON upload')
      const upload = init?.method === 'PUT' && typeof init.body === 'string' ? JSON.parse(init.body) as { state: unknown } : { state: initial }
      return Promise.resolve(Response.json({ revision: 3, state: upload.state }))
    })
    const repository = new CloudRepository(reopened, new CloudStateTransport(reconnect))
    expect(await repository.listCollections()).toContain('Winter')
    expect(await repository.getScore('score-1')).toMatchObject({ collection: 'Winter', hotness: 2 })
    expect((await reopened.cloudSync.get('cloud'))?.pending).toBeNull()
    reopened.close()
    await Dexie.delete(name)
  })
})
