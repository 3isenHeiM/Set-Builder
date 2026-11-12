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
    expect(screen.getByText(/^H2 · Start$/)).toBeVisible()
  })
})
