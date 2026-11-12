import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { addNewSet, addPiece, addSavedSetToProgram, assertSavedPerformanceValid, canAddPiece, canAddSavedSet, canMoveBetweenSets, canMovePiece, linkSavedSet, moveBetweenSets, movePiece, moveSet, removePiece, removeSetFromProgram, renameSet, renameSetList } from '../../domain/setList'
import { createSetListBackup, parseSetListBackupJson, setListBackupToJson, type SetListBackup } from '../../domain/setListBackup'
import { MAX_SETS } from '../../domain/generator'
import type { PerformanceSet, SavedSet, SavedSetList, Score } from '../../domain/types'
import { UiIcon } from '../../app/UiIcon'
import { localizedError, localizedKnownMessage, useI18n } from '../../app/i18n'
import { ShareSetList } from './ShareSetList'
import { DrummerNotes } from './DrummerNotes'

interface PerformanceScreenProps {
  scores: Score[]
  setList: SavedSetList | undefined
  savedSetLists: SavedSetList[]
  savedSets: SavedSet[]
  onSave: (setList: SavedSetList) => Promise<void>
  onSaveSavedSet: (set: PerformanceSet) => Promise<SavedSet>
  onCreateProgram: (savedSet: SavedSet) => Promise<void>
  onCreateManualProgram?: (starter: Score) => Promise<void>
  onSelect: (id: string) => Promise<void>
  onImport: (backup: SetListBackup) => Promise<void>
  onRegenerate: () => void
}

function downloadName(exportedAt: string): string {
  return `piece-selector-program-${exportedAt.slice(0, 10)}.json`
}

export function PerformanceScreen({ scores, setList, savedSetLists, savedSets, onSave, onSaveSavedSet, onCreateProgram, onCreateManualProgram, onSelect, onImport, onRegenerate }: PerformanceScreenProps) {
  const { locale, t } = useI18n()
  const fileInput = useRef<HTMLInputElement>(null)
  const [listName, setListName] = useState(setList?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [pieceSelections, setPieceSelections] = useState<Record<number, string>>({})
  const [setNames, setSetNames] = useState<Record<string, string>>({})
  const [savedSetSelection, setSavedSetSelection] = useState('')
  const [starterSelection, setStarterSelection] = useState('')

  useEffect(() => {
    setListName(setList?.name ?? '')
    setSetNames({})
  }, [setList?.id, setList?.name])

  const save = async (next: SavedSetList) => {
    setSaving(true)
    setStatus('')
    setError('')
    try {
      await onSave(next)
      setStatus(t('saved'))
    } catch (caught) {
      setError(localizedError(caught, locale, t('setListSaveFailed')))
    } finally {
      setSaving(false)
    }
  }

  const saveSetName = (next: SavedSetList) => {
    setError('')
    void onSave(next)
      .then(() => setStatus(t('saved')))
      .catch((caught: unknown) => setError(localizedError(caught, locale, t('setListSaveFailed'))))
  }

  const select = async (id: string) => {
    setStatus('')
    setError('')
    try {
      await onSelect(id)
    } catch (caught) {
      setError(localizedError(caught, locale, t('setListOpenFailed')))
    }
  }

  const saveReusableSet = async (setIndex: number) => {
    const set = setList?.performance.sets[setIndex]
    if (!set || !setList) return
    setSaving(true)
    setStatus('')
    setError('')
    try {
      const nameKey = set.scores[0]?.id ?? String(set.number)
      const name = setNames[nameKey] ?? set.name
      const savedSet = await onSaveSavedSet({ ...set, ...(name === undefined ? {} : { name }) })
      await onSave(linkSavedSet(setList, setIndex, savedSet, savedSet.updatedAt))
      setStatus(t('setSaved'))
    } catch (caught) {
      setError(localizedError(caught, locale, t('setSaveFailed')))
    } finally {
      setSaving(false)
    }
  }

  const startProgram = async () => {
    const savedSet = savedSets.find((candidate) => candidate.id === savedSetSelection)
    if (!savedSet) return
    setSaving(true)
    setStatus('')
    setError('')
    try {
      await onCreateProgram(savedSet)
      setStatus(t('programSaved'))
    } catch (caught) {
      setError(localizedError(caught, locale, t('programSaveFailed')))
    } finally {
      setSaving(false)
    }
  }

  const download = () => {
    if (!setList) return
    const exportedAt = new Date().toISOString()
    const namedSetList = { ...setList, name: setList.name || t('setsTitle') }
    const url = URL.createObjectURL(new Blob([setListBackupToJson(createSetListBackup(namedSetList, exportedAt))], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = downloadName(exportedAt)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setError('')
    setStatus(t('setListExported'))
  }

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    setError('')
    setStatus('')
    if (!file.name.toLocaleLowerCase().endsWith('.json')) {
      setError(t('chooseSetListFile'))
      return
    }
    try {
      // This explicitly selected JSON contains a score snapshot only; MuseScore files are never read.
      await onImport(parseSetListBackupJson(await file.text()))
      setStatus(t('setListImported'))
    } catch (caught) {
      setError(localizedError(caught, locale, t('setListImportFailed')))
    }
  }

  const allSetLists = setList && !savedSetLists.some((saved) => saved.id === setList.id) ? [setList, ...savedSetLists] : savedSetLists
  const selectedSavedSet = savedSets.find((saved) => saved.id === savedSetSelection)
  const starters = scores.filter((score) => score.availability === 'active' && score.enabled && score.configuration === 'complete' && score.canStart === true && score.hotness !== null && score.drumsIntro !== null && score.goesHigh !== null && (!setList || canAddPiece(setList, score)))
  const allStarters = scores.filter((score) => score.availability === 'active' && score.enabled && score.configuration === 'complete' && score.canStart === true && score.hotness !== null && score.drumsIntro !== null && score.goesHigh !== null)
  const manualBuilder = <div className="manual-builder"><label><span>{t('chooseStarter')}</span><select value={starterSelection} onChange={(event) => setStarterSelection(event.target.value)}><option value="">{t('chooseStarter')}</option>{allStarters.map((score) => <option value={score.id} key={score.id}>{score.collection || 'General'} · {score.displayNumber} · {score.title}</option>)}</select></label><div className="manual-actions">{setList && <button type="button" className="secondary-action" disabled={saving || setList.performance.sets.length >= MAX_SETS || !starters.some((score) => score.id === starterSelection)} onClick={() => { const starter = starters.find((score) => score.id === starterSelection); if (starter) void save(addNewSet(setList, starter, new Date().toISOString())); setStarterSelection('') }}>{t('addNewSet')}</button>}<button type="button" className="secondary-action" disabled={saving || !starterSelection} onClick={() => { const starter = allStarters.find((score) => score.id === starterSelection); if (!starter || !onCreateManualProgram) return; setSaving(true); void onCreateManualProgram(starter).catch((caught: unknown) => setError(localizedError(caught, locale, t('programSaveFailed')))).finally(() => setSaving(false)); setStarterSelection('') }}>{t('createFromScratch')}</button></div></div>
  const composer = (
    <div className="program-composer">
      <div><h2>{t('buildProgram')}</h2><p>{t('combineSavedSets')}</p></div>
      <label><span>{t('savedSets')}</span><select value={savedSetSelection} disabled={saving || savedSets.length === 0} onChange={(event) => setSavedSetSelection(event.target.value)}><option value="">{savedSets.length === 0 ? t('noSavedSets') : t('chooseSavedSet')}</option>{savedSets.map((saved) => <option value={saved.id} key={saved.id}>{saved.name} · {saved.scores.length} {t(saved.scores.length === 1 ? 'piece' : 'pieces')}</option>)}</select></label>
      <div className="program-composer-actions">
        {setList && <button type="button" className="primary-action" disabled={saving || !selectedSavedSet || !canAddSavedSet(setList.performance, selectedSavedSet)} onClick={() => { if (selectedSavedSet) { void save(addSavedSetToProgram(setList, selectedSavedSet, new Date().toISOString())); setSavedSetSelection('') } }}><UiIcon name="plus" />{t('addToProgram')}</button>}
        <button type="button" className="secondary-action" disabled={saving || !selectedSavedSet} onClick={() => { void startProgram() }}>{t('startNewProgram')}</button>
      </div>
    </div>
  )

  if (!setList) return (
    <section className="empty-state compact">
      <div className="hero-mark" aria-hidden="true"><UiIcon name="sets" /></div>
      <h1>{t('programs')}</h1>
      {manualBuilder}
      {composer}
      <button className="primary-action" type="button" onClick={onRegenerate}>{t('buildSets')}</button>
      <button className="secondary-action" type="button" onClick={() => fileInput.current?.click()}>{t('importSetList')}</button>
      <input ref={fileInput} className="hidden-input" type="file" accept=".json,application/json" onChange={(event) => { void selectFile(event) }} />
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
  if (import.meta.env.DEV) assertSavedPerformanceValid(setList.performance)
  const availableScores = scores.filter((score) => canAddPiece(setList, score))

  return (
    <section className="screen-section performance" aria-labelledby="performance-title">
      <div className="eyebrow">{t('program')} · {setList.performance.preset === '80s' ? '80s' : t('mix')}</div>
      <h1 id="performance-title">{setList.name || t('setsTitle')}</h1>

      <label className="saved-list-picker"><span>{t('savedPrograms')}</span><select value={setList.id} onChange={(event) => { void select(event.target.value) }}>{allSetLists.map((saved) => <option value={saved.id} key={saved.id}>{saved.name || t('setsTitle')} · {new Date(saved.createdAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</option>)}</select></label>
      <label className="set-list-name"><span>{t('programName')}</span><input type="text" value={listName} maxLength={120} placeholder={t('setsTitle')} onChange={(event) => setListName(event.target.value)} onBlur={() => { if (listName.trim() !== setList.name) saveSetName(renameSetList(setList, listName, new Date().toISOString())) }} /></label>
      {composer}
      {manualBuilder}

      <p className="alignment-stamp"><time dateTime={setList.performance.generatedAt}>{new Date(setList.performance.generatedAt).toLocaleString(locale)}</time></p>
      {setList.performance.warnings.map((warning) => <p className="notice" role="status" key={warning}>{localizedKnownMessage(warning, locale) ?? warning}</p>)}
      <div className="set-list">
        {setList.performance.sets.map((set, setIndex) => (
          <section className="set-card" key={`${setList.id}-${set.scores[0]?.id ?? set.number}`} aria-labelledby={`set-${set.number}`}>
            <div className="set-card-header">
              <div><span>{t('set')} {set.number}</span><label><span className="sr-only">{t('setName', { number: set.number })}</span><input id={`set-${set.number}`} type="text" value={setNames[set.scores[0]?.id ?? String(set.number)] ?? set.name ?? ''} maxLength={120} placeholder={`${t('set')} ${set.number}`} onChange={(event) => { const key = set.scores[0]?.id ?? String(set.number); setSetNames((current) => ({ ...current, [key]: event.target.value })) }} onBlur={(event) => { if (event.currentTarget.value.trim() !== (set.name ?? '')) saveSetName(renameSet(setList, setIndex, event.currentTarget.value, new Date().toISOString())) }} /></label></div>
              <div className="order-controls">
                <button type="button" aria-label={t('moveSetUp', { number: set.number })} disabled={saving || setIndex === 0} onClick={() => { void save(moveSet(setList, setIndex, setIndex - 1, new Date().toISOString())) }}><UiIcon name="up" /></button>
                <button type="button" aria-label={t('moveSetDown', { number: set.number })} disabled={saving || setIndex === setList.performance.sets.length - 1} onClick={() => { void save(moveSet(setList, setIndex, setIndex + 1, new Date().toISOString())) }}><UiIcon name="down" /></button>
                <button type="button" aria-label={t('removeSet', { number: set.number })} disabled={saving || setList.performance.sets.length <= 1} onClick={() => { void save(removeSetFromProgram(setList, setIndex, new Date().toISOString())) }}><UiIcon name="close" /></button>
              </div>
            </div>
            <div className="set-card-toolbar"><span>{set.scores.length} {t(set.scores.length === 1 ? 'piece' : 'pieces')}</span><button type="button" disabled={saving} onClick={() => { void saveReusableSet(setIndex) }}>{set.savedSetId && savedSets.some((saved) => saved.id === set.savedSetId) ? t('updateSavedSet') : t('saveThisSet')}</button></div>
            <ol>
              {set.scores.map((score, scoreIndex) => <li key={score.id}><span className="position">{scoreIndex + 1}</span><span className="score-number">{score.displayNumber}</span><span className="score-copy"><strong>{score.title}</strong><small>{score.collection || 'General'}</small><small>{t('hotnessShort')}{score.hotness}{score.goesHigh ? ` · ${t('highPiece')}` : ''}{score.drumsIntro ? ` · ${t('drums')}` : ''}{scoreIndex === 0 ? ` · ${t('start')}` : ''}</small><DrummerNotes value={score.drummerNotes} />{setList.performance.sets.some((_, target) => canMoveBetweenSets(setList, setIndex, scoreIndex, target)) && <select aria-label={t('movePieceToSet', { title: score.title })} value="" disabled={saving} onChange={(event) => { if (event.target.value !== '') void save(moveBetweenSets(setList, setIndex, scoreIndex, Number(event.target.value), new Date().toISOString())) }}><option value="">{t('moveToSet')}</option>{setList.performance.sets.map((target, targetIndex) => canMoveBetweenSets(setList, setIndex, scoreIndex, targetIndex) && <option key={target.number} value={targetIndex}>{target.name || `${t('set')} ${target.number}`}</option>)}</select>}</span><span className="piece-order-controls">{scoreIndex > 0 && <><button type="button" aria-label={t('movePieceUp', { title: score.title })} disabled={saving || !canMovePiece(set, scoreIndex, scoreIndex - 1)} onClick={() => { void save(movePiece(setList, setIndex, scoreIndex, scoreIndex - 1, new Date().toISOString())) }}><UiIcon name="up" /></button><button type="button" aria-label={t('movePieceDown', { title: score.title })} disabled={saving || !canMovePiece(set, scoreIndex, scoreIndex + 1)} onClick={() => { void save(movePiece(setList, setIndex, scoreIndex, scoreIndex + 1, new Date().toISOString())) }}><UiIcon name="down" /></button></>}<button type="button" aria-label={t('removePiece', { title: score.title, number: set.number })} disabled={saving || removePiece(setList, setIndex, scoreIndex, '') === setList} onClick={() => { void save(removePiece(setList, setIndex, scoreIndex, new Date().toISOString())) }}><UiIcon name="minus" /></button></span></li>)}
            </ol>
            <div className="set-piece-editor">
              <label><span>{t('addPiece')}</span><select value={pieceSelections[set.number] ?? ''} disabled={saving || availableScores.length === 0} onChange={(event) => setPieceSelections((current) => ({ ...current, [set.number]: event.target.value }))}><option value="">{availableScores.length === 0 ? t('noAvailablePieces') : t('choosePiece')}</option>{availableScores.map((score) => <option key={score.id} value={score.id}>{score.collection || 'General'} · {score.displayNumber} · {score.title}</option>)}</select></label>
              <button type="button" className="set-add-button" aria-label={t('addPieceToSet', { number: set.number })} disabled={saving || !(pieceSelections[set.number] ?? '')} onClick={() => { const score = scores.find((candidate) => candidate.id === pieceSelections[set.number]); if (score) { void save(addPiece(setList, setIndex, score, new Date().toISOString())); setPieceSelections((current) => ({ ...current, [set.number]: '' })) } }}><UiIcon name="plus" />{t('add')}</button>
            </div>
          </section>
        ))}
      </div>

      <ShareSetList key={setList.id} id={setList.id} />
      <div className="set-list-actions">
        <button type="button" className="primary-action" disabled={saving} onClick={() => { let next = renameSetList(setList, listName, new Date().toISOString()); next.performance.sets.forEach((set, index) => { next = renameSet(next, index, setNames[set.scores[0]?.id ?? String(set.number)] ?? set.name ?? '', next.updatedAt) }); void save(next) }}>{t('saveProgram')}</button>
        <button type="button" className="secondary-action" disabled={saving} onClick={download}>{t('exportProgram')}</button>
        <button type="button" className="secondary-action" disabled={saving} onClick={() => fileInput.current?.click()}>{t('importProgram')}</button>
        <input ref={fileInput} className="hidden-input" type="file" accept=".json,application/json" onChange={(event) => { void selectFile(event) }} />
      </div>
      <button type="button" className="primary-action" onClick={onRegenerate}>{t('newSets')}</button>
      {status && <p className="success" role="status">{status}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
