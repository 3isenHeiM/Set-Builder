import { useI18n } from '../../app/i18n'

export function ProgramSummary({ setCount, pieceCount }: { setCount: number | null; pieceCount: number | null }) {
  const { t } = useI18n()
  return <p className="program-summary" role="status" aria-label={t('programSummary')} aria-live="polite" aria-atomic="true">
    <span><strong>{setCount ?? '—'}</strong> {t(setCount === 1 ? 'summarySet' : 'summarySets')}</span>{' '}
    <span aria-hidden="true">·</span>{' '}
    <span><strong>{pieceCount ?? '—'}</strong> {t(pieceCount === 1 ? 'piece' : 'pieces')}</span>
  </p>
}
