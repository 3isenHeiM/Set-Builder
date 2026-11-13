import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makePerformance, makeScore } from '../../test/fixtures'
import { GenerateScreen } from './GenerateScreen'
import { PerformanceScreen } from '../performance/PerformanceScreen'
import type { GeneratedPerformance, SavedSetList } from '../../domain/types'

function saved(performance: GeneratedPerformance = makePerformance()): SavedSetList {
  return { id: performance.id, name: 'Parade', createdAt: performance.generatedAt, updatedAt: performance.generatedAt, performance }
}

describe('performance UI', () => {
  it('updates the requested program totals and shows a placeholder for incomplete or invalid inputs', async () => {
    const user = userEvent.setup()
    render(<GenerateScreen scores={[]} hasPerformance={false} onGenerated={vi.fn()} />)
    const summary = screen.getByRole('status', { name: 'Program summary' })
    expect(summary).toHaveTextContent('3 sets · 24 pieces')
    await user.click(screen.getByRole('button', { name: 'Increase Sets' }))
    expect(summary).toHaveTextContent('4 sets · 32 pieces')
    await user.clear(screen.getByRole('spinbutton', { name: 'Pieces per set' }))
    expect(summary).toHaveTextContent('4 sets · — pieces')
    await user.type(screen.getByRole('spinbutton', { name: 'Pieces per set' }), '1')
    expect(summary).toHaveTextContent('4 sets · 4 pieces')
    await user.clear(screen.getByRole('spinbutton', { name: 'Sets' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Sets' }), '13')
    expect(summary).toHaveTextContent('— sets · — pieces')
    expect(summary).not.toHaveTextContent(/NaN|Infinity/)
  })

  it.each([5, 12])('generates %i sets with touch controls and enforces the documented maximum', async (count) => {
    const user = userEvent.setup()
    const scores = Array.from({ length: 96 }, (_, index) => makeScore({ id: `piece-${index}`, scoreNumber: index + 1, displayNumber: String(index + 1) }))
    const onGenerated = vi.fn<(performance: GeneratedPerformance) => Promise<void>>(() => Promise.resolve())
    render(<GenerateScreen scores={scores} hasPerformance={false} onGenerated={onGenerated} />)
    for (let current = 3; current < count; current += 1) await user.click(screen.getByRole('button', { name: 'Increase Sets' }))
    expect(screen.getByRole('spinbutton', { name: 'Sets' })).toHaveValue(count)
    if (count === 12) expect(screen.getByRole('button', { name: 'Increase Sets' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Generate sets' }))
    expect(onGenerated.mock.calls[0]?.[0].sets).toHaveLength(count)
    expect(onGenerated.mock.calls[0]?.[0].sets.every((set) => set.scores.length === 8 && set.scores[0]?.canStart)).toBe(true)
    await user.clear(screen.getByRole('spinbutton', { name: 'Sets' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Sets' }), '13')
    expect(screen.getByRole('button', { name: 'Generate sets' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('1 to 12')
  })

  it('uses collections for generation without a separate 80s repertoire option', async () => {
    const user = userEvent.setup()
    render(<GenerateScreen scores={[makeScore({ collection: 'Christmas' }), makeScore({ id: 'other', scoreNumber: 2, displayNumber: '02', collection: 'General' })]} collections={['General', 'Christmas']} hasPerformance={false} onGenerated={vi.fn()} />)
    expect(screen.queryByRole('radio', { name: /80s/ })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Collection' }), 'Christmas')
    expect(screen.getByRole('alert')).toHaveTextContent('but 1 are available')
    await user.clear(screen.getByRole('spinbutton', { name: 'Sets' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Sets' }), '1')
    await user.clear(screen.getByRole('spinbutton', { name: 'Pieces per set' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Pieces per set' }), '1')
    expect(screen.getByRole('button', { name: 'Generate sets' })).toBeEnabled()
  })
  it('explains infeasibility before generation', () => {
    render(<GenerateScreen scores={[makeScore()]} hasPerformance={false} onGenerated={vi.fn(() => Promise.resolve())} />)
    expect(screen.getByRole('alert')).toHaveTextContent('needs 24 eligible scores, but 1')
    expect(screen.getByRole('button', { name: 'Generate sets' })).toBeDisabled()
  })

  it('renders a stored score snapshot without consulting the current library', () => {
    const setList = saved()
    render(<PerformanceScreen scores={[]} setList={setList} savedSetLists={[setList]} savedSets={[]} onSave={vi.fn(() => Promise.resolve())} onSaveSavedSet={vi.fn(() => Promise.reject(new Error('unused')))} onCreateProgram={vi.fn(() => Promise.reject(new Error('unused')))} onSelect={vi.fn(() => Promise.resolve())} onImport={vi.fn(() => Promise.resolve())} onRegenerate={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Parade' })).toBeVisible()
    expect(screen.getByText('Take On Me')).toBeVisible()
    expect(screen.getByText('Start', { exact: true })).toBeVisible()
    expect(screen.queryByText(/^[HI][123](?:\s|$)/)).not.toBeInTheDocument()
  })
})
