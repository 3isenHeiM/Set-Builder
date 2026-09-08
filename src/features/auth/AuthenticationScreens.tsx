import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { localizedError, useI18n } from '../../app/i18n'
import { UiIcon } from '../../app/UiIcon'
import { TurnstileVerification } from './TurnstileVerification'

export function LoginScreen({ loadSiteKey, onLogin }: {
  loadSiteKey: () => Promise<string>
  onLogin: (password: string, verificationToken: string) => Promise<void>
}) {
  const { locale, t } = useI18n()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [siteKey, setSiteKey] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [challengeVersion, setChallengeVersion] = useState(0)
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    let active = true
    void loadSiteKey()
      .then((key) => { if (active) setSiteKey(key) })
      .catch((caught) => { if (active) setError(localizedError(caught, locale, t('humanVerificationUnavailable'))) })
    return () => { active = false }
  }, [loadSiteKey, locale, t])

  const verificationUnavailable = useCallback(() => {
    setVerificationToken('')
    setError(t('humanVerificationUnavailable'))
  }, [t])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!verificationToken) {
      setError(t('humanVerificationRequired'))
      return
    }
    setError('')
    setSigningIn(true)
    try {
      await onLogin(password, verificationToken)
    } catch (caught) {
      setError(localizedError(caught, locale, t('signInFailed')))
      setVerificationToken('')
      setChallengeVersion((current) => current + 1)
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
        <p className="auth-verification-label">{siteKey ? t('humanVerification') : t('humanVerificationLoading')}</p>
        {siteKey && <TurnstileVerification key={challengeVersion} siteKey={siteKey} onVerified={setVerificationToken} onUnavailable={verificationUnavailable} />}
        <button className="primary-action" type="submit" disabled={signingIn || !verificationToken}>{signingIn ? t('signingIn') : t('signIn')}</button>
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
