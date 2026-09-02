import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type { FolderScan, GeneratedPerformance, PerformanceScoreSnapshot, PerformanceSet, Score, StoredPerformance } from '../domain/types'

export const DATABASE_NAME = 'piece-selector'

type LegacyHotness = Score['hotness'] | 4 | 5
type LegacyScoreV1 = Omit<Score, 'configuration' | 'hotness'> & { hotness: LegacyHotness }
type UpgradeScoreV1 = LegacyScoreV1 & Partial<Pick<Score, 'configuration'>>
type UpgradeScoreV2 = Omit<Score, 'hotness'> & { hotness: LegacyHotness }
type UpgradePerformanceScoreV2 = Omit<PerformanceScoreSnapshot, 'hotness'> & { hotness: LegacyHotness }
type UpgradePerformanceSetV2 = Omit<PerformanceSet, 'scores'> & { scores: UpgradePerformanceScoreV2[] }
type UpgradePerformanceV2 = Omit<GeneratedPerformance, 'sets'> & { sets: UpgradePerformanceSetV2[] }
type UpgradeStoredPerformanceV2 = Omit<StoredPerformance, 'performance'> & { performance: UpgradePerformanceV2 }

export class PieceSelectorDatabase extends Dexie {
  scores!: EntityTable<Score, 'id'>
  scans!: EntityTable<FolderScan, 'id'>
  performances!: EntityTable<StoredPerformance, 'key'>

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
