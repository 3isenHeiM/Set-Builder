import { useEffect, useState } from 'react'
import { classifyReconciliation } from '../domain/reconciliation'
import type { FolderScan, FolderSnapshot, GeneratedPerformance, ReconciliationPlan, RenumberingDecisions, Score, ScoreConfiguration } from '../domain/types'
import { repository as browserRepository } from '../data/client'
import type { PerformanceRepository, ScoreRepository } from '../data/repository'
import { createLocalId } from './id'
import { ReconciliationPreview } from '../features/import/ReconciliationPreview'
import { GenerateScreen } from '../features/generator/GenerateScreen'
import { LibraryScreen } from '../features/library/LibraryScreen'
import { PerformanceScreen } from '../features/performance/PerformanceScreen'
import { AboutScreen, InstallGuide } from '../pwa/InstallGuide'
import { UpdateBanner } from '../pwa/UpdateBanner'

type Page = 'library' | 'generate' | 'performance' | 'about'
type AppRepository = ScoreRepository & PerformanceRepository

export function App({ repository = browserRepository }: { repository?: AppRepository }) {
  const [scores, setScores] = useState<Score[]>([])
  const [lastScan, setLastScan] = useState<FolderScan>()
  const [performance, setPerformance] = useState<GeneratedPerformance>()
  const [preview, setPreview] = useState<ReconciliationPlan>()
  const [applying, setApplying] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [page, setPage] = useState<Page>('library')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editingScore, setEditingScore] = useState(false)

  useEffect(() => {
    void Promise.all([repository.listScores(), repository.getLastScan(), repository.getLastPerformance()])
      .then(([loadedScores, scan, savedPerformance]) => {
        setScores(loadedScores)
        setLastScan(scan)
        setPerformance(savedPerformance)
        if (savedPerformance) setPage('performance')
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Local storage is unavailable.'))
      .finally(() => setLoading(false))
  }, [repository])

  const rescan = (snapshot: FolderSnapshot) => {
    setPreviewError('')
    setPreview(classifyReconciliation(snapshot, scores))
  }

  const apply = async (decisions: RenumberingDecisions) => {
    if (!preview) return
    setApplying(true)
    setPreviewError('')
    try {
      const scan = await repository.applyReconciliation(preview, decisions, new Date().toISOString(), createLocalId)
      setScores(await repository.listScores())
      setLastScan(scan)
      setPreview(undefined)
      setPage('library')
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Changes were not applied.')
    } finally {
      setApplying(false)
    }
  }

  const saveConfiguration = async (id: string, configuration: ScoreConfiguration) => {
    await repository.saveConfiguration(id, configuration, new Date().toISOString())
    setScores(await repository.listScores())
  }

  const savePerformance = async (generated: GeneratedPerformance) => {
    await repository.saveLastPerformance(generated)
    setPerformance(generated)
    setPage('performance')
  }

  if (loading) return <main id="main-content" className="loading-screen"><div className="hero-mark">♪</div><p>Opening your local library…</p></main>
  if (loadError) return <main id="main-content" className="loading-screen"><h1>Piece Selector</h1><p className="error" role="alert">{loadError}</p></main>

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="app-header"><span className="app-logo" aria-hidden="true">♪</span><strong>Piece Selector</strong><span className="local-badge">Local</span></header>
      <InstallGuide />
      <UpdateBanner />
      <main id="main-content">
        {preview ? <ReconciliationPreview plan={preview} applying={applying} error={previewError} onApply={apply} onCancel={() => { setPreview(undefined); setPreviewError('') }} /> : page === 'library' ? <LibraryScreen scores={scores} lastScan={lastScan} onFolder={rescan} onSave={saveConfiguration} onEditingChange={setEditingScore} /> : page === 'generate' ? <GenerateScreen scores={scores} hasPerformance={Boolean(performance)} onGenerated={savePerformance} /> : page === 'performance' ? <PerformanceScreen performance={performance} onRegenerate={() => setPage('generate')} /> : <AboutScreen />}
      </main>
      {!preview && !editingScore && <nav className="bottom-nav" aria-label="Primary navigation">{([['library', 'Library'], ['generate', 'Generate'], ['performance', 'Sets'], ['about', 'About']] as const).map(([target, label]) => <button type="button" key={target} aria-current={page === target ? 'page' : undefined} onClick={() => setPage(target)}><span aria-hidden="true">{target === 'library' ? '♬' : target === 'generate' ? '✦' : target === 'performance' ? '☷' : 'i'}</span>{label}</button>)}</nav>}
    </div>
  )
}
