import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeScore } from '../../test/fixtures'
import { ConfigurationEditor } from './ConfigurationEditor'
import { DrummerNotes } from '../performance/DrummerNotes'

describe('structured drummer notes UI', () => {
  it('selects exact tempo, beat unit, measure, and optional pickup, then saves the 100-character custom note', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(() => Promise.resolve())
    render(<ConfigurationEditor score={makeScore()} onSave={onSave} onClose={vi.fn()} />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tempo (BPM)' }), '144')
    expect(screen.getByRole('img', { name: 'Tempo: 144 Quarter note per minute' })).toBeVisible()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tempo (BPM)' }), '120')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Beat unit' }), 'half')
    const notation = screen.getByRole('img', { name: 'Tempo: 120 Half note per minute' })
    expect(notation.querySelector('ellipse')).toHaveAttribute('fill', 'none')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Measure' }), '6/8')
    expect(screen.getByRole('img', { name: 'Measure: 6/8' })).toBeVisible()
    await user.selectOptions(screen.getByRole('combobox', { name: /Anacrusis/ }), '1.5')
    expect(screen.getByText('Pickup')).toBeVisible()
    expect(screen.getByText('1½ beats', { selector: '.pickup-mark b' })).toBeVisible()
    const custom = screen.getByRole('textbox', { name: /Custom drummer note/ })
    await user.type(custom, 'x'.repeat(101))
    expect(custom).toHaveValue('x'.repeat(100))
    await user.click(screen.getByRole('button', { name: 'Save score' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ drummerTiming: { bpm: 120, beat: 'half', measure: '6/8', anacrusis: 1.5 }, drummerNotes: 'x'.repeat(100) }))
  })

  it('autosaves timing, allows clearing it, and guards the draft against a failed Back save', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onDraftChange = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('Save failed. Try again.'))
    render(<ConfigurationEditor score={makeScore()} onSave={vi.fn()} onDraftChange={onDraftChange} onClose={onClose} />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tempo (BPM)' }), '144')
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ drummerTiming: { bpm: 144, beat: 'quarter', measure: null, anacrusis: null } }))
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onClose).not.toHaveBeenCalled()
    onDraftChange.mockResolvedValue()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tempo (BPM)' }), '')
    expect(screen.queryByRole('img', { name: /Tempo:/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('retains longer legacy text during timing edits and rejects a changed over-limit draft', async () => {
    const user = userEvent.setup()
    const legacy = 'Old note '.repeat(20)
    const onSave = vi.fn(() => Promise.resolve())
    render(<ConfigurationEditor score={makeScore({ drummerNotes: legacy })} onSave={onSave} onClose={vi.fn()} />)
    expect(screen.getByText(/Your saved note is longer/)).toBeVisible()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Measure' }), '4/4')
    await user.click(screen.getByRole('button', { name: 'Save score' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ drummerNotes: legacy }))
    fireEvent.change(screen.getByRole('textbox', { name: /Custom drummer note/ }), { target: { value: 'changed' + legacy } })
    expect(screen.getByRole('button', { name: 'Save score' })).toBeDisabled()
    expect(screen.getByText('Custom drummer notes must be text of at most 100 characters.')).toBeVisible()
  })

  it('saves custom text when tabbing out of its field', async () => {
    const user = userEvent.setup()
    const onDraftChange = vi.fn(() => Promise.resolve())
    render(<ConfigurationEditor score={makeScore()} onSave={vi.fn()} onDraftChange={onDraftChange} onClose={vi.fn()} />)
    await user.type(screen.getByRole('textbox', { name: /Custom drummer note/ }), 'Quiet verse')
    await user.tab()
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ drummerNotes: 'Quiet verse' }))
  })

  it('renders French notation labels and keeps malicious custom text escaped', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-BE')
    const { container } = render(<DrummerNotes value={'<img src=x onerror=alert(1)>'} timing={{ bpm: 144, beat: 'dotted-quarter', measure: '4/4', anacrusis: 0.5 }} />)
    const note = screen.getByRole('note', { name: 'Notes pour les batteurs' })
    expect(within(note).getByRole('img', { name: 'Tempo : 144 Noire pointée par minute' })).toBeVisible()
    expect(within(note).getByRole('img', { name: 'Mesure : 4/4' })).toBeVisible()
    expect(note).toHaveTextContent('½ temps')
    expect(container.querySelector('img')).toBeNull()
  })
})
