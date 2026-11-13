import { useEffect, useState } from 'react'
import { classifyReconciliation } from '../domain/reconciliation'
import { createProgramFromSavedSet, createProgramFromStarter } from '../domain/setList'
import type { SettingsBackup } from '../domain/settingsBackup'
import type { BulkConfiguration, FolderScan, FolderSnapshot, GeneratedPerformance, PerformanceSet, ReconciliationPlan, RenumberingDecisions, SavedSet, SavedSetList, Score, ScoreConfiguration } from '../domain/types'
import { restoreSetList, type SetListBackup } from '../domain/setListBackup'
import { authentication as cloudAuthentication, repository as browserRepository } from '../data/client'
import { CloudApiError } from '../data/cloudRepository'
import type { AuthenticationClient } from '../data/authentication'
import type { PerformanceRepository, ScoreRepository } from '../data/repository'
import { createLocalId } from './id'
import { ReconciliationPreview } from '../features/import/ReconciliationPreview'
import { GenerateScreen } from '../features/generator/GenerateScreen'
import { LibraryScreen } from '../features/library/LibraryScreen'
import { PerformanceScreen } from '../features/performance/PerformanceScreen'
import { TonightScreen } from '../features/performance/TonightScreen'
import { SettingsBackupPanel } from '../features/settings/SettingsBackupPanel'
import { LoginScreen, SignOutButton } from '../features/auth/AuthenticationScreens'
import { AboutScreen, InstallGuide } from '../pwa/InstallGuide'
import { UpdateBanner } from '../pwa/UpdateBanner'
import { UiIcon } from './UiIcon'
import { localizedError, useI18n } from './i18n'

type Page = 'library' | 'generate' | 'performance' | 'tonight' | 'about'
type AppRepository = ScoreRepository & PerformanceRepository
type AuthenticationState = 'checking' | 'required' | 'authenticated'

export function App({ repository = browserRepository, authentication = cloudAuthentication }: { repository?: AppRepository; authentication?: AuthenticationClient }) {
  const { locale, t } = useI18n()
  const [scores, setScores] = useState<Score[]>([])
  const [collections, setCollections] = useState<string[]>([])
  const [lastScan, setLastScan] = useState<FolderScan>()
  const [setLists, setSetLists] = useState<SavedSetList[]>([])
  const [savedSets, setSavedSets] = useState<SavedSet[]>([])
  const [currentSetList, setCurrentSetList] = useState<SavedSetList>()
  const [tonight, setTonight] = useState<SavedSetList>()
  const [preview, setPreview] = useState<ReconciliationPlan>()
  const [applying, setApplying] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [page, setPage] = useState<Page>('library')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [authenticationState, setAuthenticationState] = useState<AuthenticationState>(authentication ? 'checking' : 'authenticated')
  const [editingScore, setEditingScore] = useState(false)

  useEffect(() => {
    if (!authentication) return
    void authentication.hasSession()
      .then((authenticated) => setAuthenticationState(authenticated ? 'authenticated' : 'required'))
      .catch((error: unknown) => setAuthenticationState(error instanceof CloudApiError ? 'required' : 'authenticated'))
  }, [authentication])

  useEffect(() => {
    if (authenticationState !== 'authenticated') return
    setLoading(true)
    let active = true
    let loadedTonight: SavedSetList | undefined
    void repository.getTonightSetList().then((selected) => {
      if (!active) return undefined
      loadedTonight = selected
      setTonight(selected)
      if (selected) { setPage('tonight'); setLoading(false) }
      return Promise.all([repository.listScores(), repository.getLastScan(), repository.getLastPerformance(), repository.listSetLists(), repository.listSavedSets(), repository.listCollections()])
    })
      .then((loaded) => {
        if (!active || !loaded) return
        const [loadedScores, scan, savedPerformance, savedSetLists, loadedSavedSets, loadedCollections] = loaded
        setScores(loadedScores)
        setCollections(loadedCollections)
        setLastScan(scan)
        setSetLists(savedSetLists)
        setSavedSets(loadedSavedSets)
        if (savedPerformance) {
          setCurrentSetList(savedSetLists.find((saved) => saved.id === savedPerformance.id) ?? {
            id: savedPerformance.id,
            name: '',
            createdAt: savedPerformance.generatedAt,
            updatedAt: savedPerformance.generatedAt,
            performance: savedPerformance,
          })
          if (!loadedTonight) setPage('performance')
        } else if (savedSetLists[0]) {
          setCurrentSetList(savedSetLists[0])
          if (!loadedTonight) setPage('performance')
        }
      })
      .catch((error: unknown) => {
        if (!active) return
        if (authentication && error instanceof CloudApiError && error.status === 401) setAuthenticationState('required')
        else if (!loadedTonight) setLoadError(localizedError(error, locale, t('localStorageUnavailable')))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [authentication, authenticationState, locale, repository, t])

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
      setCollections(await repository.listCollections())
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
    if (configuration.drummerNotes !== undefined || configuration.drummerTiming !== undefined) await refreshSavedNotes()
  }

  const refreshSavedNotes = async () => {
    const [lists, reusable, last] = await Promise.all([repository.listSetLists(), repository.listSavedSets(), repository.getLastPerformance()])
    setSetLists(lists)
    setSavedSets(reusable)
    setCurrentSetList((current) => current ? lists.find((list) => list.id === current.id) ?? (last?.id === current.id ? { ...current, performance: last } : current) : current)
  }

  const saveBulkConfiguration = async (ids: string[], changes: BulkConfiguration) => {
    await repository.saveBulkConfiguration(ids, changes, new Date().toISOString())
    setScores(await repository.listScores())
  }

  const renameCollection = async (previous: string, name: string) => {
    await repository.renameCollection(previous, name)
    setScores(await repository.listScores())
    setCollections(await repository.listCollections())
    setSetLists(await repository.listSetLists())
    setSavedSets(await repository.listSavedSets())
    const performance = await repository.getLastPerformance()
    if (performance) setCurrentSetList((current) => current ? { ...current, performance } : current)
  }

  const createCollection = async (name: string) => {
    await repository.createCollection(name)
    setCollections(await repository.listCollections())
  }

  const deleteScore = async (id: string) => {
    await repository.deleteScore(id)
    setScores(await repository.listScores())
    setCollections(await repository.listCollections())
  }

  const assignCollection = async (ids: string[], name: string) => {
    await repository.assignCollection(ids, name, new Date().toISOString())
    setScores(await repository.listScores())
    setCollections(await repository.listCollections())
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

  const setListLock = async (id: string, locked: boolean) => {
    const saved = await repository.setSetListLocked(id, locked, new Date().toISOString())
    setSetLists(await repository.listSetLists())
    setCurrentSetList(saved)
  }

  const loadTonight = async (saved: SavedSetList) => {
    await repository.saveTonightSetList(saved)
    setTonight(structuredClone(saved))
    setPage('tonight')
  }

  const clearTonight = async () => {
    await repository.clearTonightSetList()
    setTonight(undefined)
  }

  const saveReusableSet = async (set: PerformanceSet): Promise<SavedSet> => {
    const now = new Date().toISOString()
    const existing = savedSets.find((saved) => saved.id === set.savedSetId)
    const saved: SavedSet = {
      id: existing?.id ?? createLocalId(),
      name: set.name?.trim() || `${t('set')} ${set.number}`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(set.orderOverride === undefined ? {} : { orderOverride: set.orderOverride }),
      scores: set.scores,
    }
    await repository.saveSavedSet(saved)
    setSavedSets(await repository.listSavedSets())
    return saved
  }

  const createProgram = async (savedSet: SavedSet) => {
    await saveSetList(createProgramFromSavedSet(savedSet, new Date().toISOString(), createLocalId()))
    setPage('performance')
  }

  const createManualProgram = async (starter: Score) => {
    await saveSetList(createProgramFromStarter(starter, new Date().toISOString(), createLocalId()))
    setPage('performance')
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
    await refreshSavedNotes()
    return report
  }

  if (authentication && authenticationState !== 'authenticated') return <LoginScreen loadSiteKey={() => authentication.loadTurnstileSiteKey()} onLogin={async (password, verificationToken) => { await authentication.login(password, verificationToken); window.location.reload() }} />
  if (loading) return <main id="main-content" className="loading-screen"><div className="hero-mark"><UiIcon name="music" /></div><p>{t('loadingLibrary')}</p></main>
  if (loadError) return <main id="main-content" className="loading-screen"><h1>Piece Selector</h1><p className="error" role="alert">{loadError}</p></main>

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{t('skipToContent')}</a>
      <header className="app-header"><span className="app-logo" aria-hidden="true"><UiIcon name="music" /></span><strong>Piece Selector</strong></header>
      <InstallGuide />
      <UpdateBanner />
      <main id="main-content">
        {preview ? <ReconciliationPreview plan={preview} applying={applying} error={previewError} onApply={apply} onCancel={() => { setPreview(undefined); setPreviewError('') }} />
          : page === 'library' ? <LibraryScreen scores={scores} collections={collections} lastScan={lastScan} onFolder={rescan} onSave={saveConfiguration} onBulkSave={saveBulkConfiguration} onRenameCollection={renameCollection} onCreateCollection={createCollection} onAssignCollection={assignCollection} onDelete={deleteScore} onEditingChange={setEditingScore} />
            : page === 'generate' ? <GenerateScreen scores={scores} collections={collections} hasPerformance={Boolean(currentSetList)} onGenerated={savePerformance} />
              : page === 'performance' ? <PerformanceScreen scores={scores} setList={currentSetList} savedSetLists={setLists} savedSets={savedSets} onSave={saveSetList} onSaveSavedSet={saveReusableSet} onCreateProgram={createProgram} onCreateManualProgram={createManualProgram} onSelect={selectSetList} onImport={importSetList} onRegenerate={() => setPage('generate')} onLockChange={setListLock} onTonight={loadTonight} />
                : page === 'tonight' ? <TonightScreen setList={tonight} savedSetLists={setLists} onLoad={loadTonight} onClear={clearTonight} onManage={() => setPage('performance')} />
                : <AboutScreen><SettingsBackupPanel scores={scores} onImport={importSettings} />{authentication && <SignOutButton onLogout={async () => { await authentication.logout(); window.location.reload() }} />}</AboutScreen>}
      </main>
      {!preview && !editingScore && <nav className="bottom-nav" aria-label={t('primaryNavigation')}>{([['library', t('library')], ['generate', t('build')], ['performance', t('sets')], ['tonight', t('tonight')], ['about', t('about')]] as const).map(([target, label]) => <button type="button" key={target} aria-current={page === target ? 'page' : undefined} onClick={() => setPage(target)}><UiIcon name={target === 'library' ? 'library' : target === 'generate' ? 'sparkles' : target === 'performance' ? 'sets' : target === 'tonight' ? 'moon' : 'info'} />{label}</button>)}</nav>}
    </div>
  )
}
