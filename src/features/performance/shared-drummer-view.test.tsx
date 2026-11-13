import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SharingClient } from '../../data/sharing'
import { SharedSetListScreen } from './SharedSetListScreen'
import { toSharedSetList } from '../../domain/sharedSetList'
import { makeScore, makeSetList } from '../../test/fixtures'
import { emptyDrummerTiming } from '../../domain/drummerNotes'

const token = 'b'.repeat(64)
const preference = 'piece-selector-shared-drummer-notes'
const snapshot = { name: 'Parade', updatedAt: '2026-11-13T10:00:00Z', sets: [{ name: 'Opening', scores: [{ displayNumber: '01', title: 'Take On Me', collection: 'General', drumsIntro: false, drummerNotes: 'Quiet verse', drummerTiming: { bpm: 144, beat: 'quarter', measure: '4/4', anacrusis: 1.5 } }] }] }

beforeEach(() => localStorage.removeItem(preference))

describe('personal drummer view on shared links', () => {
  it.each([undefined, emptyDrummerTiming()])('shows library timing for a locked setlist with absent or blank timing (%j)', async (savedTiming) => {
    const user = userEvent.setup()
    const saved = makeSetList({ locked: true })
    if (savedTiming) saved.performance.sets[0]!.scores[0]!.drummerTiming = savedTiming
    const shared = toSharedSetList(saved, [makeScore({ drummerTiming: { bpm: 120, beat: 'half', measure: '6/8', anacrusis: 0.5 } })])
    const fetchRequest = vi.fn(() => Promise.resolve(Response.json(shared)))
    render(<SharedSetListScreen token={token} client={new SharingClient(fetchRequest)} />)
    await user.click(await screen.findByRole('switch', { name: 'Drummer notes' }))
    expect(screen.getByRole('img', { name: 'Tempo: 120 Half note per minute' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Measure: 6/8' })).toBeVisible()
    expect(screen.getByRole('note')).toHaveTextContent('Pickup ½ beats')
    expect(saved.performance.sets[0]?.scores[0]?.drummerTiming).toEqual(savedTiming)
  })

  it('starts clean and toggles all structured notes without changing the link or making write requests', async () => {
    const user = userEvent.setup()
    const fetchRequest = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(() => Promise.resolve(Response.json(snapshot)))
    const url = window.location.href
    render(<SharedSetListScreen token={token} client={new SharingClient(fetchRequest)} />)
    const toggle = await screen.findByRole('switch', { name: 'Drummer notes' })
    expect(toggle).not.toBeChecked()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(screen.getByText('Take On Me')).toBeVisible()
    await user.click(toggle)
    expect(toggle).toBeChecked()
    expect(screen.getByRole('img', { name: 'Tempo: 144 Quarter note per minute' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Measure: 4/4' })).toBeVisible()
    expect(screen.getByRole('note')).toHaveTextContent('Pickup 1½ beats')
    expect(screen.getByRole('note')).toHaveTextContent('Quiet verse')
    await user.click(toggle)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(window.location.href).toBe(url)
    expect(fetchRequest).toHaveBeenCalledOnce()
    expect(fetchRequest.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit', cache: 'no-store' })
    expect(fetchRequest.mock.calls[0]?.[1]?.method).toBeUndefined()
  })

  it('retains repeated-piece warnings when switching structured drummer notes on and off', async () => {
    const user = userEvent.setup()
    const opening = snapshot.sets[0]!
    const repeated = { ...snapshot, sets: [opening, { ...opening, name: 'Encore' }] }
    render(<SharedSetListScreen token={token} client={new SharingClient(() => Promise.resolve(Response.json(repeated)))} />)
    const warning = 'Take On Me appears more than once in this program'
    expect(await screen.findAllByRole('img', { name: warning })).toHaveLength(2)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Drummer notes' }))
    expect(screen.getAllByRole('note')).toHaveLength(2)
    expect(screen.getAllByRole('img', { name: 'Tempo: 144 Quarter note per minute' })).toHaveLength(2)
    expect(screen.getAllByRole('img', { name: warning })).toHaveLength(2)
    await user.click(screen.getByRole('switch', { name: 'Drummer notes' }))
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: warning })).toHaveLength(2)
  })

  it('remembers both on and off across reopening the shared page', async () => {
    const user = userEvent.setup()
    const client = new SharingClient(() => Promise.resolve(Response.json(snapshot)))
    let view = render(<SharedSetListScreen token={token} client={client} />)
    await user.click(await screen.findByRole('switch', { name: 'Drummer notes' }))
    view.unmount()
    view = render(<SharedSetListScreen token={token} client={client} />)
    expect(await screen.findByRole('switch', { name: 'Drummer notes' })).toBeChecked()
    expect(screen.getByRole('note')).toBeVisible()
    await user.click(screen.getByRole('switch', { name: 'Drummer notes' }))
    view.unmount()
    render(<SharedSetListScreen token={token} client={client} />)
    expect(await screen.findByRole('switch', { name: 'Drummer notes' })).not.toBeChecked()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('remains usable when browser storage cannot be read or written', async () => {
    const user = userEvent.setup()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage unavailable') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable') })
    render(<SharedSetListScreen token={token} client={new SharingClient(() => Promise.resolve(Response.json(snapshot)))} />)
    const toggle = await screen.findByRole('switch', { name: 'Drummer notes' })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    expect(screen.getByRole('note')).toBeVisible()
    await user.click(toggle)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('supports French labels and toggling with the keyboard', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-BE')
    render(<SharedSetListScreen token={token} client={new SharingClient(() => Promise.resolve(Response.json(snapshot)))} />)
    const toggle = await screen.findByRole('switch', { name: 'Notes pour les batteurs' })
    toggle.focus()
    await user.keyboard(' ')
    expect(toggle).toHaveFocus()
    expect(toggle).toBeChecked()
    expect(screen.getByRole('img', { name: 'Tempo : 144 Noire par minute' })).toBeVisible()
    expect(screen.getByRole('note')).toHaveTextContent('Anacrouse 1½ temps')
    await user.keyboard(' ')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
