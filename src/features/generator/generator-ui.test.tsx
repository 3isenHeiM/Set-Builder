import { render, screen } from '@testing-library/react'
import { makePerformance, makeScore } from '../../test/fixtures'
import { GenerateScreen } from './GenerateScreen'
import { PerformanceScreen } from '../performance/PerformanceScreen'

describe('performance UI', () => {
  it('explains infeasibility before generation', () => {
    render(<GenerateScreen scores={[makeScore()]} hasPerformance={false} onGenerated={vi.fn(() => Promise.resolve())} />)
    expect(screen.getByRole('alert')).toHaveTextContent('needs 24 eligible scores, but 1')
    expect(screen.getByRole('button', { name: 'Generate performance' })).toBeDisabled()
  })

  it('renders a stored score snapshot without consulting the current library', () => {
    render(<PerformanceScreen performance={makePerformance()} onRegenerate={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Current performance' })).toBeVisible()
    expect(screen.getByText('Take On Me')).toBeVisible()
    expect(screen.getByText(/Starter/)).toBeVisible()
  })
})
