import { useState } from 'react'
import type { BulkConfiguration, Hotness } from '../../domain/types'
import { localizedError, useI18n } from '../../app/i18n'

export function BulkSettings({ count, onApply, onCancel }: { count: number; onApply: (changes: BulkConfiguration) => Promise<void>; onCancel: () => void }) {
  const { locale, t } = useI18n()
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fields = [
    ['canStart', t('canStartSet')], ['hotness', t('hotness')], ['drumsIntro', t('drumsIntro')],
    ['goesHigh', t('goesHigh')], ['enabled', t('enabled')],
  ] as const
  const apply = async () => {
    const changes: BulkConfiguration = {}
    for (const [key] of fields) {
      const value = values[key]
      if (!value) continue
      if (key === 'hotness') changes.hotness = Number(value) as Hotness
      else changes[key] = value === 'true'
    }
    setSaving(true)
    setError('')
    try { await onApply(changes) } catch (caught) { setError(localizedError(caught, locale, t('saveFailed'))) } finally { setSaving(false) }
  }
  return <section className="bulk-settings" aria-labelledby="bulk-settings-title">
    <h2 id="bulk-settings-title">{t('editSelected', { count })}</h2>
    <p>{t('leaveUnchangedHelp')}</p>
    <div className="bulk-fields">{fields.map(([key, label]) => <label key={key}><span>{label}</span><select value={values[key] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}><option value="">{t('leaveUnchanged')}</option>{key === 'hotness' ? <><option value="1">{t('low')}</option><option value="2">{t('medium')}</option><option value="3">{t('high')}</option></> : <><option value="true">{t('yes')}</option><option value="false">{t('no')}</option></>}</select></label>)}</div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="bulk-actions"><button type="button" className="primary-action" disabled={saving || count === 0 || !Object.values(values).some(Boolean)} onClick={() => void apply()}>{saving ? t('saving') : t('applyToSelected')}</button><button type="button" className="secondary-action" disabled={saving} onClick={onCancel}>{t('cancel')}</button></div>
  </section>
}
