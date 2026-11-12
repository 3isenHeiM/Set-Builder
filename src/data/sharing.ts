import { parseSharedSetList } from '../domain/sharedSetList'

type FetchRequest = (input: string, init?: RequestInit) => Promise<Response>
const browserFetch: FetchRequest = (input, init) => window.fetch(input, init)
export class SharingClient {
  constructor(private readonly fetchRequest: FetchRequest = browserFetch) {}

  async create(id: string): Promise<string> {
    const response = await this.fetchRequest(`/api/setlists/${encodeURIComponent(id)}/share`, { method: 'POST', credentials: 'same-origin' })
    if (!response.ok) throw new Error('Sharing is unavailable. Try again online.')
    const value: unknown = await response.json()
    if (typeof value !== 'object' || value === null || !('token' in value) || typeof value.token !== 'string' || !/^[a-f0-9]{64}$/.test(value.token)) throw new Error('Sharing is unavailable. Try again online.')
    return value.token
  }

  async revoke(id: string): Promise<void> {
    const response = await this.fetchRequest(`/api/setlists/${encodeURIComponent(id)}/share`, { method: 'DELETE', credentials: 'same-origin' })
    if (!response.ok) throw new Error('Sharing is unavailable. Try again online.')
  }

  async read(token: string, signal?: AbortSignal) {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('This shared setlist is unavailable.')
    const response = await this.fetchRequest(`/api/shared/${token}`, { credentials: 'omit', cache: 'no-store', ...(signal ? { signal } : {}) })
    if (!response.ok) throw new Error('This shared setlist is unavailable.')
    return parseSharedSetList(await response.json())
  }
}

export const sharing = new SharingClient()
