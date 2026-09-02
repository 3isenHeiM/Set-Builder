import { render, screen } from '@testing-library/react'
import { makePerformance, makeScore } from '../../test/fixtures'
import { GenerateScreen } from './GenerateScreen'
import { PerformanceScreen } from '../performance/PerformanceScreen'
import type { GeneratedPerformance, SavedSetList } from '../../domain/types'

function saved(performance: GeneratedPerformance = makePerformance()): SavedSetList {
  return { id: performance.id, name: 'Parade', createdAt: performance.generatedAt, updatedAt: performance.generatedAt, performance }
}

describe('performance UI', () => {
  it('explains infeasibility before generation', () => {
    render(<GenerateScreen scores={[makeScore()]} hasPerformance={false} onGenerated={vi.fn(() => Promise.resolve())} />)
    expect(screen.getByRole('alert')).toHaveTextContent('needs 24 eligible scores, but 1')
    expect(screen.getByRole('button', { name: 'Generate sets' })).toBeDisabled()
  })

  it('renders a stored score snapshot without consulting the current library', () => {
    const setList = saved()
    render(<PerformanceScreen setList={setList} savedSetLists={[setList]} onSave={vi.fn(() => Promise.resolve())} onSelect={vi.fn(() => Promise.resolve())} onImport={vi.fn(() => Promise.resolve())} onRegenerate={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Parade' })).toBeVisible()
    expect(screen.getByText('Take On Me')).toBeVisible()
    expect(screen.getByText(/Start/)).toBeVisible()
  })
})
