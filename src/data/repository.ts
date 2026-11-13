import { applyReconciliation } from '../domain/reconciliation'
import { applySettingsBackup } from '../domain/settingsBackup'
import type { SettingsBackup, SettingsImportReport } from '../domain/settingsBackup'
import type {
  FolderScan,
  BulkConfiguration,
  GeneratedPerformance,
  ReconciliationPlan,
  RenumberingDecisions,
  SavedSet,
  SavedSetList,
  Score,
  ScoreConfiguration,
} from '../domain/types'
import { PieceSelectorDatabase } from './database'
import { applyBulkConfiguration, configurationStatus } from '../domain/configuration'
import { readDrummerNotes, readDrummerNotesInput, readDrummerTiming, updateSavedDrummerNotes } from '../domain/drummerNotes'
import { assignPiecesToCollection, collectionKey, collectionNames, comparePieces, createCollectionNames, pieceKey, renameCollectionData } from '../domain/collections'
import { assertLockedProgramsUnchanged, assertSetListEditable, changeSetListLock } from '../domain/performanceLock'
import { readTonight, saveTonight } from './tonight'
import { normalizePerformanceEntries, uniqueEntries } from '../domain/performanceEntries'

export interface ScoreRepository {
  listCollections: () => Promise<string[]>
  createCollection: (name: string) => Promise<void>
  assignCollection: (ids: string[], name: string, updatedAt: string) => Promise<void>
  renameCollection: (previous: string, name: string) => Promise<void>
  listScores: () => Promise<Score[]>
  getScore: (id: string) => Promise<Score | undefined>
  deleteScore: (id: string) => Promise<void>
  saveConfiguration: (id: string, configuration: ScoreConfiguration, updatedAt: string) => Promise<void>
  saveBulkConfiguration: (ids: string[], changes: BulkConfiguration, updatedAt: string) => Promise<void>
  applyReconciliation: (
    plan: ReconciliationPlan,
    decisions: RenumberingDecisions,
    appliedAt: string,
    createId: () => string,
  ) => Promise<FolderScan>
  getLastScan: () => Promise<FolderScan | undefined>
  importSettings: (backup: SettingsBackup, updatedAt: string) => Promise<SettingsImportReport>
}

export interface PerformanceRepository {
  getTonightSetList: () => Promise<SavedSetList | undefined>
  saveTonightSetList: (setList: SavedSetList) => Promise<void>
  clearTonightSetList: () => Promise<void>
  setSetListLocked: (id: string, locked: boolean, updatedAt: string) => Promise<SavedSetList>
  saveLastPerformance: (performance: GeneratedPerformance) => Promise<void>
  getLastPerformance: () => Promise<GeneratedPerformance | undefined>
  listSetLists: () => Promise<SavedSetList[]>
  saveSetList: (setList: SavedSetList) => Promise<void>
  listSavedSets: () => Promise<SavedSet[]>
  saveSavedSet: (savedSet: SavedSet) => Promise<void>
}

export class PieceSelectorRepository implements ScoreRepository, PerformanceRepository {
  constructor(readonly database: PieceSelectorDatabase) {}

  async listCollections(): Promise<string[]> {
    return collectionNames(await this.listScores(), (await this.database.collections.toArray()).map((value) => value.name))
  }

  async createCollection(name: string): Promise<void> {
    await this.database.transaction('rw', [this.database.scores, this.database.collections], async () => {
      const names = createCollectionNames(await this.listScores(), await this.listCollections(), name)
      await this.database.collections.bulkPut(names.map((value) => ({ key: collectionKey(value), name: value })))
    })
  }

  async assignCollection(ids: string[], name: string, updatedAt: string): Promise<void> {
    await this.database.transaction('rw', [this.database.scores, this.database.collections], async () => {
      const names = await this.listCollections()
      const target = names.find((value) => collectionKey(value) === collectionKey(name))
      if (!target) throw new Error('Collection no longer exists.')
      const scores = assignPiecesToCollection(await this.listScores(), ids, target, updatedAt)
      await this.database.scores.bulkPut(scores)
      await this.database.collections.bulkPut(names.map((value) => ({ key: collectionKey(value), name: value })))
    })
  }

  async renameCollection(previous: string, name: string): Promise<void> {
    await this.database.transaction('rw', [this.database.scores, this.database.performances, this.database.savedSetLists, this.database.savedSets, this.database.collections], async () => {
      const [scores, stored, setLists, savedSets, collections] = await Promise.all([this.listScores(), this.database.performances.get('last'), this.listSetLists(), this.listSavedSets(), this.listCollections()])
      const renamed = renameCollectionData({ scores, collections, lastPerformance: stored?.performance ?? null, setLists, savedSets }, previous, name)
      await this.database.collections.clear()
      await this.database.collections.bulkPut(renamed.collections.map((value) => ({ key: collectionKey(value), name: value })))
      await this.database.scores.bulkPut(renamed.scores)
      await this.database.savedSetLists.bulkPut(renamed.setLists)
      await this.database.savedSets.bulkPut(renamed.savedSets)
      if (renamed.lastPerformance) await this.database.performances.put({ key: 'last', performance: renamed.lastPerformance })
    })
  }

  async listScores(): Promise<Score[]> {
    return (await this.database.scores.toArray()).sort(comparePieces)
  }

  async getScore(id: string): Promise<Score | undefined> {
    return this.database.scores.get(id)
  }

  async deleteScore(id: string): Promise<void> {
    await this.database.transaction('rw', [this.database.scores, this.database.collections], async () => {
      if (!await this.database.scores.get(id)) throw new Error('This score no longer exists.')
      const names = await this.listCollections()
      await this.database.collections.bulkPut(names.map((name) => ({ key: collectionKey(name), name })))
      await this.database.scores.delete(id)
    })
  }

  async saveConfiguration(id: string, configuration: ScoreConfiguration, updatedAt: string): Promise<void> {
    await this.database.transaction('rw', [this.database.scores, this.database.performances, this.database.savedSetLists, this.database.savedSets], async () => {
      const score = await this.database.scores.get(id)
      if (!score) throw new Error('This score no longer exists.')
      await this.database.scores.update(id, {
        canStart: configuration.canStart,
        hotness: configuration.hotness,
        drumsIntro: configuration.drumsIntro,
        drummerNotes: configuration.drummerNotes === undefined ? readDrummerNotes(score.drummerNotes) : readDrummerNotesInput(configuration.drummerNotes, score.drummerNotes),
        ...(configuration.drummerTiming === undefined ? {} : { drummerTiming: readDrummerTiming(configuration.drummerTiming) }),
        goesHigh: configuration.goesHigh,
        enabled: configuration.enabled,
        tags: configuration.in80s === undefined ? score.tags : configuration.in80s ? ['80s'] : [],
        configuration: configurationStatus(configuration),
        updatedAt,
      })
      if (configuration.drummerNotes !== undefined || configuration.drummerTiming !== undefined) {
        const updated = await this.database.scores.get(id)
        if (updated) await this.updateSavedNotes([updated], updatedAt)
      }
    })
  }

  private async updateSavedNotes(scores: Score[], updatedAt: string): Promise<void> {
    const [stored, setLists, savedSets] = await Promise.all([this.database.performances.get('last'), this.listSetLists(), this.listSavedSets()])
    const next = updateSavedDrummerNotes({ lastPerformance: stored?.performance ?? null, setLists, savedSets }, scores, updatedAt)
    await this.database.savedSetLists.bulkPut(next.setLists)
    await this.database.savedSets.bulkPut(next.savedSets)
    if (next.lastPerformance) await this.database.performances.put({ key: 'last', performance: next.lastPerformance })
  }

  async saveBulkConfiguration(ids: string[], changes: BulkConfiguration, updatedAt: string): Promise<void> {
    await this.database.transaction('rw', this.database.scores, async () => {
      const uniqueIds = [...new Set(ids)]
      const scores = await this.database.scores.bulkGet(uniqueIds)
      if (scores.some((score) => !score)) throw new Error('This score no longer exists.')
      await this.database.scores.bulkPut(scores.map((score) => applyBulkConfiguration(score!, changes, updatedAt)))
    })
  }

  async applyReconciliation(
    plan: ReconciliationPlan,
    decisions: RenumberingDecisions,
    appliedAt: string,
    createId: () => string,
  ): Promise<FolderScan> {
    return this.database.transaction('rw', this.database.scores, this.database.scans, this.database.collections, async () => {
      const existing = await this.database.scores.toArray()
      const scanId = createId()
      const result = applyReconciliation(existing, plan, decisions, appliedAt, createId, scanId)
      await this.database.scores.bulkPut(result.scores)
      await this.database.scans.put(result.scan)
      const names = collectionNames(result.scores, [...await this.listCollections(), ...(plan.collection ? [plan.collection] : [])])
      await this.database.collections.bulkPut(names.map((value) => ({ key: collectionKey(value), name: value })))
      return result.scan
    })
  }

  async getLastScan(): Promise<FolderScan | undefined> {
    return this.database.scans.orderBy('appliedAt').last()
  }

  async importSettings(backup: SettingsBackup, updatedAt: string): Promise<SettingsImportReport> {
    return this.database.transaction('rw', [this.database.scores, this.database.performances, this.database.savedSetLists, this.database.savedSets], async () => {
      const existing = await this.database.scores.toArray()
      const result = applySettingsBackup(existing, backup, updatedAt)
      await this.database.scores.bulkPut(result.scores)
      const noteKeys = new Set(backup.pieces.filter((piece) => piece.settings.drummerNotes !== undefined || piece.settings.drummerTiming !== undefined).map(pieceKey))
      await this.updateSavedNotes(result.scores.filter((score) => noteKeys.has(pieceKey(score))), updatedAt)
      return result.report
    })
  }

  async saveLastPerformance(performance: GeneratedPerformance): Promise<void> {
    await this.database.transaction('rw', this.database.performances, this.database.savedSetLists, async () => {
      performance = normalizePerformanceEntries(performance)
      const lists = await this.listSetLists()
      assertLockedProgramsUnchanged(lists, lists, performance)
      await this.database.performances.put({ key: 'last', performance })
    })
  }

  async getLastPerformance(): Promise<GeneratedPerformance | undefined> {
    return (await this.database.performances.get('last'))?.performance
  }

  async listSetLists(): Promise<SavedSetList[]> {
    return this.database.savedSetLists.orderBy('updatedAt').reverse().toArray()
  }

  async saveSetList(setList: SavedSetList): Promise<void> {
    await this.database.transaction('rw', this.database.savedSetLists, this.database.performances, async () => {
      assertSetListEditable(await this.database.savedSetLists.get(setList.id))
      const performance = normalizePerformanceEntries(setList.performance)
      await this.database.savedSetLists.put({ ...setList, performance })
      await this.database.performances.put({ key: 'last', performance })
    })
  }

  async setSetListLocked(id: string, locked: boolean, updatedAt: string): Promise<SavedSetList> {
    return this.database.transaction('rw', this.database.savedSetLists, async () => {
      const current = await this.database.savedSetLists.get(id)
      if (!current) throw new Error('This setlist no longer exists.')
      const next = changeSetListLock(current, locked, updatedAt)
      await this.database.savedSetLists.put(next)
      return next
    })
  }

  getTonightSetList(): Promise<SavedSetList | undefined> { return readTonight(this.database) }
  saveTonightSetList(setList: SavedSetList): Promise<void> { return saveTonight(this.database, setList) }
  async clearTonightSetList(): Promise<void> { await this.database.tonight.delete('tonight') }

  async listSavedSets(): Promise<SavedSet[]> {
    return this.database.savedSets.orderBy('updatedAt').reverse().toArray()
  }

  async saveSavedSet(savedSet: SavedSet): Promise<void> {
    await this.database.savedSets.put({ ...savedSet, scores: uniqueEntries(savedSet.scores) })
  }
}
