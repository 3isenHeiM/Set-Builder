import { useId } from 'react'
import { useI18n } from '../../app/i18n'
import { MAX_DRUMMER_NOTES_LENGTH, MIN_TEMPO, MAX_TEMPO, PICKUP_BEATS, TEMPO_BEATS, TIME_SIGNATURES, formatBeats } from '../../domain/drummerNotes'
import type { DrummerTiming, TempoBeat, TimeSignature } from '../../domain/types'
import { MusicTiming } from '../performance/MusicTiming'
import { useBeatLabels } from '../performance/useBeatLabels'

const tempos = Array.from({ length: MAX_TEMPO - MIN_TEMPO + 1 }, (_, index) => MIN_TEMPO + index)

export function DrummerNotesEditor({ timing, text, legacyText, onTimingChange, onTextChange, onTextBlur }: {
  timing: DrummerTiming
  text: string
  legacyText: string
  onTimingChange: (timing: DrummerTiming) => void
  onTextChange: (text: string) => void
  onTextBlur: () => void
}) {
  const { t } = useI18n()
  const labels = useBeatLabels()
  const hintId = useId()
  return <fieldset className="drummer-editor">
    <legend>{t('drummerNotes')}</legend>
    <div className="drummer-fields">
      <label><span>{t('tempoBpm')}</span><select value={timing.bpm ?? ''} onChange={(event) => onTimingChange({ ...timing, bpm: event.target.value ? Number(event.target.value) : null })}><option value="">{t('timingNotSet')}</option>{tempos.map((bpm) => <option key={bpm} value={bpm}>{bpm}</option>)}</select></label>
      <label><span>{t('tempoBeat')}</span><select value={timing.beat} onChange={(event) => onTimingChange({ ...timing, beat: event.target.value as TempoBeat })}>{TEMPO_BEATS.map((beat) => <option key={beat} value={beat}>{labels[beat]}</option>)}</select></label>
      <label><span>{t('measure')}</span><select value={timing.measure ?? ''} onChange={(event) => onTimingChange({ ...timing, measure: (event.target.value || null) as TimeSignature | null })}><option value="">{t('timingNotSet')}</option>{TIME_SIGNATURES.map((measure) => <option key={measure} value={measure}>{measure}</option>)}</select></label>
      <label><span>{t('anacrusis')} <small>{t('optional')}</small></span><select value={timing.anacrusis ?? ''} onChange={(event) => onTimingChange({ ...timing, anacrusis: event.target.value ? Number(event.target.value) : null })}><option value="">{t('noAnacrusis')}</option>{PICKUP_BEATS.map((beats) => <option key={beats} value={beats}>{t(beats === 1 ? 'pickupOne' : 'pickupCount', { count: formatBeats(beats) })}</option>)}</select></label>
    </div>
    <MusicTiming timing={timing} />
    <label className="notes-field"><span><strong>{t('customDrummerNote')}</strong><small>{t('optional')}</small></span>
      <textarea rows={2} maxLength={MAX_DRUMMER_NOTES_LENGTH} aria-describedby={hintId} value={text} placeholder={t('drummerNotesPlaceholder')} onChange={(event) => onTextChange(event.target.value)} onBlur={onTextBlur} />
    </label>
    <div className="notes-caption" id={hintId}><span>{legacyText.length > MAX_DRUMMER_NOTES_LENGTH && text === legacyText ? t('legacyDrummerNote') : t('customNoteHelp')}</span><span>{text.length}/{MAX_DRUMMER_NOTES_LENGTH}</span></div>
  </fieldset>
}
