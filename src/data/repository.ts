import { applyReconciliation } from '../domain/reconciliation'
import { applySettingsBackup } from '../domain/settingsBackup'
import type { SettingsBackup, SettingsImportReport } from '../domain/settingsBackup'
import type {
  FolderScan,
  GeneratedPerformance,
  ReconciliationPlan,
  RenumberingDecisions,
  SavedSetList,
  Score,
  ScoreConfiguration,
} from '../domain/types'
import { PieceSelectorDatabase } from './database'
import { configurationStatus } from '../domain/configuration'

export interface ScoreRepository {
  listScores: () => Promise<Score[]>
  getScore: (id: string) => Promise<Score | undefined>
  saveConfiguration: (id: string, configuration: ScoreConfiguration, updatedAt: string) => Promise<void>
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
  saveLastPerformance: (performance: GeneratedPerformance) => Promise<void>
  getLastPerformance: () => Promise<GeneratedPerformance | undefined>
  listSetLists: () => Promise<SavedSetList[]>
  saveSetList: (setList: SavedSetList) => Promise<void>
}

export class PieceSelectorRepository implements ScoreRepository, PerformanceRepository {
  constructor(readonly database: PieceSelectorDatabase) {}

  async listScores(): Promise<Score[]> {
    return this.database.scores.orderBy('scoreNumber').toArray()
  }

  async getScore(id: string): Promise<Score | undefined> {
    return this.database.scores.get(id)
  }

  async saveConfiguration(id: string, configuration: ScoreConfiguration, updatedAt: string): Promise<void> {
    await this.database.transaction('rw', this.database.scores, async () => {
      const score = await this.database.scores.get(id)
      if (!score) throw new Error('This score no longer exists.')
      await this.database.scores.update(id, {
        canStart: configuration.canStart,
        hotness: configuration.hotness,
        drumsIntro: configuration.drumsIntro,
        goesHigh: configuration.goesHigh,
        enabled: configuration.enabled,
        tags: configuration.in80s ? ['80s'] : [],
        configuration: configurationStatus(configuration),
        updatedAt,
      })
    })
  }

  async applyReconciliation(
    plan: ReconciliationPlan,
    decisions: RenumberingDecisions,
    appliedAt: string,
    createId: () => string,
  ): Promise<FolderScan> {
    return this.database.transaction('rw', this.database.scores, this.database.scans, async () => {
      const existing = await this.database.scores.toArray()
      const scanId = createId()
      const result = applyReconciliation(existing, plan, decisions, appliedAt, createId, scanId)
      await this.database.scores.bulkPut(result.scores)
      await this.database.scans.put(result.scan)
      return result.scan
    })
  }

  async getLastScan(): Promise<FolderScan | undefined> {
    return this.database.scans.orderBy('appliedAt').last()
  }

  async importSettings(backup: SettingsBackup, updatedAt: string): Promise<SettingsImportReport> {
    return this.database.transaction('rw', this.database.scores, async () => {
      const existing = await this.database.scores.toArray()
      const result = applySettingsBackup(existing, backup, updatedAt)
      await this.database.scores.bulkPut(result.scores)
      return result.report
    })
  }

  async saveLastPerformance(performance: GeneratedPerformance): Promise<void> {
    await this.database.performances.put({ key: 'last', performance })
  }

  async getLastPerformance(): Promise<GeneratedPerformance | undefined> {
    return (await this.database.performances.get('last'))?.performance
  }

  async listSetLists(): Promise<SavedSetList[]> {
    return this.database.savedSetLists.orderBy('updatedAt').reverse().toArray()
  }

  async saveSetList(setList: SavedSetList): Promise<void> {
    await this.database.transaction('rw', this.database.savedSetLists, this.database.performances, async () => {
      await this.database.savedSetLists.put(setList)
      await this.database.performances.put({ key: 'last', performance: setList.performance })
    })
  }
}
