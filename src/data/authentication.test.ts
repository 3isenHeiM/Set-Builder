import Dexie from 'dexie'
import { makeScore } from '../test/fixtures'
import { CookieAuthenticationClient } from './authentication'
import { emptyCloudState } from './cloudState'
import { PieceSelectorDatabase } from './database'

function databaseName(): string {
  return `piece-selector-auth-test-${crypto.randomUUID()}`
}

describe('authentication client', () => {
  it('checks the session without opening cloud state', async () => {
    const active = new CookieAuthenticationClient((path) => Promise.resolve(path === '/api/session'
      ? new Response(null, { status: 204 })
      : Response.json({ siteKey: 'public-site-key' })))
    const missing = new CookieAuthenticationClient(() => Promise.resolve(Response.json({ error: 'Authentication is required.' }, { status: 401 })))

    await expect(active.hasSession()).resolves.toBe(true)
    await expect(active.loadTurnstileSiteKey()).resolves.toBe('public-site-key')
    await expect(missing.hasSession()).resolves.toBe(false)
  })

  it('flushes deferred state before signing out and clearing the offline cache', async () => {
    const name = databaseName()
    const database = new PieceSelectorDatabase(name)
    const state = { ...emptyCloudState(), scores: [makeScore()] }
    await database.scores.put(makeScore())
    await database.cloudSync.put({ key: 'cloud', connected: true, revision: 1, pending: state, backend: 'signed-cookie-v1' })
    const paths: string[] = []
    const fetchRequest = vi.fn((path: string) => {
      paths.push(path)
      return Promise.resolve(path === '/api/logout' ? new Response(null, { status: 204 }) : Response.json({ revision: 2, state }))
    })

    await new CookieAuthenticationClient(fetchRequest, database).logout()
    expect(paths).toEqual(['/api/state', '/api/logout'])
    expect(await database.scores.count()).toBe(0)
    expect(await database.cloudSync.count()).toBe(0)
    database.close()
    await Dexie.delete(name)
  })

  it('surfaces rate-limit errors returned by the Worker', async () => {
    const client = new CookieAuthenticationClient(() => Promise.resolve(Response.json({ error: 'Too many sign-in attempts.' }, { status: 429 })))
    await expect(client.login('guess', 'verified-human')).rejects.toMatchObject({ message: 'Too many sign-in attempts.', status: 429 })
  })
})
