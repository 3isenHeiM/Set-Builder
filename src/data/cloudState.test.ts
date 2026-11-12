import { makePerformance, makeScore } from '../test/fixtures'
import { CLOUD_STATE_FORMAT, CLOUD_STATE_VERSION, emptyCloudState, parseCloudEnvelope, parseCloudState } from './cloudState'

describe('cloud state validation', () => {
  it('preserves explicit order overrides for programs, last performance and reusable sets', () => {
    const starter = makePerformance().sets[0]!.scores[0]!
    const performance = makePerformance({ scoresPerSet: 3, sets: [{ number: 1, orderOverride: true, scores: [starter, { ...starter, id: 'regular', scoreNumber: 2, displayNumber: '02', canStart: false }, { ...starter, id: 'high', scoreNumber: 3, displayNumber: '03', goesHigh: true, canStart: false }] }] })
    const setList = { id: performance.id, name: 'Custom', createdAt: performance.generatedAt, updatedAt: performance.generatedAt, performance }
    const savedSet = { id: 'reusable', name: 'Custom', createdAt: performance.generatedAt, updatedAt: performance.generatedAt, orderOverride: true, scores: performance.sets[0]!.scores }
    const source = { ...emptyCloudState(), lastPerformance: performance, setLists: [setList], savedSets: [savedSet] }
    const parsed = parseCloudState(JSON.parse(JSON.stringify(source)))
    expect(parsed.lastPerformance).toEqual(performance)
    expect(parsed.setLists).toEqual([setList])
    expect(parsed.savedSets).toEqual([savedSet])
    expect(() => parseCloudState({ ...source, savedSets: [{ ...savedSet, orderOverride: 'true' }] })).toThrow('invalid order override')
    expect(() => parseCloudState({ ...source, savedSets: [{ ...savedSet, orderOverride: false }] })).toThrow('Invalid saved set')
    performance.sets[0]!.orderOverride = false
    expect(() => parseCloudState(source)).toThrow('malformed Set')
  })

  it('accepts a complete library snapshot and sorts its records', () => {
    const second = makeScore({ id: 'score-2', scoreNumber: 2, displayNumber: '02' })
    const first = makeScore()
    const performance = makePerformance()
    const setList = { id: performance.id, name: 'Night', createdAt: performance.generatedAt, updatedAt: performance.generatedAt, performance }
    const savedSet = { id: 'saved-set', name: 'Hot Set', createdAt: performance.generatedAt, updatedAt: performance.generatedAt, scores: performance.sets[0]!.scores }
    const state = parseCloudState({
      ...emptyCloudState(),
      scores: [second, first],
      lastPerformance: performance,
      setLists: [setList],
      savedSets: [savedSet],
    })

    expect(state.scores.map((score) => score.id)).toEqual(['score-1', 'score-2'])
    expect(state.savedSets[0]?.name).toBe('Hot Set')
    expect(parseCloudEnvelope({ revision: 4, state })).toEqual({ revision: 4, state })
  })

  it('rejects legacy five-level heat and inconsistent ready state', () => {
    expect(() => parseCloudState({ ...emptyCloudState(), scores: [makeScore({ hotness: 5 as never })] })).toThrow('invalid number')
    expect(() => parseCloudState({ ...emptyCloudState(), scores: [makeScore({ canStart: null })] })).toThrow('inconsistent')
  })

  it('rejects unsupported formats and duplicate score numbers', () => {
    expect(() => parseCloudState({ ...emptyCloudState(), version: CLOUD_STATE_VERSION + 1 })).toThrow('malformed or unsupported')
    expect(() => parseCloudState({
      ...emptyCloudState(),
      format: CLOUD_STATE_FORMAT,
      scores: [makeScore(), makeScore({ id: 'other' })],
    })).toThrow('duplicate')
  })
})
