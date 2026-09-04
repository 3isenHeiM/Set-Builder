import { createRemoteJWKSet, jwtVerify } from 'jose'
import { emptyCloudState, parseCloudState, type CloudState, type CloudStateEnvelope } from '../data/cloudState'

const STATE_PATH = '/api/state'
const MAX_STATE_BYTES = 2_000_000

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

interface AccessIdentity {
  email?: string
}

interface AccessContext {
  access?: {
    aud: string
    getIdentity: () => Promise<AccessIdentity | null>
  }
}

export interface WorkerEnvironment {
  ASSETS: AssetsBinding
  DB: D1Database
  TEAM_DOMAIN?: string
  POLICY_AUD?: string
}

interface StoredState {
  revision: number
  state_json: string
}

class InvalidStateRequest extends Error {}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function teamOrigin(teamDomain: string): string {
  const origin = new URL(teamDomain).origin
  const hostname = new URL(origin).hostname
  if (!hostname.endsWith('.cloudflareaccess.com')) throw new Error('TEAM_DOMAIN must be a Cloudflare Access team domain.')
  return origin
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function keySet(teamDomain: string): ReturnType<typeof createRemoteJWKSet> {
  let keys = keySets.get(teamDomain)
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`))
    keySets.set(teamDomain, keys)
  }
  return keys
}

export type AccessVerifier = (request: Request, environment: WorkerEnvironment, context: AccessContext) => Promise<string | undefined>

export async function verifyAccess(request: Request, environment: WorkerEnvironment, context: AccessContext): Promise<string | undefined> {
  if (context.access) {
    const identity = await context.access.getIdentity()
    return identity?.email?.trim().toLocaleLowerCase('en')
  }

  if (!environment.TEAM_DOMAIN || !environment.POLICY_AUD) return undefined
  const token = request.headers.get('cf-access-jwt-assertion')
  if (!token) return undefined
  const issuer = teamOrigin(environment.TEAM_DOMAIN)
  const { payload } = await jwtVerify(token, keySet(issuer), { issuer, audience: environment.POLICY_AUD })
  return typeof payload.sub === 'string' && payload.sub !== '' ? payload.sub : undefined
}

async function readState(environment: WorkerEnvironment, ownerId: string): Promise<CloudStateEnvelope> {
  const stored = await environment.DB.prepare('SELECT revision, state_json FROM app_states WHERE owner_id = ?')
    .bind(ownerId)
    .first<StoredState>()
  if (!stored) return { revision: 0, state: emptyCloudState() }
  return { revision: stored.revision, state: parseCloudState(JSON.parse(stored.state_json) as unknown) }
}

async function storeState(request: Request, environment: WorkerEnvironment, ownerId: string): Promise<CloudStateEnvelope> {
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
    .bind(ownerId, raw.operationId, JSON.stringify(state), new Date().toISOString())
    .first<{ revision: number }>()
  if (!stored) throw new Error('D1 did not persist the library.')
  return { revision: stored.revision, state }
}

export async function handleRequest(
  request: Request,
  environment: WorkerEnvironment,
  context: AccessContext,
  authenticate: AccessVerifier = verifyAccess,
): Promise<Response> {
  const url = new URL(request.url)
  try {
    let ownerId: string | undefined
    try {
      ownerId = await authenticate(request, environment, context)
    } catch {
      return json({ error: 'Cloudflare Access authentication is invalid.' }, 403)
    }
    if (!ownerId) return json({ error: 'Cloudflare Access authentication is required.' }, 403)

    if (url.pathname === STATE_PATH && request.method === 'GET') return json(await readState(environment, ownerId))
    if (url.pathname === STATE_PATH && request.method === 'PUT') return json(await storeState(request, environment, ownerId))
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404)
    return environment.ASSETS.fetch(request)
  } catch (error) {
    if (error instanceof InvalidStateRequest) return json({ error: error.message }, 400)
    return json({ error: 'Cloud storage is temporarily unavailable.' }, 503)
  }
}

export default {
  fetch(request: Request, environment: WorkerEnvironment, context: AccessContext): Promise<Response> {
    return handleRequest(request, environment, context)
  },
}
