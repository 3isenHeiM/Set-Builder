import Dexie from 'dexie'
import { makeScore, makeSetList } from '../test/fixtures'
import { PieceSelectorDatabase } from './database'
import { PieceSelectorRepository } from './repository'
import { CloudRepository, CloudStateTransport } from './cloudRepository'
import { emptyCloudState, parseCloudState } from './cloudState'
import { clearCachedState, replaceCachedState } from './cloudCache'
import { createSetListBackup, parseSetListBackupJson, restoreSetList } from '../domain/setListBackup'

describe('locked programs and tonight persistence', () => {
  it.each(['local', 'cloud'])('enforces saved locks through the %s repository', async (backend) => {
    const database = new PieceSelectorDatabase(`locks-${crypto.randomUUID()}`)
    const fetchRequest = vi.fn((_input: string, init?: RequestInit) => {
      const state = typeof init?.body === 'string' ? (JSON.parse(init.body) as { state: unknown }).state : emptyCloudState()
      return Promise.resolve(Response.json({ revision: 1, state }))
    })
    const repository = backend === 'local' ? new PieceSelectorRepository(database) : new CloudRepository(database, new CloudStateTransport(fetchRequest))
    const saved = makeSetList()
    await repository.saveSetList(saved)
    await expect(repository.saveTonightSetList(saved)).rejects.toThrow('Lock this setlist')
    const locked = await repository.setSetListLocked(saved.id, true, saved.updatedAt)
    await expect(repository.saveSetList({ ...saved, name: 'Stale edit' })).rejects.toThrow('locked')
    await expect(repository.saveSetList({ ...locked, locked: false, name: 'Bypass' })).rejects.toThrow('locked')
    await expect(repository.saveLastPerformance({ ...locked.performance, warnings: ['Edited'] })).rejects.toThrow('locked')
    await repository.saveTonightSetList(locked)
    const reads = fetchRequest.mock.calls.length
    const localOnly = new CloudRepository(database, new CloudStateTransport(() => new Promise(() => undefined)))
    expect(await localOnly.getTonightSetList()).toEqual(locked)
    expect(fetchRequest.mock.calls).toHaveLength(reads)
    const unlocked = await repository.setSetListLocked(saved.id, false, saved.updatedAt)
    await repository.saveSetList({ ...unlocked, name: 'Later rehearsal' })
    expect(await repository.getTonightSetList()).toEqual(locked)
    await repository.clearTonightSetList()
    expect(await repository.getTonightSetList()).toBeUndefined()
    database.close()
    await Dexie.delete(database.name)
  })

  it('upgrades version 12 without losing data, and reopens the fixed tonight snapshot', async () => {
    const name = `tonight-migration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(12).stores({ scores: 'id,scoreNumber,collection,availability,configuration,enabled,*tags', scans: 'id,appliedAt', performances: 'key', savedSetLists: 'id,updatedAt', savedSets: 'id,updatedAt', cloudSync: 'key', collections: 'key' })
    const saved = makeSetList()
    await legacy.table('scores').put(makeScore())
    await legacy.table('savedSetLists').put(saved)
    legacy.close()
    const database = new PieceSelectorDatabase(name)
    const repository = new PieceSelectorRepository(database)
    expect(await repository.listScores()).toEqual([makeScore()])
    expect(await repository.listSetLists()).toEqual([saved])
    expect(await repository.getTonightSetList()).toBeUndefined()
    const locked = await repository.setSetListLocked(saved.id, true, saved.updatedAt)
    await repository.saveTonightSetList(locked)
    database.close()
    const reopened = new PieceSelectorDatabase(name)
    expect(await new PieceSelectorRepository(reopened).getTonightSetList()).toEqual(locked)
    const state = { ...emptyCloudState(), setLists: [locked] }
    await replaceCachedState(reopened, state, { key: 'cloud', connected: true, revision: 1, pending: null })
    expect(await new PieceSelectorRepository(reopened).getTonightSetList()).toEqual(locked)
    await clearCachedState(reopened)
    expect(await new PieceSelectorRepository(reopened).getTonightSetList()).toBeUndefined()
    reopened.close()
    await Dexie.delete(name)
  })

  it('round trips locks through cloud state and setlist JSON while accepting older records', () => {
    const saved = makeSetList({ locked: true })
    expect(parseCloudState({ ...emptyCloudState(), setLists: [saved] }).setLists[0]?.locked).toBe(true)
    expect(() => parseCloudState({ ...emptyCloudState(), setLists: [{ ...saved, locked: 'true' }] })).toThrow('invalid setlist lock')
    const backup = createSetListBackup(saved, saved.updatedAt)
    const imported = restoreSetList(parseSetListBackupJson(JSON.stringify(backup)), saved.updatedAt, () => crypto.randomUUID())
    expect(imported.locked).toBe(true)
    delete backup.setList.locked
    expect(restoreSetList(parseSetListBackupJson(JSON.stringify(backup)), saved.updatedAt, () => crypto.randomUUID()).locked).toBeUndefined()
  })
})
