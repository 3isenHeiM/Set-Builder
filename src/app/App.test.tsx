import { render, screen } from '@testing-library/react'
import type { FolderScan, GeneratedPerformance, Score } from '../domain/types'
import { makePerformance } from '../test/fixtures'
import { App } from './App'

function storedRepository(performance: GeneratedPerformance) {
  const scores: Score[] = []
  return {
    listScores: (): Promise<Score[]> => Promise.resolve(scores),
    getScore: (): Promise<Score | undefined> => Promise.resolve(undefined),
    saveConfiguration: (): Promise<void> => Promise.resolve(),
    applyReconciliation: (): Promise<FolderScan> => Promise.reject(new Error('unused')),
    getLastScan: (): Promise<FolderScan | undefined> => Promise.resolve(undefined),
    saveLastPerformance: (): Promise<void> => Promise.resolve(),
    getLastPerformance: (): Promise<GeneratedPerformance | undefined> => Promise.resolve(performance),
  }
}

describe('application relaunch', () => {
  it('opens the most recently generated performance', async () => {
    render(<App repository={storedRepository(makePerformance())} />)
    expect(await screen.findByRole('heading', { name: 'Current performance' })).toBeVisible()
    expect(screen.getByText('Take On Me')).toBeVisible()
  })
})
