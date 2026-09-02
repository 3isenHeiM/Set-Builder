import { configurationStatus } from './configuration'

const incomplete = {
  in80s: false,
  canStart: null,
  hotness: null,
  drumsIntro: null,
  goesHigh: null,
}

describe('configuration readiness', () => {
  it('considers disabled pieces complete without metric settings', () => {
    expect(configurationStatus({ ...incomplete, enabled: false })).toBe('complete')
  })

  it('requires all metric settings when a piece is enabled', () => {
    expect(configurationStatus({ ...incomplete, enabled: true })).toBe('pending')
    expect(configurationStatus({ ...incomplete, enabled: true, canStart: false, hotness: 1, drumsIntro: false, goesHigh: false })).toBe('complete')
  })
})
