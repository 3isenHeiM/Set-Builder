import { useEffect, useId, useState } from 'react'
import { sharing, type SharingClient } from '../../data/sharing'
import type { SharedSetList } from '../../domain/sharedSetList'
import { UiIcon } from '../../app/UiIcon'
import { localizedKnownMessage, useI18n } from '../../app/i18n'
import { DrummerNotes } from './DrummerNotes'
import { pieceOccurrenceCounts, sharedSetKeys } from '../../domain/performanceEntries'
import { RepeatWarning } from './RepeatWarning'
import { SetCard } from './SetCard'
import { readDrummerNotesPreference, saveDrummerNotesPreference } from './sharedViewPreference'

export function SharedSetListScreen({ token, client = sharing }: { token: string; client?: SharingClient }) {
  const { locale, t } = useI18n()
  const [showDrummerNotes, setShowDrummerNotes] = useState(readDrummerNotesPreference)
  const drummerHelpId = useId()
  const [saved, setSaved] = useState<SharedSetList>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setFailed(false)
    setSaved(undefined)
    let pending = false
    const refresh = () => {
      if (pending || document.hidden) return
      pending = true
      void client.read(token, controller.signal).then((value) => { if (!controller.signal.aborted) { setSaved(value); setFailed(false) } }).catch(() => { if (!controller.signal.aborted) { setFailed(true); setSaved(undefined) } }).finally(() => { pending = false })
    }
    refresh()
    const timer = setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [token, client, attempt])
  const pieces = saved?.sets.flatMap((set) => set.scores) ?? []
  const occurrences = pieceOccurrenceCounts(pieces)
  const setKeys = sharedSetKeys(saved?.sets ?? [])
  return <div className="app-shell shared-view">
    <header className="app-header"><span className="app-logo" aria-hidden="true"><UiIcon name="music" /></span><strong>Piece Selector</strong><span className="local-badge">{t('readOnly')}</span></header>
    <main id="main-content" className="screen-section">
      {failed ? <><h1>{t('sharedUnavailable')}</h1><p className="notice">{t('sharedUnavailableHelp')}</p><button type="button" className="secondary-action" onClick={() => setAttempt((value) => value + 1)}>{t('tryAgain')}</button></> : saved ? <>
        <h1 className="shared-title">{saved.name || t('setsTitle')}</h1>
        <p className="secondary">{t('sharedUpdated')} <time dateTime={saved.updatedAt}>{new Date(saved.updatedAt).toLocaleString(locale)}</time></p>
        {saved.generatedAt && <p className="secondary"><time dateTime={saved.generatedAt}>{new Date(saved.generatedAt).toLocaleString(locale)}</time></p>}
        <div className="shared-view-controls">
          <label className="toggle-row shared-drummer-toggle">
            <span className="toggle-copy"><strong><UiIcon name="drum" />{t('drummerNotes')}</strong><small id={drummerHelpId}>{t('sharedDrummerNotesHelp')}</small></span>
            <input type="checkbox" role="switch" aria-label={t('drummerNotes')} aria-describedby={drummerHelpId} checked={showDrummerNotes} onChange={(event) => { setShowDrummerNotes(event.target.checked); saveDrummerNotesPreference(event.target.checked) }} />
            <span className="switch-control" aria-hidden="true"><span /></span>
          </label>
        </div>
        {saved.warnings?.map((warning) => <p className="notice" role="status" key={warning}>{localizedKnownMessage(warning, locale) ?? warning}</p>)}
        {pieces.some((piece) => occurrences(piece) > 1) && <p className="repeat-hint">{t('repeatedPieceHelp')}</p>}
        {saved.sets.map((set, index) => <SetCard key={setKeys[index]} number={index + 1} title={set.name} count={set.scores.length}>
          <ol>{set.scores.map((piece, position) => <li key={position}><span className="position">{position + 1}</span><span className="score-number">{piece.displayNumber}</span><span className="score-copy"><span className="piece-title"><strong>{piece.title}</strong>{occurrences(piece) > 1 && <RepeatWarning title={piece.title} />}</span><small>{piece.collection}</small>{(piece.goesHigh || piece.drumsIntro || position === 0) && <small>{[piece.goesHigh && t('highPiece'), piece.drumsIntro && t('drums'), position === 0 && t('start')].filter(Boolean).join(' · ')}</small>}{showDrummerNotes && <DrummerNotes value={piece.drummerNotes} timing={piece.drummerTiming} />}</span></li>)}</ol>
        </SetCard>)}
        <button type="button" className="secondary-action" onClick={() => setAttempt((value) => value + 1)}>{t('refreshSetList')}</button>
      </> : <p role="status">{t('loadingShared')}</p>}
    </main>
  </div>
}
