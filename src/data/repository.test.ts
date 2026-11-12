import Dexie from 'dexie'
import { buildFolderSnapshot } from '../domain/filename'
import { classifyReconciliation } from '../domain/reconciliation'
import { createSettingsBackup } from '../domain/settingsBackup'
import { makePerformance, makeScore } from '../test/fixtures'
import type { SavedSet, SavedSetList } from '../domain/types'
import { LegacyDatabaseV1, LegacyDatabaseV4, PieceSelectorDatabase } from './database'
import { PieceSelectorRepository } from './repository'
import { addNewSet, addPiece, createProgramFromStarter, movePiece, setOrderOverride } from '../domain/setList'

function databaseName(): string {
  return `piece-selector-test-${crypto.randomUUID()}`
}

describe('IndexedDB persistence', () => {
  it('reopens a five-set program with custom order and a reusable set unchanged', async () => {
    const name = databaseName()
    const database = new PieceSelectorDatabase(name)
    const repository = new PieceSelectorRepository(database)
    const starter = (number: number) => makeScore({ id: `starter-${number}`, scoreNumber: number, displayNumber: String(number) })
    let program = createProgramFromStarter(starter(1), '2026-11-12T10:00:00Z', 'program')
    for (let number = 2; number <= 5; number += 1) program = addNewSet(program, starter(number), program.updatedAt)
    program = addPiece(program, 0, makeScore({ id: 'high', scoreNumber: 6, displayNumber: '06', goesHigh: true, canStart: false }), program.updatedAt)
    program = addPiece(program, 0, makeScore({ id: 'regular', scoreNumber: 7, displayNumber: '07', canStart: false }), program.updatedAt)
    program = movePiece(setOrderOverride(program, 0, true, program.updatedAt), 0, 1, 2, program.updatedAt)
    const reusable: SavedSet = { id: 'reusable', name: 'Custom order', createdAt: program.createdAt, updatedAt: program.updatedAt, orderOverride: true, scores: program.performance.sets[0]!.scores }
    await repository.saveSetList(program)
    await repository.saveSavedSet(reusable)
    database.close()
    const reopened = new PieceSelectorDatabase(name)
    const restored = new PieceSelectorRepository(reopened)
    expect(await restored.getLastPerformance()).toEqual(program.performance)
    expect(await restored.listSetLists()).toEqual([program])
    expect(await restored.listSavedSets()).toEqual([reusable])
    reopened.close()
    await Dexie.delete(name)
  })

  it('applies partial settings atomically while preserving other values and tags', async () => {
    const database = new PieceSelectorDatabase(databaseName())
    const repository = new PieceSelectorRepository(database)
    await database.scores.bulkPut([makeScore({ tags: ['other', '80s'] }), makeScore({ id: 'two', scoreNumber: 2, displayNumber: '02', hotness: 3, tags: ['other'] })])
    await repository.saveBulkConfiguration(['score-1', 'two'], { drumsIntro: true }, '2026-09-10T10:00:00.000Z')
    expect(await repository.getScore('score-1')).toMatchObject({ drumsIntro: true, hotness: 2, tags: ['other', '80s'] })
    expect(await repository.getScore('two')).toMatchObject({ drumsIntro: true, hotness: 3, tags: ['other'] })
    await expect(repository.saveBulkConfiguration(['score-1', 'missing'], { hotness: 1 }, '2026-09-10T11:00:00.000Z')).rejects.toThrow('no longer exists')
    expect((await repository.getScore('score-1'))?.hotness).toBe(2)
    database.close()
  })
  it('migrates legacy data without losing settings or a saved performance', async () => {
    const name = databaseName()
    const original = makeScore({ tags: ['80s'], canStart: false, hotness: 3, drumsIntro: true, enabled: false })
    const { configuration: _, ...legacyScore } = original
    void _
    const legacy = new LegacyDatabaseV1(name)
    await legacy.scores.add({ ...legacyScore, hotness: 5 })
    const performance = makePerformance()
    await legacy.performances.put({ key: 'last', performance: { ...performance, sets: performance.sets.map((set) => ({ ...set, scores: set.scores.map((score) => ({ ...score, hotness: 5 })) })) } })
    legacy.close()

    const database = new PieceSelectorDatabase(name)
    const migrated = await database.scores.get(original.id)
    expect(migrated).toMatchObject({ configuration: 'complete', tags: ['80s'], canStart: false, hotness: 3, drumsIntro: true, goesHigh: null, enabled: false })
    const repository = new PieceSelectorRepository(database)
    expect(await repository.getLastPerformance()).toMatchObject({ sets: [{ scores: [{ hotness: 3, goesHigh: false }] }] })
    const migratedSetLists = await repository.listSetLists()
    expect(migratedSetLists).toHaveLength(1)
    expect(migratedSetLists[0]?.id).toBe(performance.id)
    expect(migratedSetLists[0]?.performance.id).toBe(performance.id)
    database.close()
    await Dexie.delete(name)
  })

  it('migrates incomplete disabled pieces to ready without inventing settings', async () => {
    const name = databaseName()
    const legacy = new LegacyDatabaseV4(name)
    await legacy.scores.add(makeScore({ enabled: false, configuration: 'pending', canStart: null, hotness: null, drumsIntro: null, goesHigh: null }))
    legacy.close()

    const database = new PieceSelectorDatabase(name)
    expect(await database.scores.get('score-1')).toMatchObject({
      enabled: false,
      configuration: 'complete',
      canStart: null,
      hotness: null,
      drumsIntro: null,
      goesHigh: null,
    })
    database.close()
    await Dexie.delete(name)
  })

  it('creates, configures, sorts, reconciles and persists the last scan transactionally', async () => {
    const database = new PieceSelectorDatabase(databaseName())
    const repository = new PieceSelectorRepository(database)
    const snapshot = buildFolderSnapshot([{ name: '10 - Ten.mscz' }, { name: '02 - Two.mscz' }], 'scanned')
    const plan = classifyReconciliation(snapshot, [])
    let nextId = 0
    await repository.applyReconciliation(plan, {}, 'applied', () => `id-${nextId++}`)
    expect((await repository.listScores()).map((score) => score.scoreNumber)).toEqual([2, 10])
    const score = (await repository.listScores())[0]
    if (!score) throw new Error('fixture not created')
    expect(score).toMatchObject({ availability: 'active', enabled: true, configuration: 'pending', canStart: null, hotness: null, drumsIntro: null, goesHigh: null })
    await repository.saveConfiguration(score.id, { canStart: true, hotness: 3, drumsIntro: false, goesHigh: true, enabled: true, in80s: true }, 'configured')
    expect(await repository.getScore(score.id)).toMatchObject({ configuration: 'complete', hotness: 3, tags: ['80s'] })
    expect(await repository.getLastScan()).toMatchObject({ summary: { added: 2 } })
    database.close()
  })

  it('rolls a bulk reconciliation back when the scan record cannot be written', async () => {
    const database = new PieceSelectorDatabase(databaseName())
    const repository = new PieceSelectorRepository(database)
    await database.scores.add(makeScore())
    vi.spyOn(database.scans, 'put').mockRejectedValueOnce(new Error('interrupted'))
    const plan = classifyReconciliation(buildFolderSnapshot([{ name: '02 - New.mscz' }], 'scanned'), [makeScore()])
    await expect(repository.applyReconciliation(plan, {}, 'applied', () => crypto.randomUUID())).rejects.toThrow('interrupted')
    expect(await database.scores.get('score-1')).toMatchObject({ scoreNumber: 1, availability: 'active' })
    expect(await database.scores.count()).toBe(1)
    database.close()
  })

  it('reopens the most recently generated performance with its score snapshot', async () => {
    const name = databaseName()
    const firstDatabase = new PieceSelectorDatabase(name)
    const firstRepository = new PieceSelectorRepository(firstDatabase)
    await firstDatabase.scores.add(makeScore())
    await firstRepository.saveLastPerformance(makePerformance())
    const missingPlan = classifyReconciliation(buildFolderSnapshot([], 'scanned'), [makeScore()])
    await firstRepository.applyReconciliation(missingPlan, {}, 'applied', () => crypto.randomUUID())
    expect(await firstDatabase.scores.get('score-1')).toMatchObject({ availability: 'missing' })
    firstDatabase.close()

    const secondDatabase = new PieceSelectorDatabase(name)
    expect(await new PieceSelectorRepository(secondDatabase).getLastPerformance()).toEqual(makePerformance())
    secondDatabase.close()
  })

  it('stores multiple named set lists and tracks the one most recently opened', async () => {
    const name = databaseName()
    const database = new PieceSelectorDatabase(name)
    const repository = new PieceSelectorRepository(database)
    const first: SavedSetList = { id: 'first', name: 'Afternoon', createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z', performance: { ...makePerformance(), id: 'first' } }
    const second: SavedSetList = { id: 'second', name: 'Evening', createdAt: '2026-09-01T11:00:00.000Z', updatedAt: '2026-09-01T11:00:00.000Z', performance: { ...makePerformance(), id: 'second' } }
    await repository.saveSetList(first)
    await repository.saveSetList(second)
    expect((await repository.listSetLists()).map((saved) => saved.name)).toEqual(['Evening', 'Afternoon'])
    expect(await repository.getLastPerformance()).toMatchObject({ id: 'second' })
    database.close()

    const reopened = new PieceSelectorDatabase(name)
    expect((await new PieceSelectorRepository(reopened).listSetLists()).map((saved) => saved.id)).toEqual(['second', 'first'])
    reopened.close()
    await Dexie.delete(name)
  })

  it('migrates storage and persists independently named sets', async () => {
    const name = databaseName()
    const legacy = new LegacyDatabaseV4(name)
    await legacy.scores.put(makeScore())
    legacy.close()

    const database = new PieceSelectorDatabase(name)
    const repository = new PieceSelectorRepository(database)
    const set: SavedSet = { id: 'hot-set', name: 'Hot Set', createdAt: '2026-09-10T10:00:00.000Z', updatedAt: '2026-09-10T10:00:00.000Z', scores: makePerformance().sets[0]!.scores }
    await repository.saveSavedSet(set)
    expect(await repository.listSavedSets()).toEqual([set])
    expect(await database.scores.get('score-1')).toBeDefined()
    database.close()

    const reopened = new PieceSelectorDatabase(name)
    expect(await new PieceSelectorRepository(reopened).listSavedSets()).toEqual([set])
    reopened.close()
    await Dexie.delete(name)
  })

  it('restores settings transactionally without changing folder metadata', async () => {
    const name = databaseName()
    const original = makeScore({ title: 'Renamed locally', fileName: '01 - Renamed locally.mscz', hotness: 2 })
    const backup = createSettingsBackup([makeScore({ title: 'Old name', tags: ['80s'], canStart: false, hotness: 3, drumsIntro: true, enabled: false })], 'exported')
    const firstDatabase = new PieceSelectorDatabase(name)
    await firstDatabase.scores.add(original)
    const report = await new PieceSelectorRepository(firstDatabase).importSettings(backup, 'restored')
    firstDatabase.close()

    const secondDatabase = new PieceSelectorDatabase(name)
    expect(await secondDatabase.scores.get(original.id)).toEqual({ ...original, tags: ['80s'], canStart: false, hotness: 3, drumsIntro: true, enabled: false, updatedAt: 'restored' })
    expect(report).toMatchObject({ matched: 1, titleMismatches: [{ backupName: 'Old name', currentName: 'Renamed locally' }] })
    secondDatabase.close()
  })
})
