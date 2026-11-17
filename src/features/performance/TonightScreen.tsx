import { useState } from 'react'
import { localizedError, useI18n } from '../../app/i18n'
import { UiIcon } from '../../app/UiIcon'
import type { SavedSetList, Score } from '../../domain/types'
import { ReadOnlySetList } from './ReadOnlySetList'
import { DrummerViewToggle } from './DrummerViewToggle'
import { useDrummerView } from './useDrummerView'
import { ProgramSummary } from './ProgramSummary'

interface TonightScreenProps {
  setList: SavedSetList | undefined
  savedSetLists: SavedSetList[]
  libraryScores?: readonly Score[]
  onLoad: (setList: SavedSetList) => Promise<void>
  onClear: () => Promise<void>
  onManage: () => void
}

export function TonightScreen({ setList, savedSetLists, libraryScores, onLoad, onClear, onManage }: TonightScreenProps) {
  const { locale, t } = useI18n()
  const [showDrummerNotes, setShowDrummerNotes] = useDrummerView()
  const [selected, setSelected] = useState('')
  const [choosing, setChoosing] = useState(!setList)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const locked = savedSetLists.filter((saved) => saved.locked)
  const load = async () => {
    const next = locked.find((saved) => saved.id === selected)
    if (!next) return
    setSaving(true)
    setError('')
    try { await onLoad(next); setChoosing(false) }
    catch (caught) { setError(localizedError(caught, locale, t('tonightSaveFailed'))) }
    finally { setSaving(false) }
  }
  return <section className="screen-section tonight-screen" aria-labelledby="tonight-title">
    <div className="eyebrow"><UiIcon name="moon" />{t('performanceMode')}</div>
    <h1 id="tonight-title">{t('tonight')}</h1>
    {setList ? <>
      <div className="tonight-heading"><h2>{setList.name || t('setsTitle')}</h2><span className="locked-badge"><UiIcon name="lock" />{t('locked')}</span></div>
      <div className="tonight-controls">
        <ProgramSummary setCount={setList.performance.sets.length} pieceCount={setList.performance.sets.reduce((total, set) => total + set.scores.length, 0)} />
        <DrummerViewToggle enabled={showDrummerNotes} onChange={setShowDrummerNotes} />
      </div>
      <ReadOnlySetList setList={setList} showDrummerNotes={showDrummerNotes} libraryScores={libraryScores ?? []} />
      <button type="button" className="secondary-action" disabled={saving} aria-expanded={choosing} onClick={() => setChoosing((value) => !value)}>{t('changeTonight')}</button>
    </> : <p className="notice">{t('tonightEmpty')}</p>}
    {choosing && <div className="tonight-picker">
      <p className="field-hint">{t('tonightHelp')}</p>
      {locked.length > 0 ? <>
        <label><span>{t('lockedSetlists')}</span><select value={selected} disabled={saving} onChange={(event) => setSelected(event.target.value)}><option value="">{t('chooseLockedSetlist')}</option>{locked.map((saved) => <option key={saved.id} value={saved.id}>{saved.name || t('setsTitle')}</option>)}</select></label>
        <button type="button" className="primary-action" disabled={saving || !locked.some((saved) => saved.id === selected)} onClick={() => { void load() }}>{saving ? t('saving') : t('loadTonight')}</button>
      </> : <p className="notice">{t('noLockedSetlists')}</p>}
      <button type="button" className="secondary-action" disabled={saving} onClick={onManage}>{t('manageSetlists')}</button>
      {setList && <button type="button" className="text-button" disabled={saving} onClick={() => { setSaving(true); setError(''); void onClear().catch((caught: unknown) => setError(localizedError(caught, locale, t('tonightSaveFailed')))).finally(() => setSaving(false)) }}>{t('clearTonight')}</button>}
    </div>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>
}
