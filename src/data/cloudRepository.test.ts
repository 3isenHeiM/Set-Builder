import Dexie from 'dexie'
import { makeScore } from '../test/fixtures'
import { CloudRepository, CloudStateTransport } from './cloudRepository'
import { emptyCloudState } from './cloudState'
import { PieceSelectorDatabase } from './database'

function databaseName(): string {
  return `piece-selector-cloud-test-${crypto.randomUUID()}`
}

function response(revision: number, state = emptyCloudState()): Response {
  return Response.json({ revision, state })
}

function bodySource(body: BodyInit | null | undefined): string {
  if (typeof body !== 'string') throw new Error('Expected a JSON request body.')
  return body
}

describe('cloud repository', () => {
  it('saves a bulk edit in one cloud state update', async () => {
    const database = new PieceSelectorDatabase(databaseName())
    const initial = { ...emptyCloudState(), scores: [makeScore(), makeScore({ id: 'two', scoreNumber: 2, displayNumber: '02', hotness: 3 })] }
    const fetchRequest = vi.fn((_input: string, init?: RequestInit) => {
      if (init?.method !== 'PUT') return Promise.resolve(response(1, initial))
      const upload = JSON.parse(bodySource(init.body)) as { state: ReturnType<typeof emptyCloudState> }
      return Promise.resolve(response(2, upload.state))
    })
    const repository = new CloudRepository(database, new CloudStateTransport(fetchRequest))
    await repository.saveBulkConfiguration(['score-1', 'two'], { in80s: true }, '2026-09-10T10:00:00.000Z')
    expect(fetchRequest).toHaveBeenCalledTimes(2)
    expect((await repository.listScores()).map((score) => [score.hotness, score.tags])).toEqual([[2, ['80s']], [3, ['80s']]])
    database.close()
  })
  it('migrates an existing device library when authenticated D1 storage is empty', async () => {
    const database = new PieceSelectorDatabase(databaseName())
    await database.scores.put(makeScore())
    const requests: RequestInit[] = []
    const fetchRequest = vi.fn((_input: string, init?: RequestInit) => {
      requests.push(init ?? {})
      if (init?.method === 'PUT') {
        const upload = JSON.parse(bodySource(init.body)) as { state: unknown }
        return Promise.resolve(response(1, upload.state as ReturnType<typeof emptyCloudState>))
      }
      return Promise.resolve(response(0))
    })
    const repository = new CloudRepository(database, new CloudStateTransport(fetchRequest))

    expect(await repository.listScores()).toHaveLength(1)
    expect(requests.map((request) => request.method ?? 'GET')).toEqual(['GET', 'PUT'])
    const sync = await database.cloudSync.get('cloud')
    expect(sync).toMatchObject({ connected: true, revision: 1, pending: null })
    database.close()
  })

  it('uses authenticated D1 data instead of a stale device copy', async () => {
    const database = new PieceSelectorDatabase(databaseName())
    await database.scores.put(makeScore({ title: 'Old local title' }))
    await database.cloudSync.put({ key: 'cloud', connected: true, revision: 1, pending: null, backend: 'signed-cookie-v1' })
    const remote = { ...emptyCloudState(), scores: [makeScore({ title: 'D1 title' })] }
    const repository = new CloudRepository(database, new CloudStateTransport(() => Promise.resolve(response(2, remote))))

    expect(await repository.getScore('score-1')).toMatchObject({ title: 'D1 title' })
    expect(await database.scores.get('score-1')).toMatchObject({ title: 'D1 title' })
    database.close()
  })

  it('migrates a connected Access-era device cache into the first shared-password state', async () => {
    const database = new PieceSelectorDatabase(databaseName())
    await database.scores.put(makeScore())
    await database.cloudSync.put({ key: 'cloud', connected: true, revision: 5, pending: null })
    const fetchRequest = vi.fn((_input: string, init?: RequestInit) => {
      if (init?.method !== 'PUT') return Promise.resolve(response(0))
      const upload = JSON.parse(bodySource(init.body)) as { state: ReturnType<typeof emptyCloudState> }
      return Promise.resolve(response(1, upload.state))
    })

    expect(await new CloudRepository(database, new CloudStateTransport(fetchRequest)).listScores()).toHaveLength(1)
    expect(fetchRequest).toHaveBeenCalledTimes(2)
    expect(await database.cloudSync.get('cloud')).toMatchObject({ backend: 'signed-cookie-v1' })
    database.close()
  })

  it('queues offline changes and uploads them when the app reconnects', async () => {
    const name = databaseName()
    const database = new PieceSelectorDatabase(name)
    await database.scores.put(makeScore())
    const firstRepository = new CloudRepository(database, new CloudStateTransport(() => Promise.reject(new TypeError('offline'))))
    await firstRepository.saveConfiguration('score-1', { canStart: true, hotness: 3, drumsIntro: false, goesHigh: false, enabled: true, in80s: false }, '2026-02-01T10:00:00.000Z')
    expect((await database.cloudSync.get('cloud'))?.pending?.scores[0]).toMatchObject({ hotness: 3 })

    const secondDatabase = new PieceSelectorDatabase(name)
    const fetchRequest = vi.fn((_input: string, init?: RequestInit) => {
      if (init?.method !== 'PUT') return Promise.resolve(response(2))
      const upload = JSON.parse(bodySource(init.body)) as { state: ReturnType<typeof emptyCloudState> }
      return Promise.resolve(response(3, upload.state))
    })
    const reopened = new CloudRepository(secondDatabase, new CloudStateTransport(fetchRequest))
    expect(await reopened.getScore('score-1')).toMatchObject({ hotness: 3 })
    expect((await secondDatabase.cloudSync.get('cloud'))?.pending).toBeNull()
    database.close()
    secondDatabase.close()
    await Dexie.delete(name)
  })

  it('does not silently fall back to browser state when the session is rejected', async () => {
    const database = new PieceSelectorDatabase(databaseName())
    await database.scores.put(makeScore())
    const repository = new CloudRepository(database, new CloudStateTransport(() => Promise.resolve(Response.json({ error: 'Authentication is required.' }, { status: 401 }))))

    await expect(repository.listScores()).rejects.toMatchObject({ message: 'Authentication is required.', status: 401 })
    database.close()
  })

  it('writes configuration through the remote API before using its cache', async () => {
    const database = new PieceSelectorDatabase(databaseName())
    const initial = { ...emptyCloudState(), scores: [makeScore()] }
    const fetchRequest = vi.fn((_input: string, init?: RequestInit) => {
      if (init?.method !== 'PUT') return Promise.resolve(response(1, initial))
      const upload = JSON.parse(bodySource(init.body)) as { state: ReturnType<typeof emptyCloudState> }
      return Promise.resolve(response(2, upload.state))
    })
    const repository = new CloudRepository(database, new CloudStateTransport(fetchRequest))
    await repository.saveConfiguration('score-1', { canStart: true, hotness: 1, drumsIntro: true, goesHigh: true, enabled: true, in80s: true }, '2026-02-01T10:00:00.000Z')

    expect(await repository.getScore('score-1')).toMatchObject({ hotness: 1, goesHigh: true, tags: ['80s'] })
    expect(fetchRequest).toHaveBeenCalledTimes(2)
    database.close()
  })
})
