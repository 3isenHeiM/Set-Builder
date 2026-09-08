import { browserFetch } from './client'

describe('browser transport', () => {
  it('calls fetch with Window as its receiver', async () => {
    const restoreFetch = window.fetch.bind(window)
    window.fetch = function (this: Window): Promise<Response> {
      if (this !== window) throw new TypeError("'fetch' called on an object that does not implement interface Window.")
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    try {
      await expect(browserFetch('/api/logout', { method: 'POST' })).resolves.toHaveProperty('ok', true)
    } finally {
      window.fetch = restoreFetch
    }
  })
})
