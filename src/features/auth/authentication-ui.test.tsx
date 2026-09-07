import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginScreen, SignOutButton } from './AuthenticationScreens'

describe('authentication controls', () => {
  it('submits the labelled password and announces an error', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn<(password: string) => Promise<void>>(() => Promise.reject(new Error('Incorrect password.')))
    render(<LoginScreen onLogin={onLogin} />)

    await user.type(screen.getByLabelText('Band password'), 'guess')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(onLogin).toHaveBeenCalledWith('guess')
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect password.')
  })

  it('offers an explicit sign-out action', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn<() => Promise<void>>(() => Promise.resolve())
    render(<SignOutButton onLogout={onLogout} />)
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onLogout).toHaveBeenCalledOnce()
  })
})
