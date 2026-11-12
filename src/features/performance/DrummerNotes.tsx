import { UiIcon } from '../../app/UiIcon'
import { useI18n } from '../../app/i18n'

export function DrummerNotes({ value }: { value?: string | undefined }) {
  const { t } = useI18n()
  if (!value?.trim()) return null
  return <span className="drummer-notes" role="note" aria-label={t('drummerNotes')}><UiIcon name="drum" /><span>{value}</span></span>
}
