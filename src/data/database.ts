import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type { FolderScan, Score, StoredPerformance } from '../domain/types'

export const DATABASE_NAME = 'piece-selector'

type LegacyScoreV1 = Omit<Score, 'configuration'>
type UpgradeScoreV1 = LegacyScoreV1 & Partial<Pick<Score, 'configuration'>>

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
  }
}

export class LegacyDatabaseV1 extends Dexie {
  scores!: EntityTable<LegacyScoreV1, 'id'>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      scores: 'id,scoreNumber,availability,enabled,*tags',
      scans: 'id,appliedAt',
      performances: 'key',
    })
  }
}
