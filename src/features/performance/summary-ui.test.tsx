import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makePerformance, makeScore, makeSetList } from '../../test/fixtures'
import type { SavedSetList } from '../../domain/types'
import { PerformanceScreen } from './PerformanceScreen'

function program(): SavedSetList {
  const first = makePerformance().sets[0]!.scores[0]!
  return makeSetList({ performance: makePerformance({ setCount: 2, scoresPerSet: 8, sets: [
    { number: 1, scores: [first, { ...first, id: 'two', scoreNumber: 2, displayNumber: '02', title: 'Africa', canStart: false }] },
    { number: 2, scores: [{ ...first, id: 'three', scoreNumber: 3, displayNumber: '03', title: 'Encore' }] },
  ] }) })
}

function Editor({ initial, fail = false }: { initial?: SavedSetList; fail?: boolean }) {
  const [saved, setSaved] = useState(initial)
  return <PerformanceScreen scores={[makeScore({ id: 'four', scoreNumber: 4, displayNumber: '04', title: 'New piece' })]} setList={saved} savedSetLists={saved ? [saved] : []} savedSets={[]} onSave={(next) => { if (fail) return Promise.reject(new Error('Save failed. Try again.')); setSaved(next); return Promise.resolve() }} onSaveSavedSet={vi.fn()} onCreateProgram={vi.fn()} onSelect={vi.fn()} onImport={vi.fn()} onRegenerate={vi.fn()} />
}

describe('program summary', () => {
  it('counts actual pieces across unequal sets and updates after additions, removals and moves', async () => {
    const user = userEvent.setup()
    render(<Editor initial={program()} />)
    const summary = screen.getByRole('status', { name: 'Program summary' })
    expect(summary).toHaveTextContent('2 sets · 3 pieces')
    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Add a piece' })[0]!, 'four')
    await user.click(screen.getByRole('button', { name: 'Add piece to Set 1' }))
    expect(summary).toHaveTextContent('2 sets · 4 pieces')
    await user.click(screen.getByRole('button', { name: 'Remove New piece from Set 1' }))
    expect(summary).toHaveTextContent('2 sets · 3 pieces')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Move Africa to another set' }), '1')
    expect(summary).toHaveTextContent('2 sets · 3 pieces')
    await user.click(screen.getByRole('button', { name: 'Remove Set 2 from program' }))
    expect(summary).toHaveTextContent('1 set · 1 piece')
    expect(summary).toHaveAttribute('aria-live', 'polite')
  })

  it('keeps the accepted totals when saving an added piece fails', async () => {
    const user = userEvent.setup()
    render(<Editor initial={program()} fail />)
    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Add a piece' })[0]!, 'four')
    await user.click(screen.getByRole('button', { name: 'Add piece to Set 1' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed')
    expect(screen.getByRole('status', { name: 'Program summary' })).toHaveTextContent('2 sets · 3 pieces')
  })

  it('shows empty totals before a program exists and retains totals on a locked program', () => {
    const { unmount } = render(<Editor />)
    expect(screen.getByRole('status', { name: 'Program summary' })).toHaveTextContent('0 sets · 0 pieces')
    unmount()
    render(<Editor initial={{ ...program(), locked: true }} />)
    expect(screen.getByRole('status', { name: 'Program summary' })).toHaveTextContent('2 sets · 3 pieces')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
