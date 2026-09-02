import { useEffect, useState } from 'react'
import { classifyReconciliation } from '../domain/reconciliation'
import type { SettingsBackup } from '../domain/settingsBackup'
import type { FolderScan, FolderSnapshot, GeneratedPerformance, ReconciliationPlan, RenumberingDecisions, SavedSetList, Score, ScoreConfiguration } from '../domain/types'
import { restoreSetList, type SetListBackup } from '../domain/setListBackup'
import { repository as browserRepository } from '../data/client'
import type { PerformanceRepository, ScoreRepository } from '../data/repository'
import { createLocalId } from './id'
import { ReconciliationPreview } from '../features/import/ReconciliationPreview'
import { GenerateScreen } from '../features/generator/GenerateScreen'
import { LibraryScreen } from '../features/library/LibraryScreen'
import { PerformanceScreen } from '../features/performance/PerformanceScreen'
import { SettingsBackupPanel } from '../features/settings/SettingsBackupPanel'
import { AboutScreen, InstallGuide } from '../pwa/InstallGuide'
import { UpdateBanner } from '../pwa/UpdateBanner'
import { UiIcon } from './UiIcon'
import { localizedError, useI18n } from './i18n'

type Page = 'library' | 'generate' | 'performance' | 'about'
type AppRepository = ScoreRepository & PerformanceRepository

export function App({ repository = browserRepository }: { repository?: AppRepository }) {
  const { locale, t } = useI18n()
  const [scores, setScores] = useState<Score[]>([])
  const [lastScan, setLastScan] = useState<FolderScan>()
  const [setLists, setSetLists] = useState<SavedSetList[]>([])
  const [currentSetList, setCurrentSetList] = useState<SavedSetList>()
  const [preview, setPreview] = useState<ReconciliationPlan>()
  const [applying, setApplying] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [page, setPage] = useState<Page>('library')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editingScore, setEditingScore] = useState(false)

  useEffect(() => {
    void Promise.all([repository.listScores(), repository.getLastScan(), repository.getLastPerformance(), repository.listSetLists()])
      .then(([loadedScores, scan, savedPerformance, savedSetLists]) => {
        setScores(loadedScores)
        setLastScan(scan)
        setSetLists(savedSetLists)
        if (savedPerformance) {
          setCurrentSetList(savedSetLists.find((saved) => saved.id === savedPerformance.id) ?? {
            id: savedPerformance.id,
            name: '',
            createdAt: savedPerformance.generatedAt,
            updatedAt: savedPerformance.generatedAt,
            performance: savedPerformance,
          })
          setPage('performance')
        } else if (savedSetLists[0]) {
          setCurrentSetList(savedSetLists[0])
          setPage('performance')
        }
      })
      .catch((error: unknown) => setLoadError(localizedError(error, locale, t('localStorageUnavailable'))))
      .finally(() => setLoading(false))
  }, [locale, repository, t])

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
      setPreviewError(localizedError(error, locale, t('changesNotApplied')))
    } finally {
      setApplying(false)
    }
  }

  const saveConfiguration = async (id: string, configuration: ScoreConfiguration) => {
    await repository.saveConfiguration(id, configuration, new Date().toISOString())
    setScores(await repository.listScores())
  }

  const savePerformance = async (generated: GeneratedPerformance) => {
    const saved: SavedSetList = { id: generated.id, name: '', createdAt: generated.generatedAt, updatedAt: generated.generatedAt, performance: generated }
    await repository.saveSetList(saved)
    setSetLists(await repository.listSetLists())
    setCurrentSetList(saved)
    setPage('performance')
  }

  const saveSetList = async (saved: SavedSetList) => {
    await repository.saveSetList(saved)
    setSetLists(await repository.listSetLists())
    setCurrentSetList(saved)
  }

  const selectSetList = async (id: string) => {
    const selected = setLists.find((saved) => saved.id === id)
    if (!selected) return
    await repository.saveLastPerformance(selected.performance)
    setCurrentSetList(selected)
  }

  const importSetList = async (backup: SetListBackup) => {
    await saveSetList(restoreSetList(backup, new Date().toISOString(), createLocalId))
    setPage('performance')
  }

  const importSettings = async (backup: SettingsBackup) => {
    const report = await repository.importSettings(backup, new Date().toISOString())
    setScores(await repository.listScores())
    return report
  }

  if (loading) return <main id="main-content" className="loading-screen"><div className="hero-mark"><UiIcon name="music" /></div><p>{t('loadingLibrary')}</p></main>
  if (loadError) return <main id="main-content" className="loading-screen"><h1>Piece Selector</h1><p className="error" role="alert">{loadError}</p></main>

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{t('skipToContent')}</a>
      <header className="app-header"><span className="app-logo" aria-hidden="true"><UiIcon name="music" /></span><strong>Piece Selector</strong></header>
      <InstallGuide />
      <UpdateBanner />
      <main id="main-content">
        {preview ? <ReconciliationPreview plan={preview} applying={applying} error={previewError} onApply={apply} onCancel={() => { setPreview(undefined); setPreviewError('') }} /> : page === 'library' ? <LibraryScreen scores={scores} lastScan={lastScan} onFolder={rescan} onSave={saveConfiguration} onEditingChange={setEditingScore} /> : page === 'generate' ? <GenerateScreen scores={scores} hasPerformance={Boolean(currentSetList)} onGenerated={savePerformance} /> : page === 'performance' ? <PerformanceScreen setList={currentSetList} savedSetLists={setLists} onSave={saveSetList} onSelect={selectSetList} onImport={importSetList} onRegenerate={() => setPage('generate')} /> : <AboutScreen><SettingsBackupPanel scores={scores} onImport={importSettings} /></AboutScreen>}
      </main>
      {!preview && !editingScore && <nav className="bottom-nav" aria-label={t('primaryNavigation')}>{([['library', t('library')], ['generate', t('build')], ['performance', t('sets')], ['about', t('about')]] as const).map(([target, label]) => <button type="button" key={target} aria-current={page === target ? 'page' : undefined} onClick={() => setPage(target)}><UiIcon name={target === 'library' ? 'library' : target === 'generate' ? 'sparkles' : target === 'performance' ? 'sets' : 'info'} />{label}</button>)}</nav>}
    </div>
  )
}
