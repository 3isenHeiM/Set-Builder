import { useRef, useState } from 'react'
import { sharing, type SharingClient } from '../../data/sharing'
import { localizedError, useI18n } from '../../app/i18n'

export function ShareSetList({ id, client = sharing }: { id: string; client?: SharingClient }) {
  const { locale, t } = useI18n()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const url = token ? `${window.location.origin}/share/${token}` : ''
  const change = async (stop = false) => {
    setBusy(true); setError(''); setMessage('')
    try {
      if (stop) { await client.revoke(id); setToken(''); setMessage(t('sharingStopped')) }
      else { setToken(await client.create(id)); setMessage(t('shareLinkReady')) }
    } catch (caught) { setError(localizedError(caught, locale, t('sharingUnavailable'))) } finally { setBusy(false) }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setMessage(t('linkCopied')) } catch { input.current?.focus(); input.current?.select(); setMessage(t('copyLinkManually')) }
  }
  return <section className="share-panel" aria-label={t('shareSetList')}>
    <p className="secondary">{t('shareHelp')}</p>
    {!token ? <button type="button" className="secondary-action" disabled={busy} onClick={() => void change()}>{busy ? t('saving') : t('shareSetList')}</button> : <>
      <label className="filter-label"><span>{t('sharedLink')}</span><input ref={input} type="url" readOnly value={url} onFocus={(event) => event.target.select()} /></label>
      <div className="bulk-actions"><button type="button" className="secondary-action" onClick={() => void copy()}>{t('copyLink')}</button><button type="button" className="text-button danger-text" disabled={busy} onClick={() => void change(true)}>{t('stopSharing')}</button></div>
    </>}
    {message && <p className="success" role="status">{message}</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>
}
