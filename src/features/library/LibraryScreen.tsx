import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { BulkConfiguration, FolderScan, Score, ScoreConfiguration } from '../../domain/types'
import { CollectionImport } from '../import/CollectionImport'
import { collectionKey, collectionName, DEFAULT_COLLECTION } from '../../domain/collections'
import { ConfigurationEditor } from './ConfigurationEditor'
import type { FolderSnapshot } from '../../domain/types'
import { UiIcon } from '../../app/UiIcon'
import { useI18n } from '../../app/i18n'
import { BulkSettings } from './BulkSettings'
import { CollectionRename } from './CollectionRename'

type Filter = 'all' | 'pending' | 'active' | 'missing' | 'disabled' | '80s'

function readFilter(value: string): Filter {
  switch (value) {
    case 'pending':
    case 'active':
    case 'missing':
    case 'disabled':
    case '80s':
      return value
    default:
      return 'all'
  }
}

interface LibraryScreenProps {
  scores: Score[]
  lastScan: FolderScan | undefined
  onFolder: (snapshot: FolderSnapshot) => void
  onSave: (id: string, configuration: ScoreConfiguration) => Promise<void>
  onBulkSave?: (ids: string[], changes: BulkConfiguration) => Promise<void>
  onRenameCollection?: (previous: string, name: string) => Promise<void>
  onEditingChange?: ((editing: boolean) => void) | undefined
}

export function LibraryScreen({ scores, lastScan, onFolder, onSave, onBulkSave, onRenameCollection, onEditingChange }: LibraryScreenProps) {
  const { locale, t } = useI18n()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [collectionFilter, setCollectionFilter] = useState('')
  const collections = [...new Map((scores.length ? scores.map((score) => collectionName(score.collection)) : [DEFAULT_COLLECTION]).map((name) => [collectionKey(name), name])).values()]
  const [queue, setQueue] = useState<string[] | null>(null)
  const [queueIndex, setQueueIndex] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkEditing, setBulkEditing] = useState(false)
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const clearPress = () => { if (press.current) clearTimeout(press.current.timer); press.current = null }
  useEffect(() => () => clearPress(), [])
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const startPress = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    suppressClick.current = false
    if (selecting || event.button !== 0) return
    clearPress()
    const { clientX: x, clientY: y } = event
    press.current = { x, y, timer: setTimeout(() => { press.current = null; suppressClick.current = true; setSelecting(true); setSelected(new Set([id])) }, 550) }
  }
  const finishSelection = () => { setSelecting(false); setSelected(new Set()); setBulkEditing(false) }
  const pending = scores.filter((score) => score.availability === 'active' && score.configuration === 'pending')
  const activeEditorId = queue?.[queueIndex] ?? editing
  const activeEditor = scores.find((score) => score.id === activeEditorId)

  const filtered = useMemo(() => scores.filter((score) => {
    const text = `${score.displayNumber} ${score.title} ${score.relativePath}`.toLocaleLowerCase()
    const matchesQuery = text.includes(query.trim().toLocaleLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'pending' && score.configuration === 'pending') || (filter === 'active' && score.availability === 'active') || score.availability === filter || (filter === 'disabled' && !score.enabled) || (filter === '80s' && score.tags.includes('80s'))
    return matchesQuery && matchesFilter && (!collectionFilter || collectionKey(score.collection) === collectionKey(collectionFilter))
  }), [filter, query, scores, collectionFilter])

  if (activeEditor) {
    const isQueue = Boolean(queue)
    const persist = (configuration: ScoreConfiguration) => onSave(activeEditor.id, configuration)
    return <ConfigurationEditor key={activeEditor.id} score={activeEditor} progress={isQueue ? `${queueIndex + 1} ${t('of')} ${queue?.length ?? 0}` : undefined} saveLabel={isQueue ? (queueIndex + 1 === queue?.length ? t('saveAndFinish') : t('saveAndNext')) : t('saveScore')} onClose={() => { setEditing(null); setQueue(null); setQueueIndex(0); onEditingChange?.(false) }} onDraftChange={persist} onSave={async (configuration) => { await persist(configuration); if (isQueue) { if (queueIndex + 1 < (queue?.length ?? 0)) setQueueIndex((index) => index + 1); else { setQueue(null); setQueueIndex(0); onEditingChange?.(false) } } else { setEditing(null); onEditingChange?.(false) } }} />
  }

  if (scores.length === 0) {
    return (
      <section className="empty-state">
        <div className="hero-mark" aria-hidden="true"><UiIcon name="music" /></div>
        <h1>{t('buildTonightsSets')}</h1>
        <p>{t('filenameExample')} <strong>01 - Name.mscz</strong>.</p>
        <CollectionImport collections={collections} onSnapshot={onFolder} />
      </section>
    )
  }

  return (
    <section className="screen-section" aria-labelledby="library-title">
      <div className="title-row"><div><div className="eyebrow">{t('activeScores', { count: scores.filter((score) => score.availability === 'active').length })}</div><h1 id="library-title">{t('library')}</h1></div>{pending.length > 0 && <button className="pill-button" type="button" onClick={() => { setQueue(pending.map((score) => score.id)); setQueueIndex(0); onEditingChange?.(true) }}>{t('configure', { count: pending.length })}</button>}</div>
      <div className="selection-toolbar">{selecting ? <><span role="status">{t('selectedCount', { count: selected.size })}</span><button type="button" className="secondary-action" disabled={selected.size === 0} onClick={() => setBulkEditing(true)}>{t('editSettings')}</button><button type="button" className="text-button" onClick={finishSelection}>{t('cancel')}</button></> : <button type="button" className="secondary-action" onClick={() => setSelecting(true)}>{t('selectPieces')}</button>}</div>
      {bulkEditing && <BulkSettings count={selected.size} onCancel={() => setBulkEditing(false)} onApply={async (changes) => { if (!onBulkSave) throw new Error('Save failed. Try again.'); await onBulkSave([...selected], changes); finishSelection() }} />}
      {lastScan && <p className="alignment-stamp">{t('lastAligned')} <time dateTime={lastScan.appliedAt}>{new Date(lastScan.appliedAt).toLocaleString(locale)}</time> · +{lastScan.summary.added} / −{lastScan.summary.missing}</p>}
      <details className="import-panel"><summary>{t('importPieces')}</summary><CollectionImport collections={collections} onSnapshot={onFolder} /></details>
      <label><span>{t('collection')}</span><select value={collectionFilter} onChange={(event) => setCollectionFilter(event.target.value)}><option value="">{t('allCollections')}</option>{collections.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      {collectionFilter && onRenameCollection && <CollectionRename key={collectionFilter} name={collectionFilter} onRename={async (name) => { await onRenameCollection(collectionFilter, name); setCollectionFilter(collectionName(name)) }} />}
      <label className="search-label"><span>{t('search')}</span><input type="search" value={query} placeholder={t('numberTitlePath')} onChange={(event) => setQuery(event.target.value)} /></label>
      <label className="filter-label"><span>{t('filter')}</span><select value={filter} onChange={(event) => setFilter(readFilter(event.target.value))}><option value="all">{t('allScores')}</option><option value="pending">{t('pending')}</option><option value="active">{t('active')}</option><option value="missing">{t('missing')}</option><option value="disabled">{t('disabled')}</option><option value="80s">80s</option></select></label>
      <ul className="score-list" aria-live="polite">
        {filtered.map((score) => <li key={score.id}><button type="button" className={`score-row ${selected.has(score.id) ? 'selected' : ''}`} aria-pressed={selecting ? selected.has(score.id) : undefined} onPointerDown={(event) => startPress(event, score.id)} onPointerMove={(event) => { if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 10) clearPress() }} onPointerUp={clearPress} onPointerCancel={clearPress} onContextMenu={(event) => event.preventDefault()} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return } if (selecting) toggle(score.id); else { setEditing(score.id); onEditingChange?.(true) } }}><span className="score-number">{score.displayNumber}</span><span className="score-copy"><strong>{score.title}</strong><small>{collectionName(score.collection)}</small><small>{score.availability === 'missing' ? t('missing') : !score.enabled ? t('disabled') : score.configuration === 'pending' ? t('setupNeeded') : score.tags.includes('80s') ? t('ready80s') : t('ready')}</small></span>{selecting ? <span className="selection-indicator" aria-hidden="true">{selected.has(score.id) ? '✓' : ''}</span> : <span className={`status-dot ${score.availability} ${score.configuration}`} aria-hidden="true" />}</button></li>)}
      </ul>
      {filtered.length === 0 && <p className="notice">{t('noMatches')}</p>}
    </section>
  )
}
