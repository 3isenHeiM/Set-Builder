import { useState, type FormEvent } from 'react'
import { localizedError, useI18n } from '../../app/i18n'
import { UiIcon } from '../../app/UiIcon'

export function LoginScreen({ onLogin }: { onLogin: (password: string) => Promise<void> }) {
  const { locale, t } = useI18n()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSigningIn(true)
    try {
      await onLogin(password)
    } catch (caught) {
      setError(localizedError(caught, locale, t('signInFailed')))
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <main id="main-content" className="auth-screen">
      <div className="hero-mark" aria-hidden="true"><UiIcon name="music" /></div>
      <div><h1>{t('signInTitle')}</h1><p className="secondary">{t('signInHelp')}</p></div>
      <form className="auth-form" onSubmit={(event) => { void submit(event) }}>
        <label htmlFor="band-password">{t('bandPassword')}</label>
        <input id="band-password" type="password" value={password} required maxLength={200} autoComplete="current-password" enterKeyHint="go" aria-invalid={Boolean(error)} aria-describedby={error ? 'sign-in-error' : undefined} onChange={(event) => setPassword(event.target.value)} />
        <button className="primary-action" type="submit" disabled={signingIn}>{signingIn ? t('signingIn') : t('signIn')}</button>
      </form>
      {error && <p id="sign-in-error" className="error" role="alert">{error}</p>}
    </main>
  )
}

export function SignOutButton({ onLogout }: { onLogout: () => Promise<void> }) {
  const { locale, t } = useI18n()
  const [error, setError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setError('')
    setSigningOut(true)
    try {
      await onLogout()
    } catch (caught) {
      setError(localizedError(caught, locale, t('signOutFailed')))
    } finally {
      setSigningOut(false)
    }
  }

  return <div className="auth-actions"><button className="secondary-action" type="button" disabled={signingOut} onClick={() => { void signOut() }}>{signingOut ? t('signingOut') : t('signOut')}</button>{error && <p className="error" role="alert">{error}</p>}</div>
}
