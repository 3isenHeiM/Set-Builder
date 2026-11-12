import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FolderSnapshot } from '../../domain/types'
import { CollectionImport } from './CollectionImport'
import { CollectionRename } from '../library/CollectionRename'

describe('collection controls', () => {
  it('adds a folder snapshot to a named collection without reading score contents', async () => {
    const user = userEvent.setup()
    const onSnapshot = vi.fn<(snapshot: FolderSnapshot) => void>()
    const { container } = render(<CollectionImport collections={['General']} onSnapshot={onSnapshot} />)
    const collection = screen.getByLabelText('Import into collection')
    await user.clear(collection)
    await user.type(collection, 'Christmas')
    const input = container.querySelector('input[type="file"]')
    if (!input) throw new Error('missing file picker')
    const text = vi.fn()
    fireEvent.change(input, { target: { files: [{ name: 'A - Bells.mscz', text }] } })
    expect(onSnapshot.mock.calls[0]?.[0]).toMatchObject({ collection: 'Christmas', mode: 'add', valid: [{ scoreNumber: 'A', title: 'Bells' }] })
    expect(text).not.toHaveBeenCalled()
    await user.selectOptions(screen.getByLabelText('Import mode'), 'realign')
    expect(screen.getByText(/Absent pieces in this collection/)).toBeVisible()
  })

  it('saves a collection rename explicitly and keeps errors visible', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn<(name: string) => Promise<void>>(() => Promise.reject(new Error('A collection already uses this name.')))
    render(<CollectionRename name="General" onRename={onRename} />)
    await user.click(screen.getByRole('button', { name: 'Rename collection' }))
    await user.clear(screen.getByLabelText('Collection name'))
    await user.type(screen.getByLabelText('Collection name'), 'Christmas')
    await user.click(screen.getByRole('button', { name: 'Save name' }))
    expect(onRename).toHaveBeenCalledWith('Christmas')
    expect(await screen.findByRole('alert')).toHaveTextContent('already uses')
  })
})
