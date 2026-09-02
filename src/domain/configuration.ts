import type { ConfigurationStatus, ScoreConfiguration } from './types'

export function configurationStatus(configuration: ScoreConfiguration): ConfigurationStatus {
  return !configuration.enabled
    || (configuration.canStart !== null
      && configuration.hotness !== null
      && configuration.drumsIntro !== null
      && configuration.goesHigh !== null)
    ? 'complete'
    : 'pending'
}
