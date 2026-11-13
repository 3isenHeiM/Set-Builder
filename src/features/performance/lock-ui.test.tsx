import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SavedSetList } from '../../domain/types'
import { makeSetList } from '../../test/fixtures'
import { PerformanceScreen } from './PerformanceScreen'
import { TonightScreen } from './TonightScreen'
import { SharingClient } from '../../data/sharing'

function Editor({ initial = makeSetList(), fail = false }: { initial?: SavedSetList; fail?: boolean }) {
  const [saved, setSaved] = useState(initial)
  return <PerformanceScreen scores={[]} setList={saved} savedSetLists={[saved]} savedSets={[]} onSave={(next) => { setSaved(next); return Promise.resolve() }} onLockChange={(_id, locked) => { if (fail) return Promise.reject(new Error('The setlist lock could not be saved.')); setSaved((current) => ({ ...current, locked })); return Promise.resolve() }} onSaveSavedSet={vi.fn()} onCreateProgram={vi.fn()} onSelect={vi.fn()} onImport={vi.fn()} onRegenerate={vi.fn()} />
}

describe('performance lock controls', () => {
  it('locks a program, removes every editor, and requires explicit confirmation to unlock', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    await user.click(screen.getByRole('button', { name: 'Lock setlist' }))
    expect(await screen.findByText('Locked')).toBeVisible()
    expect(screen.getByText('Take On Me')).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Move|Remove|Save|Override|Add/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Unlock setlist' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Unlock setlist' }))
    await user.click(within(screen.getByRole('group', { name: 'Unlock this setlist for editing?' })).getByRole('button', { name: 'Unlock setlist' }))
    expect(await screen.findByRole('textbox', { name: 'Program name' })).toBeVisible()
  })

  it('shares, copies, and revokes a locked program without unlocking or editing it', async () => {
    const user = userEvent.setup()
    const saved = makeSetList({ locked: true })
    const original = structuredClone(saved)
    const create = vi.spyOn(SharingClient.prototype, 'create').mockResolvedValue('a'.repeat(64))
    const revoke = vi.spyOn(SharingClient.prototype, 'revoke').mockResolvedValue(undefined)
    const copy = vi.spyOn(navigator.clipboard, 'writeText')
    const onSave = vi.fn(() => Promise.resolve())
    const onLockChange = vi.fn(() => Promise.resolve())
    render(<PerformanceScreen scores={[]} setList={saved} savedSetLists={[saved]} savedSets={[]} onSave={onSave} onLockChange={onLockChange} onSaveSavedSet={vi.fn()} onCreateProgram={vi.fn()} onSelect={vi.fn()} onImport={vi.fn()} onRegenerate={vi.fn()} />)
    expect(create).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Share read-only link' }))
    expect(await screen.findByLabelText('Read-only link')).toHaveAttribute('readonly')
    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(copy).toHaveBeenCalledWith(`${window.location.origin}/share/${'a'.repeat(64)}`)
    await user.click(screen.getByRole('button', { name: 'Stop sharing' }))
    expect(revoke).toHaveBeenCalledWith(saved.id)
    expect(screen.getByRole('button', { name: 'Unlock setlist', pressed: true })).toBeVisible()
    expect(onSave).not.toHaveBeenCalled()
    expect(onLockChange).not.toHaveBeenCalled()
    expect(saved).toEqual(original)
  })

  it('saves draft names before locking', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    const name = screen.getByRole('textbox', { name: 'Name for Set 1' })
    await user.type(name, 'Opening')
    await user.click(screen.getByRole('button', { name: 'Lock setlist' }))
    expect(await screen.findByText('Locked')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Collapse Opening' })).toBeVisible()
  })

  it.each([false, true])('keeps the persisted lock state when saving fails (locked=%s)', async (locked) => {
    const user = userEvent.setup()
    render(<Editor initial={makeSetList({ locked })} fail />)
    await user.click(screen.getByRole('button', { name: locked ? 'Unlock setlist' : 'Lock setlist' }))
    if (locked) await user.click(within(screen.getByRole('group')).getByRole('button', { name: 'Unlock setlist' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('lock could not be saved')
    expect(screen.getByRole('button', { name: locked ? 'Unlock setlist' : 'Lock setlist', pressed: locked })).toBeEnabled()
  })
})

describe('tonight performance view', () => {
  it('offers only locked programs and loads a read-only view', async () => {
    const user = userEvent.setup()
    const locked = makeSetList({ locked: true })
    const unlocked = makeSetList({ id: 'unlocked', name: 'Rehearsal' })
    const onLoad = vi.fn<(saved: SavedSetList) => Promise<void>>(() => Promise.resolve())
    const { rerender } = render(<TonightScreen setList={undefined} savedSetLists={[locked, unlocked]} onLoad={onLoad} onClear={vi.fn()} onManage={vi.fn()} />)
    expect(screen.queryByRole('option', { name: 'Rehearsal' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Locked setlists' }), locked.id)
    await user.click(screen.getByRole('button', { name: 'Load for tonight' }))
    await waitFor(() => expect(onLoad).toHaveBeenCalledWith(locked))
    rerender(<TonightScreen setList={locked} savedSetLists={[locked, unlocked]} onLoad={onLoad} onClear={vi.fn()} onManage={vi.fn()} />)
    expect(screen.getByText('Take On Me')).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Unlock|Save|Move|Remove|Override/ })).not.toBeInTheDocument()
  })

  it('retains the existing view and announces a failed replacement', async () => {
    const user = userEvent.setup()
    const locked = makeSetList({ locked: true })
    render(<TonightScreen setList={locked} savedSetLists={[locked]} onLoad={() => Promise.reject(new Error('Tonight’s selection could not be saved.'))} onClear={vi.fn()} onManage={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Change tonight’s setlist' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Locked setlists' }), locked.id)
    await user.click(screen.getByRole('button', { name: 'Load for tonight' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved')
    expect(screen.getByText('Take On Me')).toBeVisible()
  })
})
