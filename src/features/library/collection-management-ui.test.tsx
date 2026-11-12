import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeScore } from '../../test/fixtures'
import { LibraryScreen } from './LibraryScreen'

describe('collection management UI', () => {
  it('moves selected pieces together and returns to the library after saving', async () => {
    const user = userEvent.setup()
    const onAssignCollection = vi.fn(() => Promise.resolve())
    render(<LibraryScreen scores={[makeScore(), makeScore({ id: 'two', scoreNumber: 2, displayNumber: '02', title: 'Africa' })]} collections={['General', 'Christmas']} lastScan={undefined} onFolder={vi.fn()} onSave={vi.fn()} onAssignCollection={onAssignCollection} />)
    await user.click(screen.getByRole('button', { name: 'Select pieces' }))
    await user.click(screen.getByRole('button', { name: /Take On Me/ }))
    await user.click(screen.getByRole('button', { name: /Africa/ }))
    await user.click(screen.getByRole('button', { name: 'Move to collection' }))
    expect(screen.getByRole('button', { name: 'Move pieces' })).toBeDisabled()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Destination collection' }), 'Christmas')
    await user.click(screen.getByRole('button', { name: 'Move pieces' }))
    expect(onAssignCollection).toHaveBeenCalledWith(['score-1', 'two'], 'Christmas')
    expect(await screen.findByRole('button', { name: 'Select pieces' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('2 pieces moved to Christmas')
  })

  it('removes a piece to General and keeps failed moves selected for correction', async () => {
    const user = userEvent.setup()
    const onAssignCollection = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('Collection already contains identifier A. No pieces were moved.')).mockResolvedValueOnce()
    render(<LibraryScreen scores={[makeScore({ collection: 'Christmas' })]} lastScan={undefined} onFolder={vi.fn()} onSave={vi.fn()} onAssignCollection={onAssignCollection} />)
    await user.click(screen.getByRole('button', { name: 'Select pieces' }))
    await user.click(screen.getByRole('button', { name: /Take On Me/ }))
    await user.click(screen.getByRole('button', { name: 'Move to collection' }))
    await user.click(screen.getByRole('button', { name: 'Remove from collection' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pieces were moved')
    expect(screen.getByRole('button', { name: /Take On Me/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Pieces stay in your library under General.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Remove from collection' }))
    expect(onAssignCollection).toHaveBeenLastCalledWith(['score-1'], 'General')
    expect(await screen.findByRole('button', { name: 'Select pieces' })).toBeVisible()
  })

  it('creates an empty collection and targets it for the next metadata-only import', async () => {
    const user = userEvent.setup()
    const onCreateCollection = vi.fn(() => Promise.resolve())
    const onFolder = vi.fn()
    const { container } = render(<LibraryScreen scores={[]} lastScan={undefined} onFolder={onFolder} onSave={vi.fn()} onCreateCollection={onCreateCollection} />)
    await user.click(screen.getByRole('button', { name: 'New collection' }))
    await user.type(screen.getByRole('textbox', { name: 'Collection name' }), 'Christmas')
    await user.click(screen.getByRole('button', { name: 'Create collection' }))
    expect(onCreateCollection).toHaveBeenCalledWith('Christmas')
    expect(await screen.findByRole('status')).toHaveTextContent('Collection created')
    expect(screen.getByLabelText('Import into collection')).toHaveValue('Christmas')
    const input = container.querySelector('input[type="file"]')
    if (!input) throw new Error('File picker missing')
    const text = vi.fn()
    fireEvent.change(input, { target: { files: [{ name: 'A - Bells.mscz', text }] } })
    expect(onFolder).toHaveBeenCalledWith(expect.objectContaining({ collection: 'Christmas', mode: 'add', valid: [expect.objectContaining({ scoreNumber: 'A' })] }))
    expect(text).not.toHaveBeenCalled()
  })

  it('keeps the new collection form open when creation fails', async () => {
    const user = userEvent.setup()
    const onCreateCollection = vi.fn(() => Promise.reject(new Error('A collection already uses this name.')))
    render(<LibraryScreen scores={[]} lastScan={undefined} onFolder={vi.fn()} onSave={vi.fn()} onCreateCollection={onCreateCollection} />)
    await user.click(screen.getByRole('button', { name: 'New collection' }))
    await user.type(screen.getByLabelText('Collection name'), 'General')
    await user.click(screen.getByRole('button', { name: 'Create collection' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already uses')
    expect(screen.getByLabelText('Collection name')).toHaveValue('General')
  })
})
