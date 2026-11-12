import { useI18n } from '../../app/i18n'

export function RepeatWarning({ title }: { title: string }) {
  const { t } = useI18n()
  const label = t('repeatedPiece', { title })
  return <span className="repeat-warning" role="img" aria-label={label} title={label}>(!)</span>
}
