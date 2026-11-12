import Dexie from 'dexie'
import { makeScore, makeSetList } from '../test/fixtures'
import { addNewSet, addPiece } from '../domain/setList'
import { entryKey, pieceOccurrenceCounts } from '../domain/performanceEntries'
import { createSetListBackup, parseSetListBackupJson, restoreSetList, setListBackupToJson } from '../domain/setListBackup'
import { parseSharedSetList, toSharedSetList } from '../domain/sharedSetList'
import { emptyCloudState, parseCloudState } from './cloudState'
import { CloudRepository, CloudStateTransport } from './cloudRepository'
import { PieceSelectorDatabase } from './database'
import { PieceSelectorRepository } from './repository'

describe('repeated pieces through storage and sharing', () => {
  it.each(['local', 'cloud'])('reopens repeats, round trips JSON, and preserves a locked Tonight copy (%s)', async (backend) => {
    const name = `repeats-${crypto.randomUUID()}`
    const database = new PieceSelectorDatabase(name)
    const transport = new CloudStateTransport((_input, init) => Promise.resolve(Response.json({ revision: 1, state: typeof init?.body === 'string' ? (JSON.parse(init.body) as { state: unknown }).state : emptyCloudState() })))
    const repository = backend === 'local' ? new PieceSelectorRepository(database) : new CloudRepository(database, transport)
    const program = addNewSet(addPiece(makeSetList(), 0, makeScore(), '2026-11-13T10:00:00Z'), makeScore(), '2026-11-13T10:00:00Z')
    await repository.saveSetList(program)
    const locked = await repository.setSetListLocked(program.id, true, '2026-11-13T10:01:00Z')
    await repository.saveTonightSetList(locked)
    await repository.saveSavedSet({ id: 'reusable', name: 'Repeated', createdAt: program.createdAt, updatedAt: program.updatedAt, scores: program.performance.sets[0]!.scores })
    const json = setListBackupToJson(createSetListBackup(locked, '2026-11-13T10:02:00Z'))
    expect(json).not.toContain('entryId')
    expect(json).not.toContain('score-1')
    const restored = restoreSetList(parseSetListBackupJson(json), '2026-11-13T10:03:00Z', () => crypto.randomUUID())
    const pieces = restored.performance.sets.flatMap((set) => set.scores)
    expect(pieces).toHaveLength(3)
    expect(new Set(pieces.map(entryKey)).size).toBe(3)
    expect(pieces.every((piece) => pieceOccurrenceCounts(pieces)(piece) === 3)).toBe(true)
    const shared = parseSharedSetList(toSharedSetList(restored))
    const publicPieces = shared.sets.flatMap((set) => set.scores)
    expect(publicPieces.every((piece) => pieceOccurrenceCounts(publicPieces)(piece) === 3)).toBe(true)
    expect(JSON.stringify(shared)).not.toContain('entryId')
    expect(parseCloudState({ ...emptyCloudState(), setLists: [locked], lastPerformance: locked.performance }).setLists[0]?.performance).toEqual(locked.performance)
    await expect(repository.saveSetList({ ...locked, name: 'Blocked' })).rejects.toThrow('locked')
    database.close()
    const reopened = new PieceSelectorDatabase(name)
    const local = new PieceSelectorRepository(reopened)
    expect((await local.getLastPerformance())?.sets.flatMap((set) => set.scores)).toHaveLength(3)
    expect((await local.listSavedSets())[0]?.scores).toHaveLength(2)
    expect((await local.getTonightSetList())?.performance).toEqual(locked.performance)
    const entries = (await local.getLastPerformance())!.sets.flatMap((set) => set.scores.map(entryKey))
    expect(new Set(entries).size).toBe(entries.length)
    reopened.close()
    await Dexie.delete(name)
  })
})
