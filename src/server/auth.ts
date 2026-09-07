const SESSION_COOKIE = '__Host-piece_selector_session'
const SESSION_VERSION = 'v1'
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
const encoder = new TextEncoder()

export class AuthenticationUnavailable extends Error {}

export interface AuthenticationEnvironment {
  AUTH_PASSWORD_HASH?: string
  SESSION_SIGNING_KEY?: string
}

function passwordHash(environment: AuthenticationEnvironment): Uint8Array {
  const configured = environment.AUTH_PASSWORD_HASH?.trim().toLocaleLowerCase('en')
  if (!configured || !/^[0-9a-f]{64}$/.test(configured)) throw new AuthenticationUnavailable()
  return Uint8Array.from({ length: 32 }, (_, index) => Number.parseInt(configured.slice(index * 2, index * 2 + 2), 16))
}

export function assertAuthenticationConfigured(environment: AuthenticationEnvironment): void {
  void passwordHash(environment)
  const source = environment.SESSION_SIGNING_KEY
  if (!source || encoder.encode(source).byteLength < 32) throw new AuthenticationUnavailable()
}

async function signingKey(environment: AuthenticationEnvironment): Promise<CryptoKey> {
  const source = environment.SESSION_SIGNING_KEY
  if (!source) throw new AuthenticationUnavailable()
  return crypto.subtle.importKey('raw', encoder.encode(source), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.byteLength ^ right.byteLength
  for (let index = 0; index < Math.max(left.byteLength, right.byteLength); index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return difference === 0
}

function base64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

function decodeBase64Url(source: string): ArrayBuffer | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(source)) return undefined
  const padded = source.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(source.length / 4) * 4, '=')
  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return bytes.buffer
  } catch {
    return undefined
  }
}

function cookieValue(request: Request): string | undefined {
  const cookies = request.headers.get('cookie')?.split(';') ?? []
  const session = cookies.find((cookie) => cookie.trimStart().startsWith(`${SESSION_COOKIE}=`))
  return session?.trim().slice(SESSION_COOKIE.length + 1)
}

export async function passwordMatches(password: string, environment: AuthenticationEnvironment): Promise<boolean> {
  assertAuthenticationConfigured(environment)
  const actual = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(password)))
  return constantTimeEqual(actual, passwordHash(environment))
}

export async function createSessionCookie(environment: AuthenticationEnvironment, now = Date.now()): Promise<string> {
  assertAuthenticationConfigured(environment)
  const expiresAt = Math.floor(now / 1_000) + SESSION_TTL_SECONDS
  const payload = `${SESSION_VERSION}:${expiresAt}`
  const signature = await crypto.subtle.sign('HMAC', await signingKey(environment), encoder.encode(payload))
  return `${SESSION_COOKIE}=${expiresAt}.${base64Url(signature)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}; Expires=${new Date(expiresAt * 1_000).toUTCString()}`
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

export async function hasValidSession(request: Request, environment: AuthenticationEnvironment, now = Date.now()): Promise<boolean> {
  assertAuthenticationConfigured(environment)
  const token = cookieValue(request)
  if (!token) return false
  const [rawExpiry, rawSignature, ...remaining] = token.split('.')
  const expiresAt = Number(rawExpiry)
  const signature = rawSignature ? decodeBase64Url(rawSignature) : undefined
  if (remaining.length || !Number.isSafeInteger(expiresAt) || !signature || signature.byteLength !== 32) return false
  const payload = `${SESSION_VERSION}:${expiresAt}`
  const authentic = await crypto.subtle.verify('HMAC', await signingKey(environment), signature, encoder.encode(payload))
  return authentic && expiresAt > Math.floor(now / 1_000)
}
