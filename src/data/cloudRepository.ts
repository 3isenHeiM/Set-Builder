import { applyBulkConfiguration, configurationStatus } from '../domain/configuration'
import { readDrummerNotes, updateSavedDrummerNotes } from '../domain/drummerNotes'
import { applyReconciliation as applyReconciliationToScores } from '../domain/reconciliation'
import { applySettingsBackup } from '../domain/settingsBackup'
import type { SettingsBackup, SettingsImportReport } from '../domain/settingsBackup'
import type {
  FolderScan,
  BulkConfiguration,
  GeneratedPerformance,
  ReconciliationPlan,
  RenumberingDecisions,
  SavedSet,
  SavedSetList,
  Score,
  ScoreConfiguration,
} from '../domain/types'
import { hasCloudData, type CloudState, type CloudStateEnvelope, parseCloudEnvelope } from './cloudState'
import { readCachedState, readSyncRecord, replaceCachedState } from './cloudCache'
import { assignPiecesToCollection, collectionKey, collectionNames, createCollectionNames, pieceKey, renameCollectionData } from '../domain/collections'
import type { PieceSelectorDatabase } from './database'
import type { PerformanceRepository, ScoreRepository } from './repository'

export type CloudFetch = (input: string, init?: RequestInit) => Promise<Response>

export class CloudApiError extends Error {
  constructor(message: string, readonly status: number | undefined = undefined) {
    super(message)
  }
}

function operationId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${crypto.getRandomValues(new Uint32Array(2)).join('-')}`
}

function asApiError(error: unknown): CloudApiError {
  return new CloudApiError(error instanceof Error ? error.message : 'Cloud storage returned an unreadable response.')
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown }
    if (typeof body.error === 'string') return body.error
  } catch {
    // Access can return an HTML login response after a session expires.
  }
  return response.status === 401
    ? 'Authentication is required.'
    : `Cloud storage request failed (${response.status}).`
}

export class CloudStateTransport {
  constructor(private readonly fetchRequest: CloudFetch, private readonly path = '/api/state') {}

  async read(): Promise<CloudStateEnvelope> {
    const response = await this.fetchRequest(this.path, { credentials: 'same-origin', headers: { accept: 'application/json' } })
    if (!response.ok) throw new CloudApiError(await readError(response), response.status)
    try {
      return parseCloudEnvelope(await response.json())
    } catch (error) {
      throw asApiError(error)
    }
  }

  async write(state: CloudState): Promise<CloudStateEnvelope> {
    const response = await this.fetchRequest(this.path, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ operationId: operationId(), state }),
    })
    if (!response.ok) throw new CloudApiError(await readError(response), response.status)
    try {
      return parseCloudEnvelope(await response.json())
    } catch (error) {
      throw asApiError(error)
    }
  }
}

interface StateChange<T> {
  state: CloudState
  result: T
}

export class CloudRepository implements ScoreRepository, PerformanceRepository {
  private state: CloudState | undefined
  private revision = 0
  private connected = false
  private initialization: Promise<void> | undefined
  private writeChain = Promise.resolve()

  constructor(private readonly database: PieceSelectorDatabase, private readonly transport: CloudStateTransport) {}

  async listCollections(): Promise<string[]> {
    await this.ready()
    return this.state?.collections ?? ['General']
  }

  createCollection(name: string): Promise<void> {
    return this.change((state) => ({ result: undefined, state: { ...state, collections: createCollectionNames(state.scores, state.collections, name) } }))
  }

  assignCollection(ids: string[], name: string, updatedAt: string): Promise<void> {
    return this.change((state) => {
      const target = state.collections.find((value) => collectionKey(value) === collectionKey(name))
      if (!target) throw new Error('Collection no longer exists.')
      return { result: undefined, state: { ...state, scores: assignPiecesToCollection(state.scores, ids, target, updatedAt) } }
    })
  }

  renameCollection(previous: string, name: string): Promise<void> {
    return this.change((state) => ({ result: undefined, state: { ...state, ...renameCollectionData(state, previous, name) } }))
  }

  private ready(): Promise<void> {
    this.initialization ??= this.initialize()
    return this.initialization
  }

  private async initialize(): Promise<void> {
    let cachedState: CloudState | undefined
    let cacheError: unknown
    try {
      cachedState = await readCachedState(this.database)
    } catch (error) {
      cacheError = error
    }

    let sync: Awaited<ReturnType<typeof readSyncRecord>>
    try {
      sync = await readSyncRecord(this.database)
    } catch {
      sync = undefined
    }

    try {
      let remote = await this.transport.read()
      if (sync?.pending) {
        remote = await this.transport.write(sync.pending)
      } else if (cachedState && hasCloudData(cachedState) && remote.revision === 0 && sync?.backend !== 'signed-cookie-v1') {
        remote = await this.transport.write(cachedState)
      }
      this.state = remote.state
      this.revision = remote.revision
      this.connected = true
      await this.updateCache(remote.state, null, false)
    } catch (error) {
      if (error instanceof CloudApiError) throw error
      if (!cachedState) throw cacheError ?? error
      this.state = cachedState
      this.revision = sync?.revision ?? 0
      this.connected = sync?.connected ?? false
    }
  }

  private async updateCache(state: CloudState, pending: CloudState | null, required: boolean): Promise<void> {
    try {
      await replaceCachedState(this.database, state, { key: 'cloud', connected: this.connected, revision: this.revision, pending, backend: 'signed-cookie-v1' })
    } catch (error) {
      if (required) throw error
    }
  }

  private async persist(nextState: CloudState): Promise<void> {
    try {
      const remote = await this.transport.write(nextState)
      this.state = remote.state
      this.revision = remote.revision
      this.connected = true
      await this.updateCache(remote.state, null, false)
    } catch (error) {
      if (error instanceof CloudApiError) throw error
      this.state = nextState
      await this.updateCache(nextState, nextState, true)
    }
  }

  private change<T>(createChange: (state: CloudState) => StateChange<T>): Promise<T> {
    const result = this.writeChain.then(async () => {
      await this.ready()
      if (!this.state) throw new Error('The library is unavailable.')
      const change = createChange(this.state)
      await this.persist(change.state)
      return change.result
    })
    this.writeChain = result.then(() => undefined, () => undefined)
    return result
  }

  async listScores(): Promise<Score[]> {
    await this.ready()
    return this.state?.scores ?? []
  }

  async getScore(id: string): Promise<Score | undefined> {
    await this.ready()
    return this.state?.scores.find((score) => score.id === id)
  }

  deleteScore(id: string): Promise<void> {
    return this.change((state) => {
      if (!state.scores.some((score) => score.id === id)) throw new Error('This score no longer exists.')
      return { result: undefined, state: { ...state, scores: state.scores.filter((score) => score.id !== id) } }
    })
  }

  saveConfiguration(id: string, configuration: ScoreConfiguration, updatedAt: string): Promise<void> {
    return this.change((state) => {
      const current = state.scores.find((score) => score.id === id)
      if (!current) throw new Error('This score no longer exists.')
      const updated: Score = {
        ...current,
        canStart: configuration.canStart,
        hotness: configuration.hotness,
        drumsIntro: configuration.drumsIntro,
        drummerNotes: configuration.drummerNotes === undefined ? readDrummerNotes(current.drummerNotes) : readDrummerNotes(configuration.drummerNotes),
        goesHigh: configuration.goesHigh,
        enabled: configuration.enabled,
        tags: configuration.in80s === undefined ? current.tags : configuration.in80s ? ['80s'] : [],
        configuration: configurationStatus(configuration),
        updatedAt,
      }
      const notes = configuration.drummerNotes === undefined ? {} : updateSavedDrummerNotes(state, [updated], updatedAt)
      return { result: undefined, state: { ...state, ...notes, scores: state.scores.map((score) => score.id === id ? updated : score) } }
    })
  }

  saveBulkConfiguration(ids: string[], changes: BulkConfiguration, updatedAt: string): Promise<void> {
    return this.change((state) => {
      const selected = new Set(ids)
      if (state.scores.filter((score) => selected.has(score.id)).length !== selected.size) throw new Error('This score no longer exists.')
      return { result: undefined, state: { ...state, scores: state.scores.map((score) => selected.has(score.id) ? applyBulkConfiguration(score, changes, updatedAt) : score) } }
    })
  }

  applyReconciliation(
    plan: ReconciliationPlan,
    decisions: RenumberingDecisions,
    appliedAt: string,
    createId: () => string,
  ): Promise<FolderScan> {
    return this.change((state) => {
      const scanId = createId()
      const reconciliation = applyReconciliationToScores(state.scores, plan, decisions, appliedAt, createId, scanId)
      return { result: reconciliation.scan, state: { ...state, scores: reconciliation.scores, collections: collectionNames(reconciliation.scores, [...state.collections, ...(plan.collection ? [plan.collection] : [])]), lastScan: reconciliation.scan } }
    })
  }

  async getLastScan(): Promise<FolderScan | undefined> {
    await this.ready()
    return this.state?.lastScan ?? undefined
  }

  importSettings(backup: SettingsBackup, updatedAt: string): Promise<SettingsImportReport> {
    return this.change((state) => {
      const imported = applySettingsBackup(state.scores, backup, updatedAt)
      const noteKeys = new Set(backup.pieces.filter((piece) => piece.settings.drummerNotes !== undefined).map(pieceKey))
      const notes = updateSavedDrummerNotes(state, imported.scores.filter((score) => noteKeys.has(pieceKey(score))), updatedAt)
      return { result: imported.report, state: { ...state, ...notes, scores: imported.scores } }
    })
  }

  saveLastPerformance(performance: GeneratedPerformance): Promise<void> {
    return this.change((state) => ({ result: undefined, state: { ...state, lastPerformance: performance } }))
  }

  async getLastPerformance(): Promise<GeneratedPerformance | undefined> {
    await this.ready()
    return this.state?.lastPerformance ?? undefined
  }

  async listSetLists(): Promise<SavedSetList[]> {
    await this.ready()
    return this.state?.setLists ?? []
  }

  saveSetList(setList: SavedSetList): Promise<void> {
    return this.change((state) => ({
      result: undefined,
      state: {
        ...state,
        lastPerformance: setList.performance,
        setLists: [setList, ...state.setLists.filter((saved) => saved.id !== setList.id)]
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      },
    }))
  }

  async listSavedSets(): Promise<SavedSet[]> {
    await this.ready()
    return this.state?.savedSets ?? []
  }

  saveSavedSet(savedSet: SavedSet): Promise<void> {
    return this.change((state) => ({
      result: undefined,
      state: {
        ...state,
        savedSets: [savedSet, ...state.savedSets.filter((set) => set.id !== savedSet.id)]
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      },
    }))
  }
}
