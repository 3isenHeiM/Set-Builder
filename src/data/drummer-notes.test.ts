import Dexie from 'dexie'
import { PieceSelectorDatabase } from './database'
import { PieceSelectorRepository } from './repository'
import { CloudRepository, CloudStateTransport } from './cloudRepository'
import { makePerformance, makeScore } from '../test/fixtures'
import { createSettingsBackup } from '../domain/settingsBackup'

const now = '2026-11-12T20:00:00.000Z'
const configuration = { canStart: true, hotness: 2 as const, drumsIntro: false, goesHigh: false, enabled: true }

describe('drummer notes storage', () => {
  it('updates library and existing program notes atomically and restores them from settings', async () => {
    const name = `notes-${crypto.randomUUID()}`
    const database = new PieceSelectorDatabase(name)
    const repository = new PieceSelectorRepository(database)
    await database.scores.put(makeScore())
    const performance = makePerformance()
    await repository.saveSetList({ id: performance.id, name: 'Event', createdAt: now, updatedAt: now, performance })
    await repository.saveSavedSet({ id: 'saved', name: 'Opening', createdAt: now, updatedAt: now, scores: performance.sets[0]!.scores })
    await repository.saveConfiguration('score-1', { ...configuration, drummerNotes: 'Soft intro\nBig ending' }, now)
    expect((await repository.getLastPerformance())?.sets[0]?.scores[0]?.drummerNotes).toBe('Soft intro\nBig ending')
    expect((await repository.listSavedSets())[0]?.scores[0]?.drummerNotes).toBe('Soft intro\nBig ending')
    await expect(repository.saveConfiguration('score-1', { ...configuration, hotness: 3, drummerNotes: 'x'.repeat(2001) }, now)).rejects.toThrow('2000 characters')
    expect(await repository.getScore('score-1')).toMatchObject({ hotness: 2, drummerNotes: 'Soft intro\nBig ending' })
    await repository.importSettings(createSettingsBackup([makeScore({ drummerNotes: 'Restored' })], now), now)
    expect((await repository.listSetLists())[0]?.performance.sets[0]?.scores[0]?.drummerNotes).toBe('Restored')
    database.close()
    const reopened = new PieceSelectorDatabase(name)
    expect((await reopened.scores.get('score-1'))?.drummerNotes).toBe('Restored')
    reopened.close()
    await Dexie.delete(name)
  })

  it('migrates version 11 without losing settings or an existing note', async () => {
    const name = `notes-migration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(11).stores({ scores: 'id,scoreNumber,collection,availability,configuration,enabled,*tags', scans: 'id,appliedAt', performances: 'key', savedSetLists: 'id,updatedAt', savedSets: 'id,updatedAt', cloudSync: 'key', collections: 'key' })
    const { drummerNotes: omitted, ...old } = makeScore()
    void omitted
    await legacy.table('scores').bulkPut([old, makeScore({ id: 'other', scoreNumber: 2, displayNumber: '02', drummerNotes: 'Keep this note' })])
    legacy.close()
    const database = new PieceSelectorDatabase(name)
    expect(await database.scores.get('score-1')).toMatchObject({ hotness: 2, drummerNotes: '' })
    expect((await database.scores.get('other'))?.drummerNotes).toBe('Keep this note')
    database.close()
    await Dexie.delete(name)
  })

  it('queues library and saved-set notes together offline', async () => {
    const name = `notes-offline-${crypto.randomUUID()}`
    const database = new PieceSelectorDatabase(name)
    const local = new PieceSelectorRepository(database)
    await database.scores.put(makeScore())
    const performance = makePerformance()
    await local.saveSetList({ id: performance.id, name: 'Event', createdAt: now, updatedAt: now, performance })
    const cloud = new CloudRepository(database, new CloudStateTransport(() => Promise.reject(new TypeError('offline'))))
    await cloud.saveConfiguration('score-1', { ...configuration, drummerNotes: 'Four clicks' }, now)
    const pending = (await database.cloudSync.get('cloud'))?.pending
    expect(pending?.scores[0]?.drummerNotes).toBe('Four clicks')
    expect(pending?.setLists[0]?.performance.sets[0]?.scores[0]?.drummerNotes).toBe('Four clicks')
    database.close()
    await Dexie.delete(name)
  })
})
