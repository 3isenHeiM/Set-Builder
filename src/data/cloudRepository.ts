import { configurationStatus } from '../domain/configuration'
import { applyReconciliation as applyReconciliationToScores } from '../domain/reconciliation'
import { applySettingsBackup } from '../domain/settingsBackup'
import type { SettingsBackup, SettingsImportReport } from '../domain/settingsBackup'
import type {
  FolderScan,
  GeneratedPerformance,
  ReconciliationPlan,
  RenumberingDecisions,
  SavedSetList,
  Score,
  ScoreConfiguration,
} from '../domain/types'
import { hasCloudData, type CloudState, type CloudStateEnvelope, parseCloudEnvelope } from './cloudState'
import { readCachedState, readSyncRecord, replaceCachedState } from './cloudCache'
import type { PieceSelectorDatabase } from './database'
import type { PerformanceRepository, ScoreRepository } from './repository'

export type CloudFetch = (input: string, init?: RequestInit) => Promise<Response>

export class CloudApiError extends Error {}

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
  return response.status === 401 || response.status === 403
    ? 'Cloudflare Access authentication is required.'
    : `Cloud storage request failed (${response.status}).`
}

export class CloudStateTransport {
  constructor(private readonly fetchRequest: CloudFetch, private readonly path = '/api/state') {}

  async read(): Promise<CloudStateEnvelope> {
    const response = await this.fetchRequest(this.path, { credentials: 'same-origin', headers: { accept: 'application/json' } })
    if (response.redirected) throw new CloudApiError('Cloudflare Access authentication is required.')
    if (!response.ok) throw new CloudApiError(await readError(response))
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
    if (response.redirected) throw new CloudApiError('Cloudflare Access authentication is required.')
    if (!response.ok) throw new CloudApiError(await readError(response))
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
      } else if (cachedState && hasCloudData(cachedState) && remote.revision === 0 && !sync?.connected) {
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
      await replaceCachedState(this.database, state, { key: 'cloud', connected: this.connected, revision: this.revision, pending })
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

  saveConfiguration(id: string, configuration: ScoreConfiguration, updatedAt: string): Promise<void> {
    return this.change((state) => {
      const current = state.scores.find((score) => score.id === id)
      if (!current) throw new Error('This score no longer exists.')
      const updated: Score = {
        ...current,
        canStart: configuration.canStart,
        hotness: configuration.hotness,
        drumsIntro: configuration.drumsIntro,
        goesHigh: configuration.goesHigh,
        enabled: configuration.enabled,
        tags: configuration.in80s ? ['80s'] : [],
        configuration: configurationStatus(configuration),
        updatedAt,
      }
      return { result: undefined, state: { ...state, scores: state.scores.map((score) => score.id === id ? updated : score) } }
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
      return { result: reconciliation.scan, state: { ...state, scores: reconciliation.scores, lastScan: reconciliation.scan } }
    })
  }

  async getLastScan(): Promise<FolderScan | undefined> {
    await this.ready()
    return this.state?.lastScan ?? undefined
  }

  importSettings(backup: SettingsBackup, updatedAt: string): Promise<SettingsImportReport> {
    return this.change((state) => {
      const imported = applySettingsBackup(state.scores, backup, updatedAt)
      return { result: imported.report, state: { ...state, scores: imported.scores } }
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
}
