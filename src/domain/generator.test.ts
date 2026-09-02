import { DRUMS_WARNING, assertPerformanceValid, generatePerformance, validateFeasibility } from './generator'
import { eligibleScores } from './eligibility'
import { createSeededRandom } from './random'
import { makeScore } from '../test/fixtures'

function pool(size: number, starters = size) {
  return Array.from({ length: size }, (_, index) =>
    makeScore({
      id: `score-${index + 1}`,
      scoreNumber: index + 1,
      displayNumber: String(index + 1).padStart(2, '0'),
      title: `Piece ${index + 1}`,
      hotness: ((index % 3) + 1) as 1 | 2 | 3,
      canStart: index < starters,
      drumsIntro: index % 3 === 0,
      goesHigh: index % 4 === 0,
      tags: index % 2 === 0 ? ['80s'] : [],
    }),
  )
}

describe('eligibility and feasibility', () => {
  it('implements Mix and 80s eligibility', () => {
    const scores = [
      ...pool(2),
      makeScore({ id: 'disabled', enabled: false, tags: ['80s'] }),
      makeScore({ id: 'missing', availability: 'missing', tags: ['80s'] }),
      makeScore({ id: 'pending', configuration: 'pending', canStart: null, tags: ['80s'] }),
    ]
    expect(eligibleScores(scores, 'mix').map((score) => score.id)).toEqual(['score-1', 'score-2'])
    expect(eligibleScores(scores, '80s').map((score) => score.id)).toEqual(['score-1'])
  })

  it('explains invalid limits, score shortages and starter shortages', () => {
    const invalid = validateFeasibility(pool(10), { preset: 'mix', setCount: 0, scoresPerSet: 2, seed: 1 })
    const invalidSize = validateFeasibility(pool(50), { preset: 'mix', setCount: 1, scoresPerSet: 31, seed: 1 })
    const shortage = validateFeasibility(pool(3), { preset: 'mix', setCount: 2, scoresPerSet: 2, seed: 1 })
    const starters = validateFeasibility(pool(4, 1), { preset: 'mix', setCount: 2, scoresPerSet: 2, seed: 1 })
    expect(!invalid.ok && invalid.message).toContain('1 to 12')
    expect(!invalidSize.ok && invalidSize.message).toContain('1 to 30')
    expect(!shortage.ok && shortage.message).toContain('needs 4 eligible scores, but 3')
    expect(!starters.ok && starters.message).toContain('needs 2 distinct starters, but 1')
  })
})

describe('generator', () => {
  it('is deterministic for a seed and input', () => {
    const scores = pool(12, 5)
    const options = { preset: 'mix' as const, setCount: 3, scoresPerSet: 3, seed: 12345 }
    const one = generatePerformance(scores, options, { now: 'now', createId: () => 'performance' })
    const two = generatePerformance(scores, options, { now: 'now', createId: () => 'performance' })
    expect(one).toEqual(two)
    expect(createSeededRandom(2).next()).toBe(createSeededRandom(2).next())
  })

  it('uses hotness as positive weighted-selection input', () => {
    const scores = [makeScore({ id: 'low', hotness: 1 }), makeScore({ id: 'high', scoreNumber: 2, hotness: 3 })]
    const options = { preset: 'mix' as const, setCount: 1, scoresPerSet: 1, seed: 1 }
    const low = generatePerformance(scores, options, { now: 'now', createId: () => 'p', random: { next: () => 0 } })
    const high = generatePerformance(scores, options, { now: 'now', createId: () => 'p', random: { next: () => 0.999 } })
    expect(low.sets[0]?.scores[0]?.hotness).toBe(1)
    expect(high.sets[0]?.scores[0]?.hotness).toBe(3)
  })

  it.each([
    [6, 2, 2, 3],
    [4, 2, 2, 2],
    [5, 5, 1, 1],
    [9, 9, 3, 3],
    [20, 6, 4, 5],
  ])('satisfies every hard invariant over 100 seeds (pool %i)', (size, starters, setCount, scoresPerSet) => {
    for (let seed = 0; seed < 100; seed += 1) {
      const result = generatePerformance(pool(size, starters), { preset: 'mix', setCount, scoresPerSet, seed }, { now: 'now', createId: () => `p-${seed}` })
      expect(() => assertPerformanceValid(result)).not.toThrow()
      const ids = result.sets.flatMap((set) => set.scores.map((score) => score.id))
      expect(new Set(ids).size).toBe(setCount * scoresPerSet)
    }
  })

  it('avoids consecutive drums intros or warns when it must relax', () => {
    const avoidable = pool(6, 2).map((score, index) => ({ ...score, drumsIntro: index < 2 }))
    const result = generatePerformance(avoidable, { preset: 'mix', setCount: 2, scoresPerSet: 3, seed: 4 }, { now: 'now', createId: () => 'p' })
    for (const set of result.sets) {
      expect(set.scores.some((score, index) => index > 0 && score.drumsIntro && set.scores[index - 1]?.drumsIntro)).toBe(false)
    }

    const forced = pool(4, 2).map((score) => ({ ...score, drumsIntro: true }))
    expect(generatePerformance(forced, { preset: 'mix', setCount: 1, scoresPerSet: 4, seed: 1 }, { now: 'now', createId: () => 'p' }).warnings).toContain(DRUMS_WARNING)
  })

  it('places every goes-high piece before regular non-starters in its set', () => {
    const result = generatePerformance(pool(6, 1), { preset: 'mix', setCount: 1, scoresPerSet: 6, seed: 4 }, { now: 'now', createId: () => 'p' })
    const nonStarters = result.sets[0]?.scores.slice(1) ?? []
    expect(nonStarters.map((score) => score.goesHigh)).toEqual([...nonStarters].sort((left, right) => Number(right.goesHigh) - Number(left.goesHigh)).map((score) => score.goesHigh))
  })

  it('fails loudly for corrupt performance snapshots', () => {
    const valid = generatePerformance(pool(4), { preset: 'mix', setCount: 1, scoresPerSet: 2, seed: 1 }, { now: 'now', createId: () => 'p' })
    const first = valid.sets[0]?.scores[0]
    const second = valid.sets[0]?.scores[1]
    if (first && second) second.id = first.id
    expect(() => assertPerformanceValid(valid)).toThrow('duplicate')
    if (first && second) {
      second.id = 'unique-again'
      first.canStart = false
    }
    expect(() => assertPerformanceValid(valid)).toThrow('lacks a starter')

    const invalidOrder = generatePerformance(pool(5), { preset: 'mix', setCount: 1, scoresPerSet: 3, seed: 1 }, { now: 'now', createId: () => 'p' })
    const lateSet = invalidOrder.sets[0]
    if (lateSet) {
      const early = lateSet.scores[1]
      const late = lateSet.scores[2]
      if (early && late) {
        early.goesHigh = false
        late.goesHigh = true
      }
    }
    expect(() => assertPerformanceValid(invalidOrder)).toThrow('goes-high piece is too late')
  })
})
