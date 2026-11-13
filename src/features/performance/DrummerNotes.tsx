import { UiIcon } from '../../app/UiIcon'
import { useI18n } from '../../app/i18n'
import type { DrummerTiming } from '../../domain/types'
import { MusicTiming } from './MusicTiming'

export function DrummerNotes({ value, timing }: { value?: string | undefined; timing?: DrummerTiming | undefined }) {
  const { t } = useI18n()
  if (!value?.trim() && (!timing || (timing.bpm === null && timing.measure === null && timing.anacrusis === null))) return null
  return <span className="drummer-notes" role="note" aria-label={t('drummerNotes')}><UiIcon name="drum" /><span className="drummer-notes-content">{timing && <MusicTiming timing={timing} />}{value?.trim() && <span className="drummer-custom-text">{value}</span>}</span></span>
}
