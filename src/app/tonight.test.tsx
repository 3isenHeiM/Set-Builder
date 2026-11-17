import Dexie from 'dexie'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PieceSelectorDatabase } from '../data/database'
import { PieceSelectorRepository } from '../data/repository'
import { CloudRepository, CloudStateTransport } from '../data/cloudRepository'
import { makeScore, makeSetList } from '../test/fixtures'
import { emptyDrummerTiming } from '../domain/drummerNotes'
import { App } from './App'

describe('tonight navigation and launch', () => {
  beforeEach(() => localStorage.removeItem('piece-selector-shared-drummer-notes'))
  it.each([{ savedTiming: undefined, offline: false }, { savedTiming: emptyDrummerTiming(), offline: true }])('shows Library details when toggled on for an older Tonight copy (%j)', async ({ savedTiming, offline }) => {
    const name = `tonight-missing-notes-${crypto.randomUUID()}`
    const database = new PieceSelectorDatabase(name)
    const local = new PieceSelectorRepository(database)
    const repository = offline ? new CloudRepository(database, new CloudStateTransport(() => Promise.reject(new TypeError('offline')))) : local
    const saved = makeSetList({ locked: true })
    if (savedTiming) saved.performance.sets[0]!.scores[0]!.drummerTiming = savedTiming
    const frozen = structuredClone(saved)
    await database.scores.put(makeScore({ drummerTiming: { bpm: 144, beat: 'quarter', measure: '6/8', anacrusis: 1.5 }, drummerNotes: 'Quiet verse' }))
    await local.saveSetList(saved)
    await local.saveTonightSetList(saved)
    try {
      render(<App repository={repository} />)
      await screen.findByRole('heading', { name: 'Tonight' })
      expect(screen.queryByRole('note')).not.toBeInTheDocument()
      await userEvent.setup().click(screen.getByRole('switch', { name: 'Drummer notes' }))
      expect(await screen.findByRole('img', { name: 'Tempo: 144 Quarter note per minute' })).toBeVisible()
      expect(screen.getByRole('img', { name: 'Measure: 6/8' })).toBeVisible()
      expect(screen.getByRole('note')).toHaveTextContent('Pickup 1½ beatsQuiet verse')
      expect(await repository.getTonightSetList()).toEqual(frozen)
      expect((await repository.listSetLists())[0]).toEqual(frozen)
    } finally { cleanup(); database.close(); await Dexie.delete(name) }
  })

  it('loads a locked program from Tonight and opens it after relaunch', async () => {
    const user = userEvent.setup()
    const name = `tonight-app-${crypto.randomUUID()}`
    const database = new PieceSelectorDatabase(name)
    const repository = new PieceSelectorRepository(database)
    const saved = makeSetList({ locked: true })
    Object.assign(saved.performance.sets[0]!.scores[0]!, { drummerTiming: { bpm: 120, beat: 'half', measure: '4/4', anacrusis: null } })
    await repository.saveSetList(saved)
    const { unmount } = render(<App repository={repository} />)
    await screen.findByRole('heading', { name: 'Evening' })
    await user.click(screen.getByRole('button', { name: 'Tonight' }))
    expect(screen.queryByRole('status', { name: 'Program summary' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Locked setlists' }), saved.id)
    await user.click(screen.getByRole('button', { name: 'Load for tonight' }))
    await screen.findByRole('button', { name: 'Change tonight’s setlist' })
    expect(screen.getByRole('status', { name: 'Program summary' })).toHaveTextContent('1 set · 1 piece')
    await user.click(screen.getByRole('switch', { name: 'Drummer notes' }))
    unmount()
    database.close()
    const reopened = new PieceSelectorDatabase(name)
    const offline = new PieceSelectorRepository(reopened)
    vi.spyOn(offline, 'listScores').mockImplementation(() => new Promise(() => undefined))
    render(<App repository={offline} authentication={{ hasSession: () => Promise.reject(new TypeError('offline')), loadTurnstileSiteKey: () => new Promise(() => undefined), login: () => Promise.resolve(), logout: () => Promise.resolve() }} />)
    expect(await screen.findByRole('heading', { name: 'Tonight' })).toBeVisible()
    expect(screen.getByRole('status', { name: 'Program summary' })).toHaveTextContent('1 set · 1 piece')
    expect(screen.getByText('Take On Me')).toBeVisible()
    expect(screen.getByRole('switch', { name: 'Drummer notes' })).toBeChecked()
    expect(screen.getByRole('img', { name: 'Tempo: 120 Half note per minute' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Tonight' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button', { name: 'Unlock setlist' })).not.toBeInTheDocument()
    reopened.close()
    await Dexie.delete(name)
  })
})
