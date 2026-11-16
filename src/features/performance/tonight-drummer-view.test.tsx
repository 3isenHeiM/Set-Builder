import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeSetList } from '../../test/fixtures'
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
  it('retains every repeated-piece warning while toggling structured notes on and off', async () => {
    const user = userEvent.setup()
    const { saved, actions, view } = fixture()
    const scores = saved.performance.sets[0]!.scores
    scores.push({ ...scores[0]!, entryId: 'encore' })
    const frozen = structuredClone(saved)
    const warning = 'Take On Me appears more than once in this program'
    render(view())
    expect(screen.getAllByRole('img', { name: warning })).toHaveLength(2)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Drummer notes' }))
    expect(screen.getAllByRole('img', { name: warning })).toHaveLength(2)
    expect(screen.getAllByRole('img', { name: 'Tempo: 144 Quarter note per minute' })).toHaveLength(2)
    expect(screen.getAllByRole('note')).toHaveLength(2)
    await user.click(screen.getByRole('switch', { name: 'Drummer notes' }))
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: warning })).toHaveLength(2)
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
