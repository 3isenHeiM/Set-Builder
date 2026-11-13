import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeScore } from '../../test/fixtures'
import { ConfigurationEditor } from './ConfigurationEditor'
import { SharedSetListScreen } from '../performance/SharedSetListScreen'
import { SharingClient } from '../../data/sharing'

beforeEach(() => localStorage.removeItem('piece-selector-shared-drummer-notes'))

describe('drummer notes UI', () => {
  it('saves optional multiline notes without making them a readiness requirement', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(() => Promise.resolve())
    render(<ConfigurationEditor score={makeScore()} onSave={onSave} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Save score' })).toBeEnabled()
    const notes = screen.getByRole('textbox', { name: /Custom drummer note/ })
    expect(notes).toHaveAttribute('maxlength', '100')
    await user.type(notes, 'Snare intro{Enter}Stop together')
    await user.click(screen.getByRole('button', { name: 'Save score' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ drummerNotes: 'Snare intro\nStop together' }))
  })

  it('saves before going Back and keeps the draft open if that save fails', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onDraftChange = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('Save failed. Try again.'))
    render(<ConfigurationEditor score={makeScore()} onSave={vi.fn()} onDraftChange={onDraftChange} onClose={onClose} />)
    await user.type(screen.getByRole('textbox', { name: /Custom drummer note/ }), 'Quiet verse')
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('Save failed')
    expect(screen.getByRole('textbox', { name: /Custom drummer note/ })).toHaveValue('Quiet verse')
    onDraftChange.mockResolvedValue()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('displays notes as escaped plain text in the read-only viewer', async () => {
    const note = '<script>not executable</script>\nSnare on beat 4'
    const client = new SharingClient(() => Promise.resolve(Response.json({ name: 'Event', updatedAt: '2026-11-12T20:00:00Z', sets: [{ name: 'Opening', scores: [{ title: 'Bells', displayNumber: 'A', collection: 'Christmas', drumsIntro: true, drummerNotes: note, drummerTiming: { bpm: 144, beat: 'quarter', measure: '4/4', anacrusis: null } }] }] })))
    const { container } = render(<SharedSetListScreen token={'a'.repeat(64)} client={client} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('switch', { name: 'Drummer notes' }))
    const visible = screen.getByRole('note', { name: 'Drummer notes' })
    expect(visible).toHaveTextContent('not executable')
    expect(screen.getByRole('img', { name: 'Tempo: 144 Quarter note per minute' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Measure: 4/4' })).toBeVisible()
    expect(container.querySelector('script')).toBeNull()
  })
})
