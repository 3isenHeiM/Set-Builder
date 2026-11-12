import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryScreen } from './LibraryScreen'
import { makeScore } from '../../test/fixtures'

describe('piece deletion', () => {
  it('requires confirmation and lets the user cancel without deleting', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn(() => Promise.resolve())
    render(<LibraryScreen scores={[makeScore()]} lastScan={undefined} onFolder={vi.fn()} onSave={vi.fn()} onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: /Take On Me/ }))
    await user.click(screen.getByRole('button', { name: 'Delete piece' }))
    expect(screen.getByText('Delete “Take On Me”?')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(onDelete).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Delete permanently' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete piece' })).toHaveFocus()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('keeps failures visible and returns to the library after a successful retry', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('offline save failed')).mockResolvedValueOnce()
    render(<LibraryScreen scores={[makeScore()]} lastScan={undefined} onFolder={vi.fn()} onSave={vi.fn()} onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: /Take On Me/ }))
    await user.click(screen.getByRole('button', { name: 'Delete piece' }))
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(await screen.findByRole('alert')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(await screen.findByRole('heading', { name: 'Library' })).toBeVisible()
    expect(onDelete).toHaveBeenLastCalledWith('score-1')
    expect(screen.getByRole('status')).toHaveTextContent('Piece deleted')
  })
})
