import type { GeneratedPerformance, Score } from '../domain/types'

export function makeScore(overrides: Partial<Score> = {}): Score {
  return {
    id: 'score-1',
    scoreNumber: 1,
    displayNumber: '01',
    title: 'Take On Me',
    fileName: '01 - Take On Me.mscz',
    relativePath: 'Scores/01 - Take On Me.mscz',
    availability: 'active',
    configuration: 'complete',
    canStart: true,
    hotness: 2,
    drumsIntro: false,
    enabled: true,
    tags: [],
    firstImportedAt: '2026-01-01T10:00:00.000Z',
    lastSeenAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  }
}

export function makePerformance(overrides: Partial<GeneratedPerformance> = {}): GeneratedPerformance {
  return {
    id: 'performance-1',
    generatedAt: '2026-01-02T10:00:00.000Z',
    preset: 'mix',
    seed: 123,
    setCount: 1,
    scoresPerSet: 1,
    sets: [
      {
        number: 1,
        scores: [
          {
            id: 'score-1',
            scoreNumber: 1,
            displayNumber: '01',
            title: 'Take On Me',
            hotness: 2,
            drumsIntro: false,
            canStart: true,
          },
        ],
      },
    ],
    warnings: [],
    ...overrides,
  }
}
