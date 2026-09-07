import { clearCachedState, readSyncRecord } from './cloudCache'
import { CloudApiError, CloudStateTransport, type CloudFetch } from './cloudRepository'
import type { PieceSelectorDatabase } from './database'

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown }
    if (typeof body.error === 'string') return body.error
  } catch {
    // A malformed error response is intentionally reduced to a safe client message.
  }
  return fallback
}

export interface AuthenticationClient {
  login: (password: string) => Promise<void>
  logout: () => Promise<void>
}

export class CookieAuthenticationClient implements AuthenticationClient {
  constructor(private readonly fetchRequest: CloudFetch, private readonly database?: PieceSelectorDatabase) {}

  async login(password: string): Promise<void> {
    const response = await this.fetchRequest('/api/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (response.status !== 204) throw new CloudApiError(await readError(response, 'Sign in failed. Try again.'), response.status)
  }

  async logout(): Promise<void> {
    if (this.database) {
      const sync = await readSyncRecord(this.database)
      if (sync?.pending) await new CloudStateTransport(this.fetchRequest).write(sync.pending)
    }
    const response = await this.fetchRequest('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    })
    if (response.status !== 204) throw new CloudApiError(await readError(response, 'Sign out failed. Try again.'), response.status)
    if (this.database) await clearCachedState(this.database)
  }
}
