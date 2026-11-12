import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makePerformance } from '../../test/fixtures'
import type { SavedSetList } from '../../domain/types'
import { moveSet } from '../../domain/setList'
import { PerformanceScreen } from './PerformanceScreen'
import { SharedSetListScreen } from './SharedSetListScreen'
import { SharingClient } from '../../data/sharing'

function program(): SavedSetList {
  const performance = makePerformance()
  const first = performance.sets[0]!
  performance.setCount = 2
  performance.sets = [{ ...first, name: 'Opening' }, { number: 2, name: 'Encore', scores: [{ ...first.scores[0]!, id: 'second', scoreNumber: 2, displayNumber: '02', title: 'Africa' }] }]
  return { id: performance.id, name: 'Evening', createdAt: performance.generatedAt, updatedAt: performance.generatedAt, performance }
}

function props(saved: SavedSetList) {
  return {
    scores: [], setList: saved, savedSetLists: [saved], savedSets: [],
    onSave: vi.fn<(value: SavedSetList) => Promise<void>>(() => Promise.resolve()),
    onSaveSavedSet: vi.fn(() => Promise.reject(new Error('unused'))),
    onCreateProgram: vi.fn(() => Promise.reject(new Error('unused'))),
    onSelect: vi.fn(() => Promise.resolve()), onImport: vi.fn(() => Promise.resolve()), onRegenerate: vi.fn(),
  }
}

describe('folding set ribbons', () => {
  it('folds each set independently without saving or hiding its ribbon controls', async () => {
    const user = userEvent.setup()
    const saved = program()
    const initial = props(saved)
    const { rerender } = render(<PerformanceScreen {...initial} />)
    const ribbon = screen.getByRole('button', { name: 'Collapse Opening' })
    const panel = document.getElementById(ribbon.getAttribute('aria-controls')!)!
    expect(ribbon).toHaveAttribute('aria-expanded', 'true')
    await user.click(ribbon)
    expect(panel).not.toBeVisible()
    expect(screen.getByText('Take On Me')).not.toBeVisible()
    expect(screen.getByText('Africa')).toBeVisible()
    expect(initial.onSave).not.toHaveBeenCalled()
    const move = screen.getByRole('button', { name: 'Move Set 1 down' })
    expect(move).toBeVisible()
    await user.click(move)
    expect(initial.onSave).toHaveBeenCalledOnce()
    expect(ribbon).toHaveAttribute('aria-expanded', 'false')
    rerender(<PerformanceScreen {...initial} setList={moveSet(saved, 0, 1, saved.updatedAt)} />)
    expect(screen.getByRole('button', { name: 'Expand Opening' })).toHaveAttribute('aria-expanded', 'false')
    await user.click(screen.getByRole('button', { name: 'Expand Opening' }))
    expect(screen.getByText('Take On Me')).toBeVisible()
  })

  it('keeps name editing separate from folding and retains the draft while folded', async () => {
    const user = userEvent.setup()
    render(<PerformanceScreen {...props(program())} />)
    const name = screen.getByRole('textbox', { name: 'Name for Set 1' })
    await user.clear(name)
    await user.type(name, 'Night Set')
    expect(screen.getByText('Take On Me')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Collapse Night Set' }))
    expect(name).not.toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Expand Night Set' }))
    expect(name).toHaveValue('Night Set')
    expect(name).toBeVisible()
  })

  it('supports Enter and Space on read-only ribbons without making write requests', async () => {
    const user = userEvent.setup()
    const snapshot = { name: 'Evening', updatedAt: program().updatedAt, sets: [{ name: 'Opening', scores: [{ displayNumber: '01', title: 'Take On Me', collection: 'General', drumsIntro: false }] }] }
    const fetchRequest = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(() => Promise.resolve(Response.json(snapshot)))
    render(<SharedSetListScreen token={'a'.repeat(64)} client={new SharingClient(fetchRequest)} />)
    const ribbon = await screen.findByRole('button', { name: 'Collapse Opening' })
    ribbon.focus()
    await user.keyboard('{Enter}')
    expect(ribbon).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Take On Me')).not.toBeVisible()
    await user.keyboard(' ')
    expect(ribbon).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Take On Me')).toBeVisible()
    expect(fetchRequest).toHaveBeenCalledOnce()
    expect(fetchRequest.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit' })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('preserves folded sets during live shared updates and reordering', async () => {
    const user = userEvent.setup()
    const first = { name: 'Opening', scores: [{ displayNumber: '01', title: 'Take On Me', collection: 'General', drumsIntro: false }] }
    const second = { name: 'Encore', scores: [{ displayNumber: '02', title: 'Africa', collection: 'General', drumsIntro: false }] }
    const snapshot = { name: 'Evening', updatedAt: program().updatedAt, sets: [first, second] }
    const fetchRequest = vi.fn(() => Promise.resolve(Response.json(snapshot)))
    render(<SharedSetListScreen token={'a'.repeat(64)} client={new SharingClient(fetchRequest)} />)
    await user.click(await screen.findByRole('button', { name: 'Collapse Opening' }))
    fetchRequest.mockImplementation(() => Promise.resolve(Response.json({ ...snapshot, sets: [second, { ...first, scores: [{ ...first.scores[0], title: 'Updated title' }] }] })))
    fireEvent.focus(window)
    expect(await screen.findByText('Updated title')).not.toBeVisible()
    expect(screen.getByRole('button', { name: 'Expand Opening' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Africa')).toBeVisible()
  })
})
