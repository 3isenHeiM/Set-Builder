import Dexie from 'dexie'
import { PieceSelectorDatabase } from './database'
import { PieceSelectorRepository } from './repository'
import { CloudRepository, CloudStateTransport } from './cloudRepository'
import { makeScore } from '../test/fixtures'
import { createProgramFromStarter } from '../domain/setList'
import { emptyDrummerTiming } from '../domain/drummerNotes'
import type { DrummerTiming } from '../domain/types'

const now = '2026-11-13T10:00:00Z'
const timing: DrummerTiming = { bpm: 120, beat: 'half', measure: '4/4', anacrusis: 0.5 }
const configuration = { canStart: true, hotness: 2 as const, drumsIntro: false, goesHigh: false, enabled: true }

describe('structured drummer timing storage', () => {
  it.each(['local', 'offline cloud'])('saves all editable copies together and preserves locks and Tonight (%s)', async (backend) => {
    const name = `timing-${crypto.randomUUID()}`
    const database = new PieceSelectorDatabase(name)
    const local = new PieceSelectorRepository(database)
    await database.scores.put(makeScore())
    const saved = createProgramFromStarter(makeScore(), now, 'program')
    const frozen = { ...saved, id: 'frozen', performance: { ...saved.performance, id: 'frozen' } }
    await local.saveSetList(saved)
    await local.saveSetList(frozen)
    const locked = await local.setSetListLocked('frozen', true, now)
    await local.saveTonightSetList(locked)
    await local.saveLastPerformance(saved.performance)
    await local.saveSavedSet({ id: 'reusable', name: 'Opening', createdAt: now, updatedAt: now, scores: saved.performance.sets[0]!.scores })
    const repository = backend === 'local' ? local : new CloudRepository(database, new CloudStateTransport(() => Promise.reject(new TypeError('offline'))))
    await repository.saveConfiguration('score-1', { ...configuration, drummerTiming: timing, drummerNotes: 'Quiet verse' }, now)
    expect((await repository.getScore('score-1'))?.drummerTiming).toEqual(timing)
    expect((await repository.getLastPerformance())?.sets[0]?.scores[0]?.drummerTiming).toEqual(timing)
    expect((await repository.listSavedSets())[0]?.scores[0]?.drummerTiming).toEqual(timing)
    expect((await repository.listSetLists()).find((list) => list.id === 'frozen')).toEqual(locked)
    expect(await repository.getTonightSetList()).toEqual(locked)
    await expect(repository.saveConfiguration('score-1', { ...configuration, drummerTiming: { ...timing, bpm: 999 } }, now)).rejects.toThrow('Invalid drummer timing')
    await expect(repository.saveConfiguration('score-1', { ...configuration, drummerNotes: 'x'.repeat(101) }, now)).rejects.toThrow('100 characters')
    expect((await repository.getScore('score-1'))?.drummerTiming).toEqual(timing)
    if (backend === 'offline cloud') {
      const pending = (await database.cloudSync.get('cloud'))?.pending
      expect(pending?.scores[0]?.drummerTiming).toEqual(timing)
      expect(pending?.setLists.find((list) => list.id === 'program')?.performance.sets[0]?.scores[0]?.drummerTiming).toEqual(timing)
    }
    database.close()
    const reopened = new PieceSelectorDatabase(name)
    expect((await reopened.scores.get('score-1'))?.drummerTiming).toEqual(timing)
    expect((await reopened.tonight.get('tonight'))?.setList).toEqual(locked)
    reopened.close()
    await Dexie.delete(name)
  })

  it('upgrades version 13 without truncating legacy notes or changing frozen snapshots', async () => {
    const name = `timing-migration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(13).stores({ scores: 'id,scoreNumber,collection,availability,configuration,enabled,*tags', scans: 'id,appliedAt', performances: 'key', savedSetLists: 'id,updatedAt', savedSets: 'id,updatedAt', cloudSync: 'key', collections: 'key', tonight: 'key' })
    const notes = 'x'.repeat(2000)
    const score = makeScore({ drummerNotes: notes })
    const locked = { ...createProgramFromStarter(score, now, 'frozen'), locked: true }
    await legacy.table('scores').bulkPut([score, makeScore({ id: 'two', scoreNumber: 2, displayNumber: '02', drummerTiming: timing })])
    await legacy.table('savedSetLists').put(locked)
    await legacy.table('tonight').put({ key: 'tonight', setList: locked })
    legacy.close()
    const database = new PieceSelectorDatabase(name)
    expect(await database.scores.get('score-1')).toEqual({ ...score, drummerTiming: emptyDrummerTiming() })
    expect((await database.scores.get('two'))?.drummerTiming).toEqual(timing)
    expect(await database.savedSetLists.get('frozen')).toEqual(locked)
    expect((await database.tonight.get('tonight'))?.setList).toEqual(locked)
    const repository = new PieceSelectorRepository(database)
    await repository.saveConfiguration('score-1', { ...configuration, drummerTiming: timing, drummerNotes: notes }, now)
    expect((await repository.getScore('score-1'))?.drummerNotes).toBe(notes)
    database.close()
    await Dexie.delete(name)
  })
})
