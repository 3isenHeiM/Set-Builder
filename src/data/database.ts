import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type { FolderScan, GeneratedPerformance, PerformanceScoreSnapshot, PerformanceSet, SavedSetList, Score, StoredPerformance } from '../domain/types'

export const DATABASE_NAME = 'piece-selector'

type LegacyHotness = Score['hotness'] | 4 | 5
type LegacyScoreV1 = Omit<Score, 'configuration' | 'hotness' | 'goesHigh'> & { hotness: LegacyHotness }
type UpgradeScoreV1 = LegacyScoreV1 & Partial<Pick<Score, 'configuration'>>
type UpgradeScoreV2 = Omit<Score, 'hotness' | 'goesHigh'> & { hotness: LegacyHotness }
type UpgradePerformanceScoreV2 = Omit<PerformanceScoreSnapshot, 'hotness' | 'goesHigh'> & { hotness: LegacyHotness }
type UpgradePerformanceSetV2 = Omit<PerformanceSet, 'scores'> & { scores: UpgradePerformanceScoreV2[] }
type UpgradePerformanceV2 = Omit<GeneratedPerformance, 'sets'> & { sets: UpgradePerformanceSetV2[] }
type UpgradeStoredPerformanceV2 = Omit<StoredPerformance, 'performance'> & { performance: UpgradePerformanceV2 }
type UpgradeScoreV3 = Omit<Score, 'goesHigh'> & Partial<Pick<Score, 'goesHigh'>>
type UpgradePerformanceScoreV3 = Omit<PerformanceScoreSnapshot, 'goesHigh'> & Partial<Pick<PerformanceScoreSnapshot, 'goesHigh'>>
type UpgradePerformanceSetV3 = Omit<PerformanceSet, 'scores'> & { scores: UpgradePerformanceScoreV3[] }
type UpgradePerformanceV3 = Omit<GeneratedPerformance, 'sets'> & { sets: UpgradePerformanceSetV3[] }
type UpgradeStoredPerformanceV3 = Omit<StoredPerformance, 'performance'> & { performance: UpgradePerformanceV3 }

export class PieceSelectorDatabase extends Dexie {
  scores!: EntityTable<Score, 'id'>
  scans!: EntityTable<FolderScan, 'id'>
  performances!: EntityTable<StoredPerformance, 'key'>
  savedSetLists!: EntityTable<SavedSetList, 'id'>

  constructor(name = DATABASE_NAME) {
    super(name)
    this.version(1).stores({
      scores: 'id,scoreNumber,availability,enabled,*tags',
      scans: 'id,appliedAt',
      performances: 'key',
    })
    this.version(2)
      .stores({
        scores: 'id,scoreNumber,availability,configuration,enabled,*tags',
        scans: 'id,appliedAt',
        performances: 'key',
      })
      .upgrade((transaction: Transaction) =>
        transaction
          .table<UpgradeScoreV1, string>('scores')
          .toCollection()
          .modify((score) => {
            score.configuration =
              score.canStart !== null && score.hotness !== null && score.drumsIntro !== null ? 'complete' : 'pending'
          }),
      )
    this.version(3)
      .stores({
        scores: 'id,scoreNumber,availability,configuration,enabled,*tags',
        scans: 'id,appliedAt',
        performances: 'key',
      })
      .upgrade(async (transaction: Transaction) => {
        await transaction
          .table<UpgradeScoreV2, string>('scores')
          .toCollection()
          .modify((score) => {
            if (score.hotness === 4 || score.hotness === 5) score.hotness = 3
          })
        await transaction
          .table<UpgradeStoredPerformanceV2, string>('performances')
          .toCollection()
          .modify((stored) => {
            for (const set of stored.performance.sets) {
              for (const score of set.scores) {
                if (score.hotness === 4 || score.hotness === 5) score.hotness = 3
              }
            }
          })
      })
    this.version(4)
      .stores({
        scores: 'id,scoreNumber,availability,configuration,enabled,*tags',
        scans: 'id,appliedAt',
        performances: 'key',
      })
      .upgrade(async (transaction: Transaction) => {
        await transaction
          .table<UpgradeScoreV3, string>('scores')
          .toCollection()
          .modify((score) => {
            score.goesHigh = null
            score.configuration = 'pending'
          })
        await transaction
          .table<UpgradeStoredPerformanceV3, string>('performances')
          .toCollection()
          .modify((stored) => {
            for (const set of stored.performance.sets) {
              for (const score of set.scores) score.goesHigh = false
            }
          })
      })
    this.version(5)
      .stores({
        scores: 'id,scoreNumber,availability,configuration,enabled,*tags',
        scans: 'id,appliedAt',
        performances: 'key',
      })
      .upgrade((transaction: Transaction) =>
        transaction
          .table<Score, string>('scores')
          .toCollection()
          .modify((score) => {
            if (!score.enabled) score.configuration = 'complete'
          }),
      )
    this.version(6)
      .stores({
        scores: 'id,scoreNumber,availability,configuration,enabled,*tags',
        scans: 'id,appliedAt',
        performances: 'key',
        savedSetLists: 'id,updatedAt',
      })
      .upgrade(async (transaction: Transaction) => {
        const stored = await transaction.table<StoredPerformance, string>('performances').get('last')
        if (!stored) return
        await transaction.table<SavedSetList, string>('savedSetLists').put({
          id: stored.performance.id,
          name: '',
          createdAt: stored.performance.generatedAt,
          updatedAt: stored.performance.generatedAt,
          performance: stored.performance,
        })
      })
  }
}

export class LegacyDatabaseV4 extends Dexie {
  scores!: EntityTable<Score, 'id'>

  constructor(name: string) {
    super(name)
    this.version(4).stores({
      scores: 'id,scoreNumber,availability,configuration,enabled,*tags',
      scans: 'id,appliedAt',
      performances: 'key',
      })
  }
}

export class LegacyDatabaseV1 extends Dexie {
  scores!: EntityTable<LegacyScoreV1, 'id'>
  performances!: EntityTable<UpgradeStoredPerformanceV2, 'key'>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      scores: 'id,scoreNumber,availability,enabled,*tags',
      scans: 'id,appliedAt',
      performances: 'key',
    })
  }
}
