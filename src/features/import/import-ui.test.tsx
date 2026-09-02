import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { buildFolderSnapshot } from '../../domain/filename'
import { classifyReconciliation } from '../../domain/reconciliation'
import { makeScore } from '../../test/fixtures'
import { FolderPicker } from './FolderPicker'
import { ReconciliationPreview } from './ReconciliationPreview'

describe('folder import UI', () => {
  it('offers the exact initial action and emits a metadata preview only after selection', () => {
    const onSnapshot = vi.fn()
    const { container } = render(<FolderPicker mode="import" directorySupport onSnapshot={onSnapshot} />)
    expect(screen.getByRole('button', { name: 'Import scores from this folder' })).toBeVisible()
    const input = container.querySelector('input[type="file"]')
    expect(input).toHaveAttribute('multiple')
    expect(input).toHaveAttribute('accept', '.mscz')
    expect(input).toHaveAttribute('webkitdirectory')
    if (!input) throw new Error('file input unavailable')
    const file = new File(['contents must remain unread'], '01 - Take On Me.mscz')
    fireEvent.change(input, { target: { files: [file] } })
    expect(onSnapshot).toHaveBeenCalledWith(expect.objectContaining({ valid: [expect.objectContaining({ scoreNumber: 1 })] }))
    onSnapshot.mockClear()
    fireEvent.change(input, { target: { files: [] } })
    expect(onSnapshot).not.toHaveBeenCalled()
  })

  it('offers and explains the multiple-file fallback', () => {
    render(<FolderPicker mode="realign" directorySupport={false} onSnapshot={vi.fn()} />)
    expect(screen.getByText(/Folder selection is unavailable/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Re-align with scores folder' })).toBeVisible()
  })

  it('requires explicit renumbering resolution before apply', async () => {
    const user = userEvent.setup()
    const original = makeScore()
    const plan = classifyReconciliation(buildFolderSnapshot([{ name: '10 - TAKE ON ME.mscz' }], 'now'), [original])
    const onApply = vi.fn(() => Promise.resolve())
    render(<ReconciliationPreview plan={plan} applying={false} error="" onApply={onApply} onCancel={vi.fn()} />)
    const apply = screen.getByRole('button', { name: 'Apply changes' })
    expect(apply).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /Treat as same score/ }))
    expect(apply).toBeEnabled()
    await user.click(apply)
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ [plan.possibleRenumberings[0]?.id ?? 'missing']: 'same-score' }))
  })
})
