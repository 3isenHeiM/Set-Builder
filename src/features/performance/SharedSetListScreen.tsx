import { useEffect, useState } from 'react'
import { sharing, type SharingClient } from '../../data/sharing'
import type { SharedSetList } from '../../domain/sharedSetList'
import { UiIcon } from '../../app/UiIcon'
import { localizedKnownMessage, useI18n } from '../../app/i18n'
import { DrummerNotes } from './DrummerNotes'

export function SharedSetListScreen({ token, client = sharing }: { token: string; client?: SharingClient }) {
  const { locale, t } = useI18n()
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
  return <div className="app-shell shared-view">
    <header className="app-header"><span className="app-logo" aria-hidden="true"><UiIcon name="music" /></span><strong>Piece Selector</strong><span className="local-badge">{t('readOnly')}</span></header>
    <main id="main-content" className="screen-section">
      {failed ? <><h1>{t('sharedUnavailable')}</h1><p className="notice">{t('sharedUnavailableHelp')}</p><button type="button" className="secondary-action" onClick={() => setAttempt((value) => value + 1)}>{t('tryAgain')}</button></> : saved ? <>
        <h1 className="shared-title">{saved.name || t('setsTitle')}</h1>
        <p className="secondary">{t('sharedUpdated')} <time dateTime={saved.updatedAt}>{new Date(saved.updatedAt).toLocaleString(locale)}</time></p>
        {saved.generatedAt && <p className="secondary"><time dateTime={saved.generatedAt}>{new Date(saved.generatedAt).toLocaleString(locale)}</time></p>}
        {saved.warnings?.map((warning) => <p className="notice" role="status" key={warning}>{localizedKnownMessage(warning, locale) ?? warning}</p>)}
        {saved.sets.map((set, index) => <section className="set-card" key={index} aria-label={set.name || `${t('set')} ${index + 1}`}>
          <div className="set-card-header"><div><span>{t('set')} {index + 1}</span><h2>{set.name || `${t('set')} ${index + 1}`}</h2></div><span className="shared-set-size">{set.scores.length} {t(set.scores.length === 1 ? 'piece' : 'pieces')}</span></div>
          <ol>{set.scores.map((piece, position) => <li key={position}><span className="position">{position + 1}</span><span className="score-number">{piece.displayNumber}</span><span className="score-copy"><strong>{piece.title}</strong><small>{piece.collection}</small><small>{piece.hotness === undefined ? '' : `${t('hotnessShort')}${piece.hotness}`}{piece.goesHigh ? ` · ${t('highPiece')}` : ''}{piece.drumsIntro ? ` · ${t('drums')}` : ''}{position === 0 ? ` · ${t('start')}` : ''}</small><DrummerNotes value={piece.drummerNotes} /></span></li>)}</ol>
        </section>)}
        <button type="button" className="secondary-action" onClick={() => setAttempt((value) => value + 1)}>{t('refreshSetList')}</button>
      </> : <p role="status">{t('loadingShared')}</p>}
    </main>
  </div>
}
