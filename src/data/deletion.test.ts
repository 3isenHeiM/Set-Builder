import Dexie from 'dexie'
import { PieceSelectorDatabase } from './database'
import { PieceSelectorRepository } from './repository'
import { CloudRepository, CloudStateTransport } from './cloudRepository'
import { makePerformance, makeScore } from '../test/fixtures'
import { buildFolderSnapshot } from '../domain/filename'
import { classifyReconciliation } from '../domain/reconciliation'

describe('library deletion', () => {
  it('persists deletion while keeping collections and independent saved snapshots', async () => {
    const name = `delete-${crypto.randomUUID()}`
    const database = new PieceSelectorDatabase(name)
    const repository = new PieceSelectorRepository(database)
    await database.scores.put(makeScore({ collection: 'Christmas' }))
    const performance = makePerformance()
    await repository.saveSetList({ id: performance.id, name: 'Event', createdAt: performance.generatedAt, updatedAt: performance.generatedAt, performance })
    await repository.saveSavedSet({ id: 'set', name: 'Opening', createdAt: performance.generatedAt, updatedAt: performance.generatedAt, scores: performance.sets[0]!.scores })
    await repository.deleteScore('score-1')
    await expect(repository.deleteScore('score-1')).rejects.toThrow('no longer exists')
    database.close()
    const reopened = new PieceSelectorDatabase(name)
    const after = new PieceSelectorRepository(reopened)
    expect(await after.listScores()).toEqual([])
    expect(await after.listCollections()).toContain('Christmas')
    expect(await after.getLastPerformance()).toEqual(performance)
    expect((await after.listSavedSets())[0]?.scores).toEqual(performance.sets[0]!.scores)
    expect((await after.listSetLists())[0]?.performance).toEqual(performance)
    const plan = classifyReconciliation({ ...buildFolderSnapshot([{ name: '01 - Take On Me.mscz' }], '2026-11-12T17:00:00Z'), collection: 'Christmas', mode: 'add' }, [])
    let sequence = 0
    await after.applyReconciliation(plan, {}, '2026-11-12T17:00:00Z', () => `new-${sequence++}`)
    expect((await after.listScores())[0]).toMatchObject({ configuration: 'pending', hotness: null })
    expect((await after.listScores())[0]?.id).not.toBe('score-1')
    reopened.close()
    await Dexie.delete(name)
  })

  it('queues an offline deletion and uploads it on reconnect without touching saved programs', async () => {
    const name = `delete-offline-${crypto.randomUUID()}`
    const database = new PieceSelectorDatabase(name)
    await database.scores.put(makeScore())
    const performance = makePerformance()
    await database.performances.put({ key: 'last', performance })
    const offline = new CloudRepository(database, new CloudStateTransport(() => Promise.reject(new TypeError('offline'))))
    await offline.deleteScore('score-1')
    expect((await database.cloudSync.get('cloud'))?.pending?.scores).toEqual([])
    expect(await offline.getLastPerformance()).toEqual(performance)
    const fetchRequest = vi.fn((_input: string, init?: RequestInit) => {
      if (init?.method === 'PUT' && typeof init.body === 'string') return Promise.resolve(Response.json({ revision: 2, state: (JSON.parse(init.body) as { state: unknown }).state }))
      return Promise.resolve(Response.json({ revision: 1, state: (database.cloudSync.get('cloud')) }))
    })
    // A successful read supplies the same pending envelope before the queued write.
    const pending = (await database.cloudSync.get('cloud'))!.pending!
    const transport = new CloudStateTransport((input, init) => init?.method === 'PUT' ? fetchRequest(input, init) : Promise.resolve(Response.json({ revision: 1, state: pending })))
    const online = new CloudRepository(database, transport)
    expect(await online.listScores()).toEqual([])
    expect(await online.getLastPerformance()).toEqual(performance)
    expect(fetchRequest).toHaveBeenCalledTimes(1)
    expect((await database.cloudSync.get('cloud'))?.pending).toBeNull()
    database.close()
    await Dexie.delete(name)
  })
})
