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
  const { in80s, ...fields } = changes
  const tags = in80s === undefined ? score.tags : in80s ? [...new Set([...score.tags, '80s'])] : score.tags.filter((tag) => tag !== '80s')
  const next = { ...score, ...fields, tags, updatedAt }
  return { ...next, configuration: configurationStatus({ ...next, in80s: tags.includes('80s') }) }
}
