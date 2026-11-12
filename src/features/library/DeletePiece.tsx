import { useEffect, useRef, useState } from 'react'
import { localizedError, useI18n } from '../../app/i18n'

export function DeletePiece({ title, onDelete }: { title: string; onDelete: () => Promise<void> }) {
  const { locale, t } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const cancel = useRef<HTMLButtonElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (confirming) cancel.current?.focus() }, [confirming])
  const remove = async () => {
    setDeleting(true)
    setError('')
    try { await onDelete() } catch (caught) { setError(localizedError(caught, locale, t('deleteFailed'))); setDeleting(false) }
  }
  return <div className="delete-piece">
    <button ref={trigger} type="button" className="text-button danger-text" aria-expanded={confirming} disabled={deleting} onClick={() => { setConfirming(true); setError('') }}>{t('deletePiece')}</button>
    {confirming && <section className="delete-confirmation" aria-label={t('deletePiece')}>
      <p><strong>{t('deletePieceNamed', { title })}</strong></p>
      <p>{t('deletePieceHelp')}</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="bulk-actions"><button ref={cancel} type="button" className="secondary-action" disabled={deleting} onClick={() => { setConfirming(false); trigger.current?.focus() }}>{t('cancel')}</button><button type="button" className="secondary-action danger-action" disabled={deleting} onClick={() => void remove()}>{deleting ? t('deleting') : t('deletePermanently')}</button></div>
    </section>}
  </div>
}
