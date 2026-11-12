import Dexie from 'dexie'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PieceSelectorDatabase } from '../data/database'
import { PieceSelectorRepository } from '../data/repository'
import { makeSetList } from '../test/fixtures'
import { App } from './App'

describe('tonight navigation and launch', () => {
  it('loads a locked program from Tonight and opens it after relaunch', async () => {
    const user = userEvent.setup()
    const name = `tonight-app-${crypto.randomUUID()}`
    const database = new PieceSelectorDatabase(name)
    const repository = new PieceSelectorRepository(database)
    const saved = makeSetList({ locked: true })
    await repository.saveSetList(saved)
    const { unmount } = render(<App repository={repository} />)
    await screen.findByRole('heading', { name: 'Evening' })
    await user.click(screen.getByRole('button', { name: 'Tonight' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Locked setlists' }), saved.id)
    await user.click(screen.getByRole('button', { name: 'Load for tonight' }))
    await screen.findByRole('button', { name: 'Change tonight’s setlist' })
    unmount()
    database.close()
    const reopened = new PieceSelectorDatabase(name)
    const offline = new PieceSelectorRepository(reopened)
    vi.spyOn(offline, 'listScores').mockImplementation(() => new Promise(() => undefined))
    render(<App repository={offline} authentication={{ hasSession: () => Promise.reject(new TypeError('offline')), loadTurnstileSiteKey: () => new Promise(() => undefined), login: () => Promise.resolve(), logout: () => Promise.resolve() }} />)
    expect(await screen.findByRole('heading', { name: 'Tonight' })).toBeVisible()
    expect(screen.getByText('Take On Me')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Tonight' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button', { name: 'Unlock setlist' })).not.toBeInTheDocument()
    reopened.close()
    await Dexie.delete(name)
  })
})
