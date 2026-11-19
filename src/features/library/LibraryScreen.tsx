import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { BulkConfiguration, FolderScan, Score, ScoreConfiguration } from '../../domain/types'
import { CollectionImport } from '../import/CollectionImport'
import { collectionKey, collectionName, collectionNames, DEFAULT_COLLECTION } from '../../domain/collections'
import { ConfigurationEditor } from './ConfigurationEditor'
import type { FolderSnapshot } from '../../domain/types'
import { UiIcon } from '../../app/UiIcon'
import { useI18n } from '../../app/i18n'
import { BulkSettings } from './BulkSettings'
import { CollectionRename } from './CollectionRename'
import { CollectionAssignment } from './CollectionAssignment'
import { CreateCollection } from './CreateCollection'

type Filter = 'all' | 'pending' | 'active' | 'missing' | 'disabled'

function readFilter(value: string): Filter {
  switch (value) {
    case 'pending':
    case 'active':
    case 'missing':
    case 'disabled':
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
  collections?: string[]
  onCreateCollection?: (name: string) => Promise<void>
  onAssignCollection?: (ids: string[], name: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onEditingChange?: ((editing: boolean) => void) | undefined
}

export function LibraryScreen({ scores, lastScan, onFolder, onSave, onBulkSave, onRenameCollection, collections: storedCollections = [], onCreateCollection, onAssignCollection, onDelete, onEditingChange }: LibraryScreenProps) {
  const { locale, t } = useI18n()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [collectionFilter, setCollectionFilter] = useState('')
  const collections = collectionNames(scores, storedCollections)
  const [importOpen, setImportOpen] = useState(scores.length === 0)
  const [managing, setManaging] = useState(false)
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(() => new Set())
  const [collectionEditing, setCollectionEditing] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [queue, setQueue] = useState<string[] | null>(null)
  const [queueIndex, setQueueIndex] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkEditing, setBulkEditing] = useState(false)
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const rowButtons = useRef(new Map<string, HTMLButtonElement>())
  const returnFocus = useRef<string | null>(null)
  const libraryTop = useRef<HTMLElement>(null)
  const groupPrefix = useId()
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
  const finishSelection = () => { setSelecting(false); setSelected(new Set()); setBulkEditing(false); setCollectionEditing(false) }
  const pending = scores.filter((score) => score.availability === 'active' && score.configuration === 'pending')
  const activeEditorId = queue?.[queueIndex] ?? editing
  const activeEditor = scores.find((score) => score.id === activeEditorId)

  useLayoutEffect(() => {
    if (!activeEditor && returnFocus.current) {
      rowButtons.current.get(returnFocus.current)?.focus({ preventScroll: true })
      returnFocus.current = null
    }
  }, [activeEditor])

  useLayoutEffect(() => {
    const top = libraryTop.current
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start' })
  }, [query, filter, collectionFilter])

  const filtered = useMemo(() => scores.filter((score) => {
    const text = `${score.displayNumber} ${score.title} ${score.relativePath}`.toLocaleLowerCase()
    const matchesQuery = text.includes(query.trim().toLocaleLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'pending' && score.configuration === 'pending') || (filter === 'active' && score.availability === 'active') || score.availability === filter || (filter === 'disabled' && !score.enabled)
    return matchesQuery && matchesFilter && (!collectionFilter || collectionKey(score.collection) === collectionKey(collectionFilter))
  }), [filter, query, scores, collectionFilter])

  const groups = useMemo(() => {
    const byCollection = new Map<string, Score[]>()
    for (const score of filtered) {
      const key = collectionKey(score.collection)
      const pieces = byCollection.get(key)
      if (pieces) pieces.push(score)
      else byCollection.set(key, [score])
    }
    return collectionNames(filtered).flatMap((name) => {
      const pieces = byCollection.get(collectionKey(name))
      return pieces ? [{ name, pieces }] : []
    })
  }, [filtered])
  const hasFilters = Boolean(query.trim() || collectionFilter || filter !== 'all')
  const showGroups = !hasFilters && groups.length > 1
  const collectionPicker = <label className="filter-label"><span>{t('collection')}</span><select value={collectionFilter} onChange={(event) => setCollectionFilter(event.target.value)}><option value="">{t('allLibraryCollections')}</option>{collections.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>

  const collectionTools = <div className="collection-panel">
    {scores.length === 0 && <div className="collection-panel-heading">{collectionPicker}</div>}
    {onCreateCollection && <CreateCollection onCreate={async (name) => { await onCreateCollection(name); setCollectionFilter(collectionName(name)); setImportOpen(true); setFeedback(t('collectionCreated')) }} />}
    {collectionFilter && onRenameCollection && <CollectionRename key={collectionFilter} name={collectionFilter} onRename={async (name) => { await onRenameCollection(collectionFilter, name); setCollectionFilter(collectionName(name)) }} />}
    <details className="import-panel" open={importOpen} onToggle={(event) => setImportOpen(event.currentTarget.open)}><summary>{t('importPieces')}</summary><CollectionImport key={collectionFilter} initialCollection={collectionFilter || DEFAULT_COLLECTION} collections={collections} onSnapshot={onFolder} /></details>
  </div>

  if (activeEditor) {
    const isQueue = Boolean(queue)
    const persist = (configuration: ScoreConfiguration) => onSave(activeEditor.id, configuration)
    return <ConfigurationEditor key={activeEditor.id} score={activeEditor} progress={isQueue ? `${queueIndex + 1} ${t('of')} ${queue?.length ?? 0}` : undefined} saveLabel={isQueue ? (queueIndex + 1 === queue?.length ? t('saveAndFinish') : t('saveAndNext')) : t('saveScore')} onClose={() => { setEditing(null); setQueue(null); setQueueIndex(0); onEditingChange?.(false) }} onDraftChange={persist} onDelete={onDelete ? async () => { await onDelete(activeEditor.id); setEditing(null); setQueue(null); setQueueIndex(0); onEditingChange?.(false); setFeedback(t('pieceDeleted')) } : undefined} onSave={async (configuration) => { await persist(configuration); if (isQueue) { if (queueIndex + 1 < (queue?.length ?? 0)) setQueueIndex((index) => index + 1); else { setQueue(null); setQueueIndex(0); onEditingChange?.(false) } } else { setEditing(null); onEditingChange?.(false) } }} />
  }

  if (scores.length === 0) {
    return (
      <section className="empty-state" ref={libraryTop}>
        <div className="hero-mark" aria-hidden="true"><UiIcon name="music" /></div>
        <h1>{t('buildTonightsSets')}</h1>
        <p>{t('filenameExample')} <strong>01 - Name.mscz</strong>.</p>
        {collectionTools}
        {feedback && <p className="success" role="status">{feedback}</p>}
      </section>
    )
  }

  const renderPieces = (pieces: Score[]) => <ul className="score-list">
    {pieces.map((score) => <li key={score.id}><button type="button" ref={(button) => { if (button) rowButtons.current.set(score.id, button); else rowButtons.current.delete(score.id) }} className={`score-row ${selected.has(score.id) ? 'selected' : ''}`} aria-pressed={selecting ? selected.has(score.id) : undefined} onPointerDown={(event) => startPress(event, score.id)} onPointerMove={(event) => { if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 10) clearPress() }} onPointerUp={clearPress} onPointerCancel={clearPress} onContextMenu={(event) => event.preventDefault()} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return } if (selecting) toggle(score.id); else { returnFocus.current = score.id; setEditing(score.id); onEditingChange?.(true) } }}><span className="score-number">{score.displayNumber}</span><span className="score-copy"><strong>{score.title}</strong><small>{collectionName(score.collection)}</small><small>{score.availability === 'missing' ? t('missing') : !score.enabled ? t('disabled') : score.configuration === 'pending' ? t('setupNeeded') : t('ready')}</small></span>{selecting ? <span className="selection-indicator" aria-hidden="true">{selected.has(score.id) ? '✓' : ''}</span> : <span className={`status-dot ${score.availability} ${score.configuration}`} aria-hidden="true" />}</button></li>)}
  </ul>

  return (
    <section className="screen-section library-screen" aria-labelledby="library-title" ref={libraryTop}>
      <div className="title-row"><div><div className="eyebrow">{t('activeScores', { count: scores.filter((score) => score.availability === 'active').length })}</div><h1 id="library-title">{t('library')}</h1></div>{pending.length > 0 && <button className="pill-button" type="button" onClick={() => { setQueue(pending.map((score) => score.id)); setQueueIndex(0); onEditingChange?.(true) }}>{t('configure', { count: pending.length })}</button>}</div>
      <div className="library-browser">
        <label className="search-label"><span>{t('search')}</span><input type="search" value={query} placeholder={t('numberTitlePath')} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="library-filter-row">
          {collectionPicker}
          <label className="filter-label"><span>{t('libraryStatus')}</span><select value={filter} onChange={(event) => setFilter(readFilter(event.target.value))}><option value="all">{t('allLibraryStatuses')}</option><option value="pending">{t('pending')}</option><option value="active">{t('active')}</option><option value="missing">{t('missing')}</option><option value="disabled">{t('disabled')}</option></select></label>
        </div>
      </div>
      <div className={`library-actions ${managing ? 'managing' : ''}`}>
        <details className="library-management" open={managing} onToggle={(event) => setManaging(event.currentTarget.open)}>
          <summary><span>{t('manageLibrary')}</span><UiIcon name="down" /></summary>
          {collectionTools}
        </details>
        {!selecting && <button type="button" className="secondary-action" onClick={() => { setSelecting(true); setFeedback('') }}>{t('selectPieces')}</button>}
      </div>
      {selecting && <div className="selection-toolbar">
        <span role="status">{t('selectedCount', { count: selected.size })}</span>
        {!bulkEditing && !collectionEditing && <>
          <button type="button" className="secondary-action" disabled={selected.size === 0} onClick={() => setBulkEditing(true)}>{t('editSettings')}</button>
          {onAssignCollection && <button type="button" className="secondary-action" disabled={selected.size === 0} onClick={() => setCollectionEditing(true)}>{t('moveToCollection')}</button>}
          <button type="button" className="text-button" onClick={finishSelection}>{t('cancel')}</button>
        </>}
      </div>}
      {collectionEditing && onAssignCollection && <CollectionAssignment count={selected.size} collections={collections} canRemove={scores.some((score) => selected.has(score.id) && collectionKey(score.collection) !== collectionKey(DEFAULT_COLLECTION))} onCancel={() => setCollectionEditing(false)} onAssign={async (name) => { await onAssignCollection([...selected], name); setFeedback(t('piecesMoved', { count: selected.size, collection: name })); finishSelection() }} />}
      {bulkEditing && <BulkSettings count={selected.size} onCancel={() => setBulkEditing(false)} onApply={async (changes) => { if (!onBulkSave) throw new Error('Save failed. Try again.'); await onBulkSave([...selected], changes); finishSelection() }} />}
      {lastScan && <p className="alignment-stamp">{t('lastAligned')} <time dateTime={lastScan.appliedAt}>{new Date(lastScan.appliedAt).toLocaleString(locale)}</time> · +{lastScan.summary.added} / −{lastScan.summary.missing}</p>}
      {feedback && <p className="success" role="status">{feedback}</p>}
      <div className="library-results">
        <p aria-live="polite" aria-atomic="true"><strong>{filtered.length}</strong> {t(filtered.length === 1 ? 'piece' : 'pieces')}</p>
        {hasFilters && <button type="button" className="text-button" onClick={() => { setQuery(''); setFilter('all'); setCollectionFilter('') }}>{t('clearFilters')}</button>}
      </div>
      {showGroups ? <div className="library-groups">{groups.map((group, index) => {
        const key = collectionKey(group.name)
        const expanded = expandedCollections.has(key)
        const selectedCount = group.pieces.filter((score) => selected.has(score.id)).length
        const id = `${groupPrefix}-collection-${index}`
        return <section className="library-collection" key={key}>
          <h2><button type="button" className="library-collection-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpandedCollections((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })}>
            <span className="library-collection-name"><UiIcon name="library" /><span>{group.name}</span></span>{' '}
            <span className="library-collection-count">{group.pieces.length} {t(group.pieces.length === 1 ? 'piece' : 'pieces')}{selectedCount > 0 && <small>{t('selectedCount', { count: selectedCount })}</small>}</span>
            <UiIcon name="down" />
          </button></h2>
          <div id={id} hidden={!expanded}>{expanded && renderPieces(group.pieces)}</div>
        </section>
      })}</div> : filtered.length > 0 && renderPieces(filtered)}
      {filtered.length === 0 && <p className="notice">{t('noMatches')}</p>}
    </section>
  )
}
