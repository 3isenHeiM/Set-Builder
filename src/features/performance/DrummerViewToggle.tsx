import { useId } from 'react'
import { UiIcon } from '../../app/UiIcon'
import { useI18n } from '../../app/i18n'

export function DrummerViewToggle({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  const { t } = useI18n()
  const helpId = useId()
  return <div className="shared-view-controls">
    <label className="toggle-row shared-drummer-toggle">
      <span className="toggle-copy"><strong><UiIcon name="drum" />{t('drummerNotes')}</strong><small id={helpId}>{t('sharedDrummerNotesHelp')}</small></span>
      <input type="checkbox" role="switch" aria-label={t('drummerNotes')} aria-describedby={helpId} checked={enabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch-control" aria-hidden="true"><span /></span>
    </label>
  </div>
}
