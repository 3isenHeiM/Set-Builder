import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeScore, makeSetList } from '../../test/fixtures'
import { TonightScreen } from './TonightScreen'

const preference = 'piece-selector-shared-drummer-notes'
beforeEach(() => localStorage.removeItem(preference))
afterEach(() => localStorage.removeItem(preference))

function fixture() {
  const saved = makeSetList({ locked: true })
  Object.assign(saved.performance.sets[0]!.scores[0]!, { drummerTiming: { bpm: 144, beat: 'quarter', measure: '6/8', anacrusis: 1.5 }, drummerNotes: 'Quiet verse' })
  const actions = { onLoad: vi.fn(() => Promise.resolve()), onClear: vi.fn(() => Promise.resolve()), onManage: vi.fn() }
  return { saved, actions, view: () => <TonightScreen setList={saved} savedSetLists={[saved]} {...actions} /> }
}

describe('Tonight drummer view', () => {
  it('shows missing details when the cached Library arrives after the toggle is enabled', async () => {
    const saved = makeSetList({ locked: true })
    const frozen = structuredClone(saved)
    const actions = { onLoad: vi.fn(), onClear: vi.fn(), onManage: vi.fn(), savedSetLists: [saved] }
    const { rerender } = render(<TonightScreen setList={saved} {...actions} />)
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Drummer notes' }))
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    const library = [makeScore({ drummerNotes: 'Quiet verse', drummerTiming: { bpm: 120, beat: 'half', measure: '4/4', anacrusis: 0.5 } })]
    rerender(<TonightScreen setList={saved} libraryScores={library} {...actions} />)
    expect(screen.getByRole('img', { name: 'Tempo: 120 Half note per minute' })).toBeVisible()
    expect(screen.getByRole('note')).toHaveTextContent('Pickup ½ beatsQuiet verse')
    expect(saved).toEqual(frozen)
    expect(actions.onLoad).not.toHaveBeenCalled()
  })

  it.each(['Quiet verse', ''])('retains saved timing and saved text %j over newer Library notes', async (text) => {
    const { saved, actions } = fixture()
    saved.performance.sets[0]!.scores[0]!.drummerNotes = text
    const frozen = structuredClone(saved)
    const library = [makeScore({ drummerNotes: 'New Library note', drummerTiming: { bpm: 200, beat: 'half', measure: '4/4', anacrusis: null } })]
    render(<TonightScreen setList={saved} libraryScores={library} savedSetLists={[saved]} {...actions} />)
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Drummer notes' }))
    expect(screen.getByRole('img', { name: 'Tempo: 144 Quarter note per minute' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Measure: 6/8' })).toBeVisible()
    expect(screen.getByRole('note')).toHaveTextContent('Pickup 1½ beats')
    expect(screen.queryByText('New Library note')).not.toBeInTheDocument()
    expect(screen.getByRole('note').querySelector('.drummer-custom-text')?.textContent ?? '').toBe(text)
    expect(saved).toEqual(frozen)
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled()
  })

  it('toggles all frozen details without saving, and remembers both on and off across reopening', async () => {
    const user = userEvent.setup()
    const { saved, actions, view } = fixture()
    const frozen = structuredClone(saved)
    let mounted = render(view())
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Drummer notes' }))
    expect(screen.getByRole('img', { name: 'Tempo: 144 Quarter note per minute' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Measure: 6/8' })).toBeVisible()
    expect(screen.getByRole('note')).toHaveTextContent('Pickup 1½ beatsQuiet verse')
    expect(localStorage.getItem(preference)).toBe('true')
    mounted.unmount()
    mounted = render(view())
    expect(screen.getByRole('switch')).toBeChecked()
    await user.click(screen.getByRole('switch'))
    mounted.unmount()
    render(view())
    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(saved).toEqual(frozen)
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled()
  })

  it('uses the shared-view preference and supports French keyboard access without browser storage', async () => {
    localStorage.setItem(preference, 'true')
    const { view } = fixture()
    const mounted = render(view())
    expect(screen.getByRole('switch')).toBeChecked()
    mounted.unmount()
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-BE')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable') })
    const user = userEvent.setup()
    render(view())
    const toggle = screen.getByRole('switch', { name: 'Notes pour les batteurs' })
    expect(toggle).not.toBeChecked()
    toggle.focus()
    await user.keyboard(' ')
    expect(toggle).toBeChecked()
    expect(toggle).toHaveFocus()
    expect(screen.getByRole('img', { name: 'Tempo : 144 Noire par minute' })).toBeVisible()
    expect(screen.getByRole('note')).toHaveTextContent('Anacrouse 1½ temps')
  })
})
