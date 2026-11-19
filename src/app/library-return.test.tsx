import Dexie from 'dexie'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PieceSelectorDatabase } from '../data/database'
import { PieceSelectorRepository } from '../data/repository'
import { makeScore } from '../test/fixtures'
import { App } from './App'

let database: PieceSelectorDatabase | undefined
afterEach(async () => {
  cleanup()
  if (database) { database.close(); await Dexie.delete(database.name); database = undefined }
})

async function openLibrary(multipleCollections = false) {
  database = new PieceSelectorDatabase(`library-return-${crypto.randomUUID()}`)
  const repository = new PieceSelectorRepository(database)
  await database.scores.bulkPut(Array.from({ length: 30 }, (_, index) => makeScore({ id: `piece-${index + 1}`, scoreNumber: index + 1, displayNumber: String(index + 1).padStart(2, '0'), title: `Parade piece ${index + 1}` })))
  if (multipleCollections) await database.scores.put(makeScore({ id: 'bells', title: 'Bells', collection: 'Christmas' }))
  const view = render(<App repository={repository} />)
  await screen.findByRole('heading', { name: 'Library' })
  return { repository, user: userEvent.setup(), scroller: view.container.querySelector<HTMLDivElement>('.app-scroll')!, container: view.container }
}

function swipeBack(editor: Element) {
  fireEvent.touchStart(editor, { touches: [{ identifier: 1, clientX: 30, clientY: 100 }] })
  fireEvent.touchMove(editor, { touches: [{ identifier: 1, clientX: 180, clientY: 112 }] })
  fireEvent.touchEnd(editor, { touches: [], changedTouches: [{ identifier: 1, clientX: 180, clientY: 112 }] })
}

describe('returning to the Library', () => {
  it('restores expanded collections and management controls along with scroll and row focus', async () => {
    const { user, scroller } = await openLibrary(true)
    await user.click(screen.getByRole('button', { name: /General 30 pieces/ }))
    await user.click(screen.getByText('Manage library', { selector: 'summary span' }))
    scroller.scrollTop = 900
    await user.click(screen.getByRole('button', { name: /17 Parade piece 17/ }))
    expect(scroller.scrollTop).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('button', { name: /General 30 pieces/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Christmas 1 piece/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Manage library', { selector: 'summary span' }).closest('details')).toHaveAttribute('open')
    expect(scroller.scrollTop).toBe(900)
    expect(screen.getByRole('button', { name: /17 Parade piece 17/ })).toHaveFocus()
  })

  it.each(['Back', 'Save score', 'swipe'])('restores scroll, filters, and row focus after %s while preserving the note', async (method) => {
    const { repository, user, scroller, container } = await openLibrary()
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'Parade')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'active')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Collection' }), 'General')
    scroller.scrollTop = 984
    await user.click(screen.getByRole('button', { name: /17 Parade piece 17/ }))
    expect(await screen.findByRole('heading', { name: 'Parade piece 17' })).toBeVisible()
    expect(scroller.scrollTop).toBe(0)
    scroller.scrollTop = 150
    fireEvent.change(screen.getByRole('textbox', { name: /Custom drummer note/ }), { target: { value: 'Keep the beat' } })
    if (method === 'swipe') swipeBack(container.querySelector('.editor-panel')!)
    else await user.click(screen.getByRole('button', { name: method }))
    await screen.findByRole('heading', { name: 'Library' })
    expect(scroller.scrollTop).toBe(984)
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('Parade')
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('active')
    expect(screen.getByRole('combobox', { name: 'Collection' })).toHaveValue('General')
    expect(screen.getByRole('button', { name: /17 Parade piece 17/ })).toHaveFocus()
    expect((await repository.getScore('piece-17'))?.drummerNotes).toBe('Keep the beat')
  })

  it('retains the editor and its scroll after a failed swipe save, then restores the original Library position on retry', async () => {
    const { repository, user, scroller, container } = await openLibrary()
    const save = vi.spyOn(repository, 'saveConfiguration').mockRejectedValueOnce(new Error('Storage full'))
    scroller.scrollTop = 900
    await user.click(screen.getByRole('button', { name: /17 Parade piece 17/ }))
    scroller.scrollTop = 140
    fireEvent.change(screen.getByRole('textbox', { name: /Custom drummer note/ }), { target: { value: 'Do not lose this' } })
    swipeBack(container.querySelector('.editor-panel')!)
    expect(await screen.findByRole('status')).toHaveTextContent('Storage full')
    expect(scroller.scrollTop).toBe(140)
    expect(screen.getByRole('textbox', { name: /Custom drummer note/ })).toHaveValue('Do not lose this')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(save).toHaveBeenCalledOnce()
    swipeBack(container.querySelector('.editor-panel')!)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Library' })).toBeVisible())
    expect(scroller.scrollTop).toBe(900)
    expect((await repository.getScore('piece-17'))?.drummerNotes).toBe('Do not lose this')
  })
})
