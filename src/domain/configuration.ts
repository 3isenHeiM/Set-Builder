import type { BulkConfiguration, ConfigurationStatus, Score, ScoreConfiguration } from './types'

export function configurationStatus(configuration: ScoreConfiguration): ConfigurationStatus {
  return !configuration.enabled
    || (configuration.canStart !== null
      && configuration.hotness !== null
      && configuration.drumsIntro !== null
      && configuration.goesHigh !== null)
    ? 'complete'
    : 'pending'
}

export function applyBulkConfiguration(score: Score, changes: BulkConfiguration, updatedAt: string): Score {
  const next = { ...score, ...changes, updatedAt }
  return { ...next, configuration: configurationStatus(next) }
}
