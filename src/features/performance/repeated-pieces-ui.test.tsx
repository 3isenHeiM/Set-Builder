import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeScore, makeSetList } from '../../test/fixtures'
import { addNewSet, addPiece } from '../../domain/setList'
import { toSharedSetList } from '../../domain/sharedSetList'
import { PerformanceScreen } from './PerformanceScreen'
import { TonightScreen } from './TonightScreen'
import { SharedSetListScreen } from './SharedSetListScreen'
import { SharingClient } from '../../data/sharing'

function Editor() {
  const [saved, setSaved] = useState(makeSetList())
  const reusable = { id: 'opening', name: 'Opening', createdAt: saved.createdAt, updatedAt: saved.updatedAt, scores: makeSetList().performance.sets[0]!.scores }
  return <PerformanceScreen scores={[makeScore()]} setList={saved} savedSetLists={[saved]} savedSets={[reusable]} onSave={(next) => { setSaved(next); return Promise.resolve() }} onSaveSavedSet={vi.fn()} onCreateProgram={vi.fn()} onSelect={vi.fn()} onImport={vi.fn()} onRegenerate={vi.fn()} />
}

const warning = 'Take On Me appears more than once in this program'

describe('repeated piece warnings', () => {
  it('offers an existing piece, marks every occurrence, and clears warnings after removing a copy', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    const picker = screen.getByRole('combobox', { name: 'Add a piece' })
    expect(screen.getAllByRole('option', { name: 'General · 01 · Take On Me (!)' })).toHaveLength(2)
    await user.selectOptions(picker, 'score-1')
    await user.click(screen.getByRole('button', { name: 'Add piece to Set 1' }))
    expect(screen.getAllByRole('img', { name: warning })).toHaveLength(2)
    expect(screen.getByRole('status', { name: 'Program summary' })).toHaveTextContent('1 set · 2 pieces')
    await user.click(screen.getAllByRole('button', { name: 'Remove Take On Me from Set 1' })[1]!)
    expect(screen.queryByRole('img', { name: warning })).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Program summary' })).toHaveTextContent('1 set · 1 piece')
  })

  it('can add a reusable set twice and edits each set name independently', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    for (let count = 0; count < 2; count += 1) {
      await user.selectOptions(screen.getByRole('combobox', { name: 'Saved sets' }), 'opening')
      await user.click(screen.getByRole('button', { name: 'Add to program' }))
    }
    expect(screen.getAllByRole('img', { name: warning })).toHaveLength(3)
    const second = screen.getByRole('textbox', { name: 'Name for Set 2' })
    await user.clear(second)
    await user.type(second, 'Second appearance')
    await user.click(screen.getByRole('textbox', { name: 'Name for Set 3' }))
    await waitFor(() => expect(second).toHaveValue('Second appearance'))
    expect(screen.getByRole('textbox', { name: 'Name for Set 3' })).toHaveValue('Opening')
  })

  it('retains accessible warnings in Tonight and shared views with repeated starters', async () => {
    const repeated = { ...addNewSet(addPiece(makeSetList(), 0, makeScore(), '2026-11-13T10:00:00Z'), makeScore(), '2026-11-13T10:00:00Z'), locked: true }
    const { unmount } = render(<TonightScreen setList={repeated} savedSetLists={[repeated]} onLoad={vi.fn()} onClear={vi.fn()} onManage={vi.fn()} />)
    expect(screen.getAllByRole('img', { name: warning })).toHaveLength(3)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    unmount()
    render(<SharedSetListScreen token={'a'.repeat(64)} client={new SharingClient(() => Promise.resolve(Response.json(toSharedSetList(repeated))))} />)
    expect(await screen.findAllByRole('img', { name: warning })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: /Collapse Set/ })).toHaveLength(2)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('explains repeats in French', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-BE')
    const repeated = { ...addPiece(makeSetList(), 0, makeScore(), '2026-11-13T10:00:00Z'), locked: true }
    render(<TonightScreen setList={repeated} savedSetLists={[repeated]} onLoad={vi.fn()} onClear={vi.fn()} onManage={vi.fn()} />)
    expect(screen.getAllByRole('img', { name: 'Take On Me apparaît plusieurs fois dans ce programme' })).toHaveLength(2)
  })
})
