// @vitest-environment node
import { AuthenticationUnavailable, createSessionCookie, hasValidSession, passwordMatches } from './auth'

async function hash(password: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)))
  return [...digest].map((value) => value.toString(16).padStart(2, '0')).join('')
}

describe('signed session cookies', () => {
  it('accepts the configured password without retaining it', async () => {
    const environment = { AUTH_PASSWORD_HASH: await hash('shared test password'), SESSION_SIGNING_KEY: 'long random test key with more than thirty-two bytes' }
    await expect(passwordMatches('shared test password', environment)).resolves.toBe(true)
    await expect(passwordMatches('different', environment)).resolves.toBe(false)
  })

  it('accepts only an authentic, unexpired cookie', async () => {
    const environment = { AUTH_PASSWORD_HASH: await hash('shared test password'), SESSION_SIGNING_KEY: 'long random test key with more than thirty-two bytes' }
    const setCookie = await createSessionCookie(environment, 2_000_000)
    const cookie = setCookie.split(';')[0] ?? ''
    const request = new Request('https://example.com/api/state', { headers: { cookie } })
    expect(setCookie).toContain('HttpOnly; Secure; SameSite=Strict')
    await expect(hasValidSession(request, environment, 2_000_000)).resolves.toBe(true)
    await expect(hasValidSession(request, environment, Date.parse('2100-01-01T00:00:00.000Z'))).resolves.toBe(false)
  })

  it('rejects incomplete server configuration', async () => {
    await expect(passwordMatches('password', {})).rejects.toBeInstanceOf(AuthenticationUnavailable)
    await expect(createSessionCookie({ SESSION_SIGNING_KEY: 'short' })).rejects.toBeInstanceOf(AuthenticationUnavailable)
  })
})
