import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { buildFolderSnapshot } from '../../domain/filename'
import { classifyReconciliation } from '../../domain/reconciliation'
import { makeScore } from '../../test/fixtures'
import { FolderPicker } from './FolderPicker'
import { supportsDirectorySelection } from './directorySupport'
import { ReconciliationPreview } from './ReconciliationPreview'

describe('folder import UI', () => {
  it('uses the supported directory workflow only on iOS 18.4 or newer', () => {
    expect(supportsDirectorySelection('Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X)', true)).toBe(false)
    expect(supportsDirectorySelection('Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X)', true)).toBe(true)
    expect(supportsDirectorySelection('Mozilla/5.0 (iPhone; CPU iPhone OS 26_2 like Mac OS X)', true)).toBe(true)
    expect(supportsDirectorySelection('desktop', true)).toBe(true)
    expect(supportsDirectorySelection('desktop', false)).toBe(false)
  })

  it('offers the exact initial action and emits a metadata preview only after selection', () => {
    const onSnapshot = vi.fn()
    const { container } = render(<FolderPicker mode="import" directorySupport onSnapshot={onSnapshot} />)
    expect(screen.getByRole('button', { name: 'Import scores from this folder' })).toBeVisible()
    const [input, fallback] = [...container.querySelectorAll('input[type="file"]')]
    expect(input).not.toHaveAttribute('multiple')
    expect(input).not.toHaveAttribute('accept')
    expect(input).toHaveAttribute('webkitdirectory')
    expect(fallback).toHaveAttribute('multiple')
    expect(fallback).toHaveAttribute('accept', '.mscz')
    expect(screen.getByRole('button', { name: 'Select .mscz files instead' })).toBeVisible()
    if (!input) throw new Error('file input unavailable')
    const files = [new File(['contents must remain unread'], '01 - Take On Me.mscz'), new File([], '02 - Africa.mscz'), new File([], 'notes.pdf')]
    fireEvent.change(input, { target: { files } })
    expect(onSnapshot).toHaveBeenCalledWith(expect.objectContaining({ valid: [expect.objectContaining({ scoreNumber: 1 }), expect.objectContaining({ scoreNumber: 2 })], ignoredCount: 1 }))
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
