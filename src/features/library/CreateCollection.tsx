import { useState } from 'react'
import { UiIcon } from '../../app/UiIcon'
import { localizedError, useI18n } from '../../app/i18n'

export function CreateCollection({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  if (!open) return <button type="button" className="secondary-action icon-text" onClick={() => { setOpen(true); setError('') }}><UiIcon name="plus" />{t('newCollection')}</button>
  return <form className="collection-create" onSubmit={(event) => {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    void onCreate(name.trim()).then(() => { setOpen(false); setName('') }).catch((caught: unknown) => setError(localizedError(caught, locale, t('saveFailed')))).finally(() => setSaving(false))
  }}>
    <label className="filter-label"><span>{t('collectionName')}</span><input type="text" required maxLength={120} value={name} disabled={saving} onChange={(event) => setName(event.target.value)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="bulk-actions"><button type="submit" className="primary-action" disabled={saving || !name.trim()}>{saving ? t('saving') : t('createCollection')}</button><button type="button" className="secondary-action" disabled={saving} onClick={() => setOpen(false)}>{t('cancel')}</button></div>
  </form>
}
