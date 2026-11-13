import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SharingClient } from '../../data/sharing'
import { ShareSetList } from './ShareSetList'
import { SharedSetListScreen } from './SharedSetListScreen'
import { AppEntry } from '../../app/AppEntry'
import { repository } from '../../data/client'

const token = 'a'.repeat(64)
beforeEach(() => localStorage.removeItem('piece-selector-shared-drummer-notes'))
const shared = { name: 'Evening', updatedAt: '2026-11-12T17:00:00Z', warnings: ['Keep the ending short'], sets: [{ name: 'Opening', scores: [{ displayNumber: 'A', title: 'Bells', collection: 'Christmas', drumsIntro: true, hotness: 3 as const, goesHigh: true, canStart: true, drummerNotes: 'Four bar count-in' }] }] }

describe('setlist sharing UI', () => {
  it('publishes only on request, copies the link, and lets the owner revoke it', async () => {
    const user = userEvent.setup()
    const fetchRequest = vi.fn((_input: string, init?: RequestInit) => Promise.resolve(init?.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({ token })))
    render(<ShareSetList id="saved-program" client={new SharingClient(fetchRequest)} />)
    expect(fetchRequest).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Share read-only link' }))
    expect(await screen.findByLabelText('Read-only link')).toHaveValue(`${window.location.origin}/share/${token}`)
    const copy = vi.spyOn(navigator.clipboard, 'writeText')
    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(copy).toHaveBeenCalledWith(`${window.location.origin}/share/${token}`)
    await user.click(screen.getByRole('button', { name: 'Stop sharing' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Sharing stopped')
    expect(screen.queryByLabelText('Read-only link')).not.toBeInTheDocument()
    expect(fetchRequest.mock.calls.map(([, init]) => init?.method)).toEqual(['POST','DELETE'])
  })

  it('shows only the shared program and refreshes live edits without write controls', async () => {
    const user = userEvent.setup()
    const fetchRequest = vi.fn(() => Promise.resolve(Response.json(shared)))
    render(<SharedSetListScreen token={token} client={new SharingClient(fetchRequest)} />)
    expect(await screen.findByRole('heading', { name: 'Evening' })).toBeVisible()
    expect(screen.getByText('Bells')).toBeVisible()
    expect(screen.getByText('Read only')).toBeVisible()
    expect(screen.getByText('Keep the ending short')).toBeVisible()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Drummer notes' }))
    expect(screen.getByRole('note')).toHaveTextContent('Four bar count-in')
    expect(screen.getByText('High · Drums · Start')).toBeVisible()
    expect(screen.queryByText(/^[HI][123](?:\s|$)/)).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Save|Import|Edit/ })).not.toBeInTheDocument()
    fetchRequest.mockImplementation(() => Promise.resolve(Response.json({ ...shared, name: 'Updated program' })))
    await user.click(screen.getByRole('button', { name: 'Refresh setlist' }))
    expect(await screen.findByRole('heading', { name: 'Updated program' })).toBeVisible()
    expect(screen.getByRole('switch', { name: 'Drummer notes' })).toBeChecked()
    expect(screen.getByRole('note')).toHaveTextContent('Four bar count-in')
    fetchRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })))
    fireEvent.focus(window)
    expect(await screen.findByRole('heading', { name: 'Setlist unavailable' })).toBeVisible()
    expect(screen.queryByText('Bells')).not.toBeInTheDocument()
  })

  it('opens a shared route before login without reading the private library', async () => {
    const privateRead = vi.spyOn(repository, 'listScores')
    const publicRead = vi.spyOn(SharingClient.prototype, 'read').mockResolvedValue(shared)
    render(<AppEntry pathname={`/share/${token}`} />)
    expect(await screen.findByRole('heading', { name: 'Evening' })).toBeVisible()
    expect(privateRead).not.toHaveBeenCalled()
    await waitFor(() => expect(publicRead).toHaveBeenCalled())
  })
})
