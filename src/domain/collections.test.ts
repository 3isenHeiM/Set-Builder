import Dexie from 'dexie'
import { buildFolderSnapshot } from './filename'
import { applyReconciliation, classifyReconciliation } from './reconciliation'
import { comparePieces, pieceKey } from './collections'
import { createSettingsBackup, parseSettingsBackupJson, settingsBackupToJson, applySettingsBackup } from './settingsBackup'
import { createSetListBackup, parseSetListBackupJson, restoreSetList } from './setListBackup'
import { parseCloudState, emptyCloudState, CLOUD_STATE_VERSION } from '../data/cloudState'
import { PieceSelectorDatabase } from '../data/database'
import { PieceSelectorRepository } from '../data/repository'
import { makePerformance, makeScore } from '../test/fixtures'

const now = '2026-11-12T12:00:00.000Z'

describe('collections', () => {
  it('adds and re-aligns only the chosen collection and preserves configuration', () => {
    const existing = [makeScore({ scoreNumber: 42, displayNumber: '42' }), makeScore({ id: 'christmas-a', collection: 'Christmas', scoreNumber: 'A', displayNumber: 'A' })]
    const snapshot = { ...buildFolderSnapshot([{ name: 'b - Bells.mscz' }], now), collection: 'Christmas', mode: 'add' as const }
    const plan = classifyReconciliation(snapshot, existing)
    expect(plan.missing).toEqual([])
    const imported = applyReconciliation(existing, plan, {}, now, () => 'christmas-b', 'scan').scores
    expect(imported).toHaveLength(3)
    expect(imported.find((score) => score.id === 'christmas-b')).toMatchObject({ scoreNumber: 'B', collection: 'Christmas' })
    const sameNumber = classifyReconciliation({ ...buildFolderSnapshot([{ name: '42 - Holiday.mscz' }], now), collection: 'Christmas', mode: 'add' }, imported)
    expect(sameNumber.added).toHaveLength(1)
    expect(sameNumber.renamed).toHaveLength(0)
    expect(classifyReconciliation(snapshot, imported).added).toHaveLength(0)
    const aligned = classifyReconciliation({ ...snapshot, mode: 'realign' }, imported)
    expect(aligned.missing.map((score) => score.scoreId)).toEqual(['christmas-a'])
    expect(aligned.unchanged).toHaveLength(1)
    const renamed = classifyReconciliation({ ...buildFolderSnapshot([{ name: 'A - Renamed.mscz' }], now), collection: 'Christmas' }, existing)
    expect(applyReconciliation(existing, renamed, {}, now, () => 'unused', 'scan').scores.find((score) => score.id === 'christmas-a')).toMatchObject({ id: 'christmas-a', hotness: 2, title: 'Renamed' })
  })

  it('keeps collection-qualified identifiers distinct through cloud and settings backups', () => {
    const scores = [makeScore({ collection: 'Regular' }), makeScore({ id: 'xmas', collection: 'Christmas', scoreNumber: 1, hotness: 3 }), makeScore({ id: 'letter', collection: 'Christmas', scoreNumber: 'A', displayNumber: 'A' })]
    expect(new Set(scores.map(pieceKey)).size).toBe(3)
    expect([...scores].sort(comparePieces).map((score) => score.id)).toEqual(['xmas', 'letter', 'score-1'])
    expect(parseCloudState({ ...emptyCloudState(), scores }).scores).toHaveLength(3)
    const backup = parseSettingsBackupJson(settingsBackupToJson(createSettingsBackup(scores, now)))
    const result = applySettingsBackup(scores.map((score) => ({ ...score, hotness: 1 as const })), backup, now)
    expect(result.scores.map((score) => score.hotness)).toEqual([2, 3, 2])
    expect(result.report.matched).toBe(3)
    const migrated = parseCloudState({ ...emptyCloudState(), version: 1, scores: [makeScore()] })
    expect(migrated.version).toBe(CLOUD_STATE_VERSION)
    expect(migrated.scores[0]).toMatchObject({ id: 'score-1', collection: 'General', hotness: 2 })
  })

  it('round trips program snapshots with identical codes in separate collections', () => {
    const performance = makePerformance()
    const first = performance.sets[0]!.scores[0]!
    performance.sets[0]!.scores = [{ ...first, collection: 'Regular' }, { ...first, id: 'second', collection: 'Christmas' }, { ...first, id: 'third', collection: 'Christmas', scoreNumber: 'A', displayNumber: 'A' }]
    const saved = { id: performance.id, name: 'Event', createdAt: now, updatedAt: now, performance }
    const backup = parseSetListBackupJson(JSON.stringify(createSetListBackup(saved, now)))
    let i = 0
    const restored = restoreSetList(backup, now, () => String(i++))
    expect(restored.performance.sets[0]?.scores.map((score) => [score.collection, score.scoreNumber])).toEqual([['Regular', 1], ['Christmas', 1], ['Christmas', 'A']])
  })

  it('migrates numeric libraries and renames collections without losing IDs or snapshots', async () => {
    const name = `collection-test-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(9).stores({ scores: 'id,scoreNumber,availability,configuration,enabled,*tags', scans: 'id,appliedAt', performances: 'key', savedSetLists: 'id,updatedAt', savedSets: 'id,updatedAt', cloudSync: 'key' })
    await legacy.table('scores').put(makeScore())
    legacy.close()
    const database = new PieceSelectorDatabase(name)
    const repository = new PieceSelectorRepository(database)
    expect(await repository.getScore('score-1')).toMatchObject({ collection: 'General', hotness: 2 })
    const performance = makePerformance()
    await repository.saveSetList({ id: performance.id, name: 'Event', createdAt: now, updatedAt: now, performance })
    await repository.saveSavedSet({ id: 'saved', name: 'Opening', createdAt: now, updatedAt: now, scores: performance.sets[0]!.scores })
    await repository.renameCollection('General', 'Regular')
    expect(await repository.getScore('score-1')).toMatchObject({ id: 'score-1', collection: 'Regular', hotness: 2 })
    expect((await repository.getLastPerformance())?.sets[0]?.scores[0]?.collection).toBe('Regular')
    expect((await repository.listSavedSets())[0]?.scores[0]?.collection).toBe('Regular')
    expect((await repository.listSetLists())[0]?.performance.sets[0]?.scores[0]?.collection).toBe('Regular')
    await database.scores.put(makeScore({ id: 'other', collection: 'Christmas' }))
    await expect(repository.renameCollection('Regular', 'Christmas')).rejects.toThrow('already uses')
    expect((await repository.getScore('score-1'))?.collection).toBe('Regular')
    database.close()
    await Dexie.delete(name)
  })
})
