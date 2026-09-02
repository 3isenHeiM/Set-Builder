import type { Hotness, PerformanceScoreSnapshot, Preset, Score } from './types'

export interface EligibleScore extends Score {
  configuration: 'complete'
  availability: 'active'
  canStart: boolean
  hotness: Hotness
  drumsIntro: boolean
  goesHigh: boolean
}

export function isFullyConfigured(score: Score): score is EligibleScore {
  return (
    score.configuration === 'complete' &&
    score.availability === 'active' &&
    score.enabled &&
    score.canStart !== null &&
    score.hotness !== null &&
    score.drumsIntro !== null &&
    score.goesHigh !== null
  )
}

export function isEligibleForPreset(score: Score, preset: Preset): score is EligibleScore {
  return isFullyConfigured(score) && (preset === 'mix' || score.tags.includes('80s'))
}

export function eligibleScores(scores: readonly Score[], preset: Preset): EligibleScore[] {
  return scores.filter((score) => isEligibleForPreset(score, preset))
}

export function toPerformanceSnapshot(score: EligibleScore): PerformanceScoreSnapshot {
  return {
    id: score.id,
    scoreNumber: score.scoreNumber,
    displayNumber: score.displayNumber,
    title: score.title,
    hotness: score.hotness,
    drumsIntro: score.drumsIntro,
    goesHigh: score.goesHigh,
    canStart: score.canStart,
  }
}
