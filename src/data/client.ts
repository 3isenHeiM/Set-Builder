import { PieceSelectorDatabase } from './database'
import { CookieAuthenticationClient } from './authentication'
import { CloudRepository, CloudStateTransport } from './cloudRepository'
import { PieceSelectorRepository } from './repository'

export const database = new PieceSelectorDatabase()
export const browserFetch = (input: string, init?: RequestInit) => window.fetch(input, init)
export const repository = import.meta.env.DEV
  ? new PieceSelectorRepository(database)
  : new CloudRepository(database, new CloudStateTransport(browserFetch))
export const authentication = import.meta.env.DEV ? undefined : new CookieAuthenticationClient(browserFetch, database)
