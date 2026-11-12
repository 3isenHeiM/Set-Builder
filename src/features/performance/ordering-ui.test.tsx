import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SavedSetList, Score } from '../../domain/types'
import { createProgramFromStarter, addNewSet } from '../../domain/setList'
import { makePerformance, makeScore } from '../../test/fixtures'
import { PerformanceScreen } from './PerformanceScreen'

function Editor({ initial, scores = [], fail = false }: { initial: SavedSetList; scores?: Score[]; fail?: boolean }) {
  const [program, setProgram] = useState(initial)
  return <PerformanceScreen scores={scores} setList={program} savedSetLists={[program]} savedSets={[]} onSave={(next) => { if (fail) return Promise.reject(new Error('Save failed. Try again.')); setProgram(next); return Promise.resolve() }} onSaveSavedSet={vi.fn()} onCreateProgram={vi.fn()} onSelect={vi.fn()} onImport={vi.fn()} onRegenerate={vi.fn()} />
}

function orderedProgram(): SavedSetList {
  const starter = makePerformance().sets[0]!.scores[0]!
  const performance = makePerformance({ scoresPerSet: 3, sets: [{ number: 1, scores: [starter, { ...starter, id: 'high', scoreNumber: 2, displayNumber: '02', title: 'High piece', goesHigh: true, canStart: false }, { ...starter, id: 'regular', scoreNumber: 3, displayNumber: '03', title: 'Regular piece', canStart: false }] }] })
  return { id: performance.id, name: 'Test program', createdAt: performance.generatedAt, updatedAt: performance.generatedAt, performance }
}

describe('manual piece ordering', () => {
  it('unlocks goes-high movement per set and restores order when switched off', async () => {
    const user = userEvent.setup()
    const { container } = render(<Editor initial={orderedProgram()} />)
    expect(screen.getByRole('button', { name: 'Move High piece down' })).toBeDisabled()
    const toggle = () => screen.getByRole('button', { name: 'Override piece order for Set 1' })
    expect(toggle()).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle())
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-pressed', 'true'))
    await user.click(screen.getByRole('button', { name: 'Move High piece down' }))
    await waitFor(() => expect([...container.querySelectorAll('.score-copy strong')].map((node) => node.textContent)).toEqual(['Take On Me', 'Regular piece', 'High piece']))
    expect(screen.getByRole('button', { name: 'Move Regular piece up' })).toBeDisabled()
    await user.click(toggle())
    await waitFor(() => expect([...container.querySelectorAll('.score-copy strong')].map((node) => node.textContent)).toEqual(['Take On Me', 'High piece', 'Regular piece']))
    expect(toggle()).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a failed save without falsely enabling the override', async () => {
    const user = userEvent.setup()
    render(<Editor initial={orderedProgram()} fail />)
    await user.click(screen.getByRole('button', { name: 'Override piece order for Set 1' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed')
    expect(screen.getByRole('button', { name: 'Override piece order for Set 1' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Move High piece down' })).toBeDisabled()
  })

  it('adds a fifth set and explains why an already used starter cannot be added', async () => {
    const user = userEvent.setup()
    const starters = Array.from({ length: 5 }, (_, index) => makeScore({ id: `starter-${index}`, scoreNumber: index + 1, displayNumber: String(index + 1), title: `Starter ${index + 1}` }))
    let initial = createProgramFromStarter(starters[0]!, '2026-11-12T10:00:00Z', 'program')
    for (const starter of starters.slice(1, 4)) initial = addNewSet(initial, starter, initial.updatedAt)
    render(<Editor initial={initial} scores={starters} />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Choose a starting piece' }), starters[0]!.id)
    expect(screen.getByRole('button', { name: 'Add a new set' })).toBeDisabled()
    expect(screen.getByText(/This piece is already in the program/)).toBeVisible()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Choose a starting piece' }), starters[4]!.id)
    await user.click(screen.getByRole('button', { name: 'Add a new set' }))
    expect(await screen.findByRole('textbox', { name: 'Name for Set 5' })).toBeVisible()
    expect(screen.getByText(/0 unused starting pieces available/)).toBeVisible()
  })
})
