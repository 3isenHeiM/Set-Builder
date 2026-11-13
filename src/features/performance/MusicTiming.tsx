import { useI18n } from '../../app/i18n'
import { formatBeats } from '../../domain/drummerNotes'
import { useBeatLabels } from './useBeatLabels'
import type { DrummerTiming, TempoBeat } from '../../domain/types'

export function BeatSymbol({ beat }: { beat: TempoBeat }) {
  const hollow = beat === 'half' || beat === 'dotted-half'
  const flagged = beat === 'eighth' || beat === 'dotted-eighth'
  return <svg className="beat-symbol" viewBox="0 0 37 42" aria-hidden="true" focusable="false">
    <ellipse cx="12" cy="32" rx="7" ry="4.7" transform="rotate(-22 12 32)" fill={hollow ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth="1.8" />
    <path d="M18 30V4" fill="none" stroke="currentColor" strokeWidth="2" />
    {flagged && <path d="M18 4C19 13 32 12 26 25C27 17 18 18 18 14Z" fill="currentColor" />}
    {beat.startsWith('dotted-') && <circle cx="30" cy="31" r="2.2" fill="currentColor" />}
  </svg>
}

export function MusicTiming({ timing }: { timing: DrummerTiming }) {
  const { t } = useI18n()
  const labels = useBeatLabels()
  const [top, bottom] = timing.measure?.split('/') ?? []
  if (timing.bpm === null && timing.measure === null && timing.anacrusis === null) return null
  return <span className="music-timing">
    {timing.bpm !== null && <span className="tempo-mark" role="img" aria-label={t('tempoNotation', { bpm: timing.bpm, beat: labels[timing.beat] })}><BeatSymbol beat={timing.beat} /><span aria-hidden="true">= {timing.bpm}</span></span>}
    {timing.measure !== null && <span className="time-signature" role="img" aria-label={t('measureNotation', { measure: timing.measure })}><span aria-hidden="true">{top}</span><span aria-hidden="true">{bottom}</span></span>}
    {timing.anacrusis !== null && <span className="pickup-mark">{t('pickup')} <b>{t(timing.anacrusis === 1 ? 'pickupOne' : 'pickupCount', { count: formatBeats(timing.anacrusis) })}</b></span>}
  </span>
}
