import Dexie from 'dexie'
import { buildFolderSnapshot } from '../domain/filename'
import { classifyReconciliation } from '../domain/reconciliation'
import { createSettingsBackup } from '../domain/settingsBackup'
import { makePerformance, makeScore } from '../test/fixtures'
import { LegacyDatabaseV1, LegacyDatabaseV4, PieceSelectorDatabase } from './database'
import { PieceSelectorRepository } from './repository'

function databaseName(): string {
  return `piece-selector-test-${crypto.randomUUID()}`
}

describe('IndexedDB persistence', () => {
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
    expect(await new PieceSelectorRepository(database).getLastPerformance()).toMatchObject({ sets: [{ scores: [{ hotness: 3, goesHigh: false }] }] })
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
