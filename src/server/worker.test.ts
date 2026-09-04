import { makeScore } from '../test/fixtures'
import { emptyCloudState } from '../data/cloudState'
import { handleRequest, type WorkerEnvironment } from './worker'

interface Stored {
  revision: number
  operation_id: string
  state_json: string
}

class MemoryD1 {
  readonly states = new Map<string, Stored>()

  prepare(query: string) {
    const values: Array<string | number | null> = []
    const statement = {
      bind: (...bound: Array<string | number | null>) => {
        values.push(...bound)
        return statement
      },
      first: <T>(): Promise<T | null> => {
        const ownerId = String(values[0])
        if (query.startsWith('SELECT')) return Promise.resolve((this.states.get(ownerId) ?? null) as T | null)
        const current = this.states.get(ownerId)
        const revision = (current?.revision ?? 0) + 1
        this.states.set(ownerId, {
          revision,
          operation_id: String(values[1]),
          state_json: String(values[2]),
        })
        return Promise.resolve({ revision } as T)
      },
    }
    return statement
  }
}

function environment(database = new MemoryD1()): WorkerEnvironment {
  return { ASSETS: { fetch: () => Promise.resolve(new Response('app')) }, DB: database }
}

const allow = (): Promise<string> => Promise.resolve('access-user')
const deny = (): Promise<undefined> => Promise.resolve(undefined)

describe('authenticated Cloudflare worker', () => {
  it('protects the app shell and API before reading storage', async () => {
    const api = await handleRequest(new Request('https://example.com/api/state'), environment(), {}, deny)
    const asset = await handleRequest(new Request('https://example.com/'), environment(), {}, deny)
    expect(api.status).toBe(403)
    expect(asset.status).toBe(403)
  })

  it('keeps separate authenticated D1 libraries and persists validated state', async () => {
    const database = new MemoryD1()
    const env = environment(database)
    const state = { ...emptyCloudState(), scores: [makeScore()] }
    const write = await handleRequest(new Request('https://example.com/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operationId: 'operation-1', state }),
    }), env, {}, allow)
    const read = await handleRequest(new Request('https://example.com/api/state'), env, {}, allow)
    const other = await handleRequest(new Request('https://example.com/api/state'), env, {}, () => Promise.resolve('other-user'))

    expect(write.status).toBe(200)
    expect(await read.json()).toMatchObject({ revision: 1, state: { scores: [{ title: 'Take On Me' }] } })
    expect(await other.json()).toMatchObject({ revision: 0, state: { scores: [] } })
  })

  it('rejects malformed client state instead of storing it', async () => {
    const database = new MemoryD1()
    const invalid = { ...emptyCloudState(), scores: [makeScore({ canStart: null })] }
    const result = await handleRequest(new Request('https://example.com/api/state', {
      method: 'PUT',
      body: JSON.stringify({ operationId: 'operation-1', state: invalid }),
    }), environment(database), {}, allow)

    expect(result.status).toBe(400)
    expect(database.states.size).toBe(0)
  })
})
