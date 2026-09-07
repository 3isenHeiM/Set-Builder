import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { assertPerformanceValid } from '../../domain/generator'
import { canMovePiece, movePiece, moveSet, renameSet, renameSetList } from '../../domain/setList'
import { createSetListBackup, parseSetListBackupJson, setListBackupToJson, type SetListBackup } from '../../domain/setListBackup'
import type { SavedSetList } from '../../domain/types'
import { UiIcon } from '../../app/UiIcon'
import { localizedError, localizedKnownMessage, useI18n } from '../../app/i18n'

interface PerformanceScreenProps {
  setList: SavedSetList | undefined
  savedSetLists: SavedSetList[]
  onSave: (setList: SavedSetList) => Promise<void>
  onSelect: (id: string) => Promise<void>
  onImport: (backup: SetListBackup) => Promise<void>
  onRegenerate: () => void
}

function downloadName(exportedAt: string): string {
  return `piece-selector-set-list-${exportedAt.slice(0, 10)}.json`
}

export function PerformanceScreen({ setList, savedSetLists, onSave, onSelect, onImport, onRegenerate }: PerformanceScreenProps) {
  const { locale, t } = useI18n()
  const fileInput = useRef<HTMLInputElement>(null)
  const [listName, setListName] = useState(setList?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => setListName(setList?.name ?? ''), [setList?.id, setList?.name])

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

  const select = async (id: string) => {
    setStatus('')
    setError('')
    try {
      await onSelect(id)
    } catch (caught) {
      setError(localizedError(caught, locale, t('setListOpenFailed')))
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

  if (!setList) return (
    <section className="empty-state compact">
      <div className="hero-mark" aria-hidden="true"><UiIcon name="sets" /></div>
      <h1>{t('noSets')}</h1>
      <button className="primary-action" type="button" onClick={onRegenerate}>{t('buildSets')}</button>
      <button className="secondary-action" type="button" onClick={() => fileInput.current?.click()}>{t('importSetList')}</button>
      <input ref={fileInput} className="hidden-input" type="file" accept=".json,application/json" onChange={(event) => { void selectFile(event) }} />
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
  if (import.meta.env.DEV) assertPerformanceValid(setList.performance)

  return (
    <section className="screen-section performance" aria-labelledby="performance-title">
      <div className="eyebrow">{setList.performance.preset === '80s' ? '80s' : t('mix')}</div>
      <h1 id="performance-title">{setList.name || t('setsTitle')}</h1>

      <label className="saved-list-picker"><span>{t('savedSetLists')}</span><select value={setList.id} onChange={(event) => { void select(event.target.value) }}>{allSetLists.map((saved) => <option value={saved.id} key={saved.id}>{saved.name || t('setsTitle')} · {new Date(saved.createdAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</option>)}</select></label>
      <label className="set-list-name"><span>{t('setListName')}</span><input type="text" value={listName} maxLength={120} placeholder={t('setsTitle')} onChange={(event) => setListName(event.target.value)} onBlur={() => { if (listName.trim() !== setList.name) void save(renameSetList(setList, listName, new Date().toISOString())) }} /></label>

      <p className="alignment-stamp"><time dateTime={setList.performance.generatedAt}>{new Date(setList.performance.generatedAt).toLocaleString(locale)}</time></p>
      {setList.performance.warnings.map((warning) => <p className="notice" role="status" key={warning}>{localizedKnownMessage(warning, locale) ?? warning}</p>)}
      <div className="set-list">
        {setList.performance.sets.map((set, setIndex) => (
          <section className="set-card" key={`${setList.id}-${set.scores[0]?.id ?? set.number}`} aria-labelledby={`set-${set.number}`}>
            <div className="set-card-header">
              <div><span>{t('set')} {set.number}</span><label><span className="sr-only">{t('setName', { number: set.number })}</span><input id={`set-${set.number}`} type="text" defaultValue={set.name ?? ''} maxLength={120} placeholder={`${t('set')} ${set.number}`} onBlur={(event) => { if (event.currentTarget.value.trim() !== (set.name ?? '')) void save(renameSet(setList, setIndex, event.currentTarget.value, new Date().toISOString())) }} /></label></div>
              <div className="order-controls">
                <button type="button" aria-label={t('moveSetUp', { number: set.number })} disabled={saving || setIndex === 0} onClick={() => { void save(moveSet(setList, setIndex, setIndex - 1, new Date().toISOString())) }}><UiIcon name="up" /></button>
                <button type="button" aria-label={t('moveSetDown', { number: set.number })} disabled={saving || setIndex === setList.performance.sets.length - 1} onClick={() => { void save(moveSet(setList, setIndex, setIndex + 1, new Date().toISOString())) }}><UiIcon name="down" /></button>
              </div>
            </div>
            <ol>
              {set.scores.map((score, scoreIndex) => <li key={score.id}><span className="position">{scoreIndex + 1}</span><span className="score-number">{score.displayNumber}</span><span className="score-copy"><strong>{score.title}</strong><small>{t('hotnessShort')}{score.hotness}{score.goesHigh ? ` · ${t('highPiece')}` : ''}{score.drumsIntro ? ` · ${t('drums')}` : ''}{scoreIndex === 0 ? ` · ${t('start')}` : ''}</small></span>{scoreIndex > 0 && <span className="piece-order-controls"><button type="button" aria-label={t('movePieceUp', { title: score.title })} disabled={saving || !canMovePiece(set, scoreIndex, scoreIndex - 1)} onClick={() => { void save(movePiece(setList, setIndex, scoreIndex, scoreIndex - 1, new Date().toISOString())) }}><UiIcon name="up" /></button><button type="button" aria-label={t('movePieceDown', { title: score.title })} disabled={saving || !canMovePiece(set, scoreIndex, scoreIndex + 1)} onClick={() => { void save(movePiece(setList, setIndex, scoreIndex, scoreIndex + 1, new Date().toISOString())) }}><UiIcon name="down" /></button></span>}</li>)}
            </ol>
          </section>
        ))}
      </div>

      <div className="set-list-actions">
        <button type="button" className="secondary-action" disabled={saving} onClick={download}>{t('exportSetList')}</button>
        <button type="button" className="secondary-action" disabled={saving} onClick={() => fileInput.current?.click()}>{t('importSetList')}</button>
        <input ref={fileInput} className="hidden-input" type="file" accept=".json,application/json" onChange={(event) => { void selectFile(event) }} />
      </div>
      <button type="button" className="primary-action" onClick={onRegenerate}>{t('newSets')}</button>
      {status && <p className="success" role="status">{status}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
