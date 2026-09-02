import { PieceSelectorDatabase } from './database'
import { PieceSelectorRepository } from './repository'

export const database = new PieceSelectorDatabase()
export const repository = new PieceSelectorRepository(database)
