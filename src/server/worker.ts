import { emptyCloudState, parseCloudState, type CloudState, type CloudStateEnvelope } from '../data/cloudState'
import { AuthenticationUnavailable, assertAuthenticationConfigured, clearSessionCookie, createSessionCookie, hasValidSession, passwordMatches } from './auth'

const STATE_PATH = '/api/state'
const LOGIN_PATH = '/api/login'
const LOGOUT_PATH = '/api/logout'
const SHARED_LIBRARY_ID = 'shared-band'
const MAX_STATE_BYTES = 2_000_000
const MAX_LOGIN_BYTES = 1_000

interface D1PreparedStatement {
  bind: (...values: Array<string | number | null>) => D1PreparedStatement
  first: <T>() => Promise<T | null>
}

interface D1Database {
  prepare: (query: string) => D1PreparedStatement
}

interface AssetsBinding {
  fetch: (request: Request) => Promise<Response>
}

interface RateLimiter {
  limit: (options: { key: string }) => Promise<{ success: boolean }>
}

export interface WorkerEnvironment {
  ASSETS: AssetsBinding
  DB: D1Database
  LOGIN_RATE_LIMITER?: RateLimiter
  AUTH_PASSWORD_HASH?: string
  SESSION_SIGNING_KEY?: string
}

interface StoredState {
  revision: number
  state_json: string
}

class InvalidStateRequest extends Error {}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8', ...headers },
  })
}

function noContent(setCookie: string): Response {
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store', 'set-cookie': setCookie } })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  return origin === null || origin === new URL(request.url).origin
}

async function login(request: Request, environment: WorkerEnvironment): Promise<Response> {
  if (!isSameOrigin(request)) return json({ error: 'Sign-in request came from an invalid origin.' }, 403)
  const limiter = environment.LOGIN_RATE_LIMITER
  if (!limiter) throw new AuthenticationUnavailable()
  const rate = await limiter.limit({ key: request.headers.get('cf-connecting-ip') ?? 'local' })
  if (!rate.success) return json({ error: 'Too many sign-in attempts. Try again in a minute.' }, 429, { 'retry-after': '60' })

  const claimedLength = Number(request.headers.get('content-length') ?? 0)
  if (claimedLength > MAX_LOGIN_BYTES) return json({ error: 'Incorrect password.' }, 401)
  const source = await request.text()
  if (new TextEncoder().encode(source).byteLength > MAX_LOGIN_BYTES) return json({ error: 'Incorrect password.' }, 401)
  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch {
    return json({ error: 'Incorrect password.' }, 401)
  }
  if (!isRecord(raw) || typeof raw.password !== 'string' || raw.password.length < 1 || raw.password.length > 200) {
    return json({ error: 'Incorrect password.' }, 401)
  }
  if (!await passwordMatches(raw.password, environment)) return json({ error: 'Incorrect password.' }, 401)
  return noContent(await createSessionCookie(environment))
}

async function readState(environment: WorkerEnvironment): Promise<CloudStateEnvelope> {
  const stored = await environment.DB.prepare('SELECT revision, state_json FROM app_states WHERE owner_id = ?')
    .bind(SHARED_LIBRARY_ID)
    .first<StoredState>()
  if (!stored) return { revision: 0, state: emptyCloudState() }
  return { revision: stored.revision, state: parseCloudState(JSON.parse(stored.state_json) as unknown) }
}

async function storeState(request: Request, environment: WorkerEnvironment): Promise<CloudStateEnvelope> {
  const claimedLength = Number(request.headers.get('content-length') ?? 0)
  if (claimedLength > MAX_STATE_BYTES) throw new InvalidStateRequest('Cloud state is too large.')
  const source = await request.text()
  if (new TextEncoder().encode(source).byteLength > MAX_STATE_BYTES) throw new InvalidStateRequest('Cloud state is too large.')
  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch {
    throw new InvalidStateRequest('Cloud state upload is not valid JSON.')
  }
  if (!isRecord(raw) || typeof raw.operationId !== 'string' || raw.operationId.trim() === '' || raw.operationId.length > 200) {
    throw new InvalidStateRequest('Cloud state upload is malformed.')
  }
  let state: CloudState
  try {
    state = parseCloudState(raw.state)
  } catch (error) {
    throw new InvalidStateRequest(error instanceof Error ? error.message : 'Cloud state upload is malformed.')
  }
  const stored = await environment.DB.prepare(`INSERT INTO app_states (owner_id, revision, operation_id, state_json, updated_at)
    VALUES (?, 1, ?, ?, ?)
    ON CONFLICT(owner_id) DO UPDATE SET
      revision = app_states.revision + 1,
      operation_id = excluded.operation_id,
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
    RETURNING revision`)
    .bind(SHARED_LIBRARY_ID, raw.operationId, JSON.stringify(state), new Date().toISOString())
    .first<{ revision: number }>()
  if (!stored) throw new Error('D1 did not persist the library.')
  return { revision: stored.revision, state }
}

export async function handleRequest(request: Request, environment: WorkerEnvironment): Promise<Response> {
  const url = new URL(request.url)
  try {
    if (!url.pathname.startsWith('/api/')) return environment.ASSETS.fetch(request)
    assertAuthenticationConfigured(environment)
    if (url.pathname === LOGIN_PATH) return request.method === 'POST' ? await login(request, environment) : json({ error: 'Method not allowed.' }, 405, { allow: 'POST' })
    if (url.pathname === LOGOUT_PATH) {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { allow: 'POST' })
      if (!isSameOrigin(request)) return json({ error: 'Sign-out request came from an invalid origin.' }, 403)
      return noContent(clearSessionCookie())
    }
    if (!await hasValidSession(request, environment)) return json({ error: 'Authentication is required.' }, 401)
    if (!isSameOrigin(request)) return json({ error: 'Request came from an invalid origin.' }, 403)

    if (url.pathname === STATE_PATH && request.method === 'GET') return json(await readState(environment))
    if (url.pathname === STATE_PATH && request.method === 'PUT') return json(await storeState(request, environment))
    return json({ error: 'Not found.' }, 404)
  } catch (error) {
    if (error instanceof AuthenticationUnavailable) return json({ error: 'Authentication is unavailable.' }, 503)
    if (error instanceof InvalidStateRequest) return json({ error: error.message }, 400)
    return json({ error: 'Cloud storage is temporarily unavailable.' }, 503)
  }
}

export default {
  fetch(request: Request, environment: WorkerEnvironment): Promise<Response> {
    return handleRequest(request, environment)
  },
}
