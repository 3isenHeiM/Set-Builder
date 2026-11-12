import { useState } from 'react'
import { useI18n, localizedError } from '../../app/i18n'

export function CollectionRename({ name, onRename }: { name: string; onRename: (name: string) => Promise<void> }) {
  const { locale, t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  if (!editing) return <button type="button" className="text-button" onClick={() => { setDraft(name); setEditing(true); setError('') }}>{t('renameCollection')}</button>
  return <form className="collection-import" onSubmit={(event) => { event.preventDefault(); setSaving(true); setError(''); void onRename(draft.trim()).then(() => setEditing(false)).catch((caught: unknown) => setError(localizedError(caught, locale, t('saveFailed')))).finally(() => setSaving(false)) }}>
    <label><span>{t('collectionName')}</span><input type="text" required maxLength={120} value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="action-row"><button type="submit" className="primary-action" disabled={saving || !draft.trim()}>{saving ? t('saving') : t('saveCollection')}</button><button type="button" className="secondary-action" disabled={saving} onClick={() => setEditing(false)}>{t('cancel')}</button></div>
  </form>
}
