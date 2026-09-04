import { PieceSelectorDatabase } from './database'
import { CloudRepository, CloudStateTransport } from './cloudRepository'
import { PieceSelectorRepository } from './repository'

export const database = new PieceSelectorDatabase()
export const repository = import.meta.env.DEV
  ? new PieceSelectorRepository(database)
  : new CloudRepository(database, new CloudStateTransport(fetch))
