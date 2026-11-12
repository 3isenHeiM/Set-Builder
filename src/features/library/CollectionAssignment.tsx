import { useState } from 'react'
import { DEFAULT_COLLECTION } from '../../domain/collections'
import { localizedError, useI18n } from '../../app/i18n'

export function CollectionAssignment({ count, collections, canRemove, onAssign, onCancel }: {
  count: number
  collections: string[]
  canRemove: boolean
  onAssign: (name: string) => Promise<void>
  onCancel: () => void
}) {
  const { locale, t } = useI18n()
  const [target, setTarget] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const assign = async (name: string) => {
    setSaving(true)
    setError('')
    try { await onAssign(name) } catch (caught) { setError(localizedError(caught, locale, t('saveFailed'))) } finally { setSaving(false) }
  }
  return <form className="bulk-settings collection-assignment" aria-labelledby="collection-assignment-title" onSubmit={(event) => { event.preventDefault(); if (target) void assign(target) }}>
    <h2 id="collection-assignment-title">{t('moveSelected', { count })}</h2>
    <p>{t('moveCollectionHelp')}</p>
    <label className="filter-label"><span>{t('destinationCollection')}</span><select required value={target} disabled={saving} onChange={(event) => setTarget(event.target.value)}><option value="">{t('chooseCollection')}</option>{collections.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="bulk-actions"><button type="submit" className="primary-action" disabled={saving || !target || count === 0}>{saving ? t('saving') : t('movePieces')}</button><button type="button" className="secondary-action" disabled={saving} onClick={onCancel}>{t('cancel')}</button></div>
    {canRemove && <button type="button" className="text-button" disabled={saving || count === 0} onClick={() => void assign(DEFAULT_COLLECTION)}>{t('removeFromCollection')}</button>}
    {canRemove && <p className="field-hint">{t('removeCollectionHelp')}</p>}
  </form>
}
