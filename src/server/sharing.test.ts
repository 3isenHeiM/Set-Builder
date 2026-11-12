// @vitest-environment node
import { handleRequest, type WorkerEnvironment } from './worker'
import { createSessionCookie } from './auth'
import { emptyCloudState } from '../data/cloudState'
import { makePerformance, makeScore } from '../test/fixtures'

class SharingD1 {
  readonly shares = new Map<string, string>()
  state = { ...emptyCloudState(), scores: [makeScore({ fileName: 'Private filename.mscz' })], setLists: [{ id: 'performance-1', name: 'Evening', createdAt: '2026-11-12T17:00:00Z', updatedAt: '2026-11-12T17:00:00Z', performance: makePerformance() }] }
  prepare(query: string) {
    let values: Array<string | number | null> = []
    const statement = {
      bind: (...input: Array<string | number | null>) => { values = input; return statement },
      first: <T>(): Promise<T | null> => {
        const id = String(values[0])
        let result: unknown = null
        if (query.includes('SELECT revision')) result = { revision: 1, state_json: JSON.stringify(this.state) }
        else if (query.includes('SELECT set_list_id')) {
          const found = [...this.shares].find(([, token]) => token === id)
          result = found ? { set_list_id: found[0] } : null
        } else if (query.startsWith('INSERT INTO setlist_shares')) {
          if (!this.shares.has(id)) this.shares.set(id, String(values[1]))
          result = { token: this.shares.get(id) }
        } else if (query.startsWith('DELETE FROM setlist_shares')) {
          this.shares.delete(id)
          result = { set_list_id: id }
        } else if (query.startsWith('INSERT INTO app_states')) {
          this.state = JSON.parse(String(values[2])) as typeof this.state
          result = { revision: 2 }
        } else throw new Error('Unexpected SQL')
        return Promise.resolve(result as T | null)
      },
    }
    return statement
  }
}

async function setup() {
  const database = new SharingD1()
  const env: WorkerEnvironment = { DB: database, ASSETS: { fetch: () => Promise.resolve(new Response('app')) }, AUTH_PASSWORD_HASH: '0'.repeat(64), SESSION_SIGNING_KEY: 'a test signing key with thirty-two bytes or more' }
  const cookie = (await createSessionCookie(env)).split(';')[0]!
  const headers = { cookie, origin: 'https://example.com' }
  const control = (method: string, requestHeaders: HeadersInit = headers, id = 'performance-1') => handleRequest(new Request(`https://example.com/api/setlists/${id}/share`, { method, headers: requestHeaders }), env)
  const view = (token: string, method = 'GET') => handleRequest(new Request(`https://example.com/api/shared/${token}`, { method }), env)
  return { database, env, headers, control, view }
}

describe('read-only setlist sharing', () => {
  it('requires an authenticated same-origin owner to create or revoke links', async () => {
    const { database, control } = await setup()
    expect((await control('POST', {})).status).toBe(401)
    expect((await control('DELETE', {})).status).toBe(401)
    expect((await control('POST', { origin: 'https://evil.example' })).status).toBe(401)
    expect(database.shares.size).toBe(0)
    const { headers } = await setup()
    expect((await control('POST', { ...headers, origin: 'https://evil.example' })).status).toBe(403)
    expect((await control('GET')).status).toBe(405)
    expect((await control('POST', undefined, 'missing')).status).toBe(404)
  })

  it('returns a stable unguessable link and exposes only the selected setlist fields', async () => {
    const { control, view } = await setup()
    const created = await control('POST')
    expect(created.status).toBe(200)
    const { token } = await created.json() as { token: string }
    expect(token).toMatch(/^[a-f0-9]{64}$/)
    expect(await (await control('POST')).json()).toEqual({ token })
    const response = await view(token)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
    const body = await response.json() as unknown
    expect(body).toMatchObject({ name: 'Evening', sets: [{ scores: [{ title: 'Take On Me', displayNumber: '01' }] }] })
    for (const privateField of ['Private filename', 'score-1', 'firstImportedAt', 'fileName', 'relativePath', 'seed']) expect(JSON.stringify(body)).not.toContain(privateField)
  })

  it('reflects saved updates, revokes immediately, and rotates the token when re-shared', async () => {
    const { control, view, database, env, headers } = await setup()
    const { token } = await (await control('POST')).json() as { token: string }
    const state = { ...database.state, setLists: database.state.setLists.map((list) => ({ ...list, name: 'Updated event' })) }
    expect((await handleRequest(new Request('https://example.com/api/state', { method: 'PUT', headers, body: JSON.stringify({ operationId: 'edit', state }) }), env)).status).toBe(200)
    expect(await (await view(token)).json()).toMatchObject({ name: 'Updated event' })
    expect((await view(token, 'PUT')).status).toBe(405)
    expect((await view(token, 'POST')).status).toBe(405)
    expect((await view('f'.repeat(64))).status).toBe(404)
    expect((await control('DELETE')).status).toBe(204)
    expect((await view(token)).status).toBe(404)
    const renewed = await (await control('POST')).json() as { token: string }
    expect(renewed.token).not.toBe(token)
    expect((await view(renewed.token)).status).toBe(200)
    expect((await view(token)).status).toBe(404)
  })
})
