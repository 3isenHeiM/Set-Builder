import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginScreen, SignOutButton } from './AuthenticationScreens'

describe('authentication controls', () => {
  afterEach(() => {
    delete window.turnstile
  })

  it('submits the labelled password and announces an error', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn<(password: string, token: string) => Promise<void>>(() => Promise.reject(new Error('Incorrect password.')))
    window.turnstile = {
      ready: vi.fn(),
      render: (_container, options) => { options.callback('verified-human'); return 'widget' },
      remove: vi.fn(),
      reset: vi.fn(),
    }
    render(<LoginScreen loadSiteKey={() => Promise.resolve('test-site-key')} onLogin={onLogin} />)

    await user.type(screen.getByLabelText('Band password'), 'guess')
    const submit = screen.getByRole('button', { name: 'Sign in' })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)
    expect(window.turnstile.ready).not.toHaveBeenCalled()
    expect(onLogin).toHaveBeenCalledWith('guess', 'verified-human')
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect password.')
  })

  it('keeps sign-in disabled until verification succeeds', () => {
    render(<LoginScreen loadSiteKey={() => new Promise<string>(() => undefined)} onLogin={() => Promise.resolve()} />)
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
    expect(screen.getByText('Preparing secure verification…')).toBeVisible()
  })

  it('offers an explicit sign-out action', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn<() => Promise<void>>(() => Promise.resolve())
    render(<SignOutButton onLogout={onLogout} />)
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onLogout).toHaveBeenCalledOnce()
  })
})
