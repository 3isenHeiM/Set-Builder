// @vitest-environment node
import { emptyCloudState } from '../data/cloudState'
import { makeScore } from '../test/fixtures'
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
        this.states.set(ownerId, { revision, operation_id: String(values[1]), state_json: String(values[2]) })
        return Promise.resolve({ revision } as T)
      },
    }
    return statement
  }
}

async function hash(password: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)))
  return [...digest].map((value) => value.toString(16).padStart(2, '0')).join('')
}

async function environment(database = new MemoryD1(), allowed = true): Promise<WorkerEnvironment> {
  return {
    ASSETS: { fetch: () => Promise.resolve(new Response('app')) },
    DB: database,
    LOGIN_RATE_LIMITER: { limit: () => Promise.resolve({ success: allowed }) },
    AUTH_PASSWORD_HASH: await hash('test passphrase'),
    SESSION_SIGNING_KEY: 'local test signing key with at least thirty-two bytes',
  }
}

async function signIn(env: WorkerEnvironment): Promise<string> {
  const response = await handleRequest(new Request('https://example.com/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    body: JSON.stringify({ password: 'test passphrase' }),
  }), env)
  expect(response.status).toBe(204)
  return response.headers.get('set-cookie')?.split(';')[0] ?? ''
}

describe('signed-cookie Cloudflare Worker', () => {
  it('serves the non-sensitive app shell but protects D1 state', async () => {
    const env = await environment()
    const asset = await handleRequest(new Request('https://example.com/'), env)
    const api = await handleRequest(new Request('https://example.com/api/state'), env)
    expect(asset.status).toBe(200)
    expect(api.status).toBe(401)
  })

  it('signs in, stores one shared library and signs out', async () => {
    const database = new MemoryD1()
    const env = await environment(database)
    const cookie = await signIn(env)
    const headers = { cookie, origin: 'https://example.com' }
    const state = { ...emptyCloudState(), scores: [makeScore()] }
    const write = await handleRequest(new Request('https://example.com/api/state', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ operationId: 'operation-1', state }),
    }), env)
    const read = await handleRequest(new Request('https://example.com/api/state', { headers }), env)
    const logout = await handleRequest(new Request('https://example.com/api/logout', { method: 'POST', headers }), env)

    expect(write.status).toBe(200)
    expect(await read.json()).toMatchObject({ revision: 1, state: { scores: [{ title: 'Take On Me' }] } })
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(database.states.has('shared-band')).toBe(true)
  })

  it('rejects incorrect passwords, cross-origin logins and rate-limited attempts', async () => {
    const env = await environment()
    const incorrect = await handleRequest(new Request('https://example.com/api/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'not the password' }),
    }), env)
    const foreign = await handleRequest(new Request('https://example.com/api/login', {
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
      body: JSON.stringify({ password: 'test passphrase' }),
    }), env)
    const limitedEnv = await environment(new MemoryD1(), false)
    const limited = await handleRequest(new Request('https://example.com/api/login', { method: 'POST', body: '{}' }), limitedEnv)

    expect(incorrect.status).toBe(401)
    expect(foreign.status).toBe(403)
    expect(limited.status).toBe(429)
  })

  it('fails closed when authentication secrets are not configured', async () => {
    const missingSecrets: WorkerEnvironment = {
      ASSETS: { fetch: () => Promise.resolve(new Response('app')) },
      DB: new MemoryD1(),
      LOGIN_RATE_LIMITER: { limit: () => Promise.resolve({ success: true }) },
    }
    const login = await handleRequest(new Request('https://example.com/api/login', { method: 'POST', body: JSON.stringify({ password: 'anything' }) }), missingSecrets)
    expect(login.status).toBe(503)
  })

  it('rejects tampered sessions and malformed client state', async () => {
    const database = new MemoryD1()
    const env = await environment(database)
    const cookie = await signIn(env)
    const tampered = `${cookie.slice(0, -1)}x`
    expect((await handleRequest(new Request('https://example.com/api/state', { headers: { cookie: tampered } }), env)).status).toBe(401)

    const invalid = { ...emptyCloudState(), scores: [makeScore({ canStart: null })] }
    const result = await handleRequest(new Request('https://example.com/api/state', {
      method: 'PUT',
      headers: { cookie, origin: 'https://example.com' },
      body: JSON.stringify({ operationId: 'operation-1', state: invalid }),
    }), env)
    expect(result.status).toBe(400)
    expect(database.states.size).toBe(0)
  })
})
