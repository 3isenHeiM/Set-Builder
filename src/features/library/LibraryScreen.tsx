import { useMemo, useState } from 'react'
import type { FolderScan, Score, ScoreConfiguration } from '../../domain/types'
import { FolderPicker } from '../import/FolderPicker'
import { ConfigurationEditor } from './ConfigurationEditor'
import type { FolderSnapshot } from '../../domain/types'

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
  onEditingChange?: ((editing: boolean) => void) | undefined
}

export function LibraryScreen({ scores, lastScan, onFolder, onSave, onEditingChange }: LibraryScreenProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [queue, setQueue] = useState<string[] | null>(null)
  const [queueIndex, setQueueIndex] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const pending = scores.filter((score) => score.availability === 'active' && score.configuration === 'pending')
  const activeEditorId = queue?.[queueIndex] ?? editing
  const activeEditor = scores.find((score) => score.id === activeEditorId)

  const filtered = useMemo(() => scores.filter((score) => {
    const text = `${score.displayNumber} ${score.title} ${score.relativePath}`.toLocaleLowerCase()
    const matchesQuery = text.includes(query.trim().toLocaleLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'pending' && score.configuration === 'pending') || (filter === 'active' && score.availability === 'active') || score.availability === filter || (filter === 'disabled' && !score.enabled) || (filter === '80s' && score.tags.includes('80s'))
    return matchesQuery && matchesFilter
  }), [filter, query, scores])

  if (activeEditor) {
    const isQueue = Boolean(queue)
    const persist = (configuration: ScoreConfiguration) => onSave(activeEditor.id, configuration)
    return <ConfigurationEditor key={activeEditor.id} score={activeEditor} progress={isQueue ? `${queueIndex + 1} of ${queue?.length ?? 0}` : undefined} saveLabel={isQueue ? (queueIndex + 1 === queue?.length ? 'Save and finish' : 'Save and next') : 'Save score'} onClose={() => { setEditing(null); setQueue(null); setQueueIndex(0); onEditingChange?.(false) }} onDraftChange={persist} onSave={async (configuration) => { await persist(configuration); if (isQueue) { if (queueIndex + 1 < (queue?.length ?? 0)) setQueueIndex((index) => index + 1); else { setQueue(null); setQueueIndex(0); onEditingChange?.(false) } } }} />
  }

  if (scores.length === 0) {
    return (
      <section className="empty-state">
        <div className="hero-mark" aria-hidden="true">♪</div>
        <div className="eyebrow">Start local. Stay offline.</div>
        <h1>Turn a scores folder into tonight’s set list.</h1>
        <p>Name scores like <strong>01 - Take On Me.mscz</strong>. You’ll review every change before it reaches this device.</p>
        <FolderPicker mode="import" onSnapshot={onFolder} />
      </section>
    )
  }

  return (
    <section className="screen-section" aria-labelledby="library-title">
      <div className="title-row"><div><div className="eyebrow">{scores.filter((score) => score.availability === 'active').length} active scores</div><h1 id="library-title">Library</h1></div>{pending.length > 0 && <button className="pill-button" type="button" onClick={() => { setQueue(pending.map((score) => score.id)); setQueueIndex(0); onEditingChange?.(true) }}>Configure {pending.length}</button>}</div>
      {lastScan && <p className="alignment-stamp">Last aligned <time dateTime={lastScan.appliedAt}>{new Date(lastScan.appliedAt).toLocaleString()}</time> · +{lastScan.summary.added} / −{lastScan.summary.missing}</p>}
      <FolderPicker mode="realign" onSnapshot={onFolder} />
      <label className="search-label"><span>Search scores</span><input type="search" value={query} placeholder="Number, title, or path" onChange={(event) => setQuery(event.target.value)} /></label>
      <label className="filter-label"><span>Filter</span><select value={filter} onChange={(event) => setFilter(readFilter(event.target.value))}><option value="all">All scores</option><option value="pending">Pending</option><option value="active">Active</option><option value="missing">Missing</option><option value="disabled">Disabled</option><option value="80s">80s</option></select></label>
      <ul className="score-list" aria-live="polite">
        {filtered.map((score) => <li key={score.id}><button type="button" className="score-row" onClick={() => { setEditing(score.id); onEditingChange?.(true) }}><span className="score-number">{score.displayNumber}</span><span className="score-copy"><strong>{score.title}</strong><small>{score.availability === 'missing' ? 'Missing from folder' : score.configuration === 'pending' ? 'Needs configuration' : !score.enabled ? 'Disabled' : score.tags.includes('80s') ? 'Ready · 80s' : 'Ready'}</small></span><span className={`status-dot ${score.availability} ${score.configuration}`} aria-hidden="true" /></button></li>)}
      </ul>
      {filtered.length === 0 && <p className="notice">No scores match this search and filter.</p>}
    </section>
  )
}
