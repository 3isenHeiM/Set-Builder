import { eligibleScores, toPerformanceSnapshot, type EligibleScore } from './eligibility'
import { createSeededRandom, type RandomSource } from './random'
import type { GeneratedPerformance, PerformanceScoreSnapshot, Preset, Score } from './types'

export const MIN_SETS = 1
export const MAX_SETS = 12
export const MIN_SCORES_PER_SET = 1
export const MAX_SCORES_PER_SET = 30
export const DRUMS_WARNING = 'The drums-intro spacing preference was relaxed because no alternative was available.'

export interface GenerationOptions {
  preset: Preset
  setCount: number
  scoresPerSet: number
  seed: number
}

export type FeasibilityResult =
  | { ok: true; eligible: EligibleScore[]; starterCount: number }
  | { ok: false; message: string }

export function validateFeasibility(scores: readonly Score[], options: GenerationOptions): FeasibilityResult {
  const eligible = eligibleScores(scores, options.preset)
  const starterCount = eligible.filter((score) => score.canStart).length
  if (!Number.isInteger(options.setCount) || options.setCount < MIN_SETS || options.setCount > MAX_SETS) {
    return { ok: false, message: `Sets must be a whole number from ${MIN_SETS} to ${MAX_SETS}.` }
  }
  if (
    !Number.isInteger(options.scoresPerSet) ||
    options.scoresPerSet < MIN_SCORES_PER_SET ||
    options.scoresPerSet > MAX_SCORES_PER_SET
  ) {
    return {
      ok: false,
      message: `Scores per set must be a whole number from ${MIN_SCORES_PER_SET} to ${MAX_SCORES_PER_SET}.`,
    }
  }
  const required = options.setCount * options.scoresPerSet
  if (eligible.length < required) {
    return {
      ok: false,
      message: `This performance needs ${required} eligible scores, but ${eligible.length} are available. Reduce the set size or configure and enable more scores.`,
    }
  }
  if (starterCount < options.setCount) {
    return {
      ok: false,
      message: `This performance needs ${options.setCount} distinct starters, but ${starterCount} are available. Mark more eligible scores as able to start.`,
    }
  }
  return { ok: true, eligible, starterCount }
}

function weightedTake(candidates: EligibleScore[], random: RandomSource): EligibleScore {
  const total = candidates.reduce((sum, score) => sum + score.hotness, 0)
  let target = random.next() * total
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    if (!candidate) continue
    target -= candidate.hotness
    if (target < 0) {
      candidates.splice(index, 1)
      return candidate
    }
  }
  const fallback = candidates.pop()
  if (!fallback) throw new Error('Generator invariant failed: no weighted candidate.')
  return fallback
}

function takeWithDrumsPreference(
  pool: EligibleScore[],
  previous: EligibleScore | undefined,
  random: RandomSource,
): { selected: EligibleScore; relaxed: boolean } {
  let candidates = pool
  let relaxed = false
  if (previous?.drumsIntro) {
    const withoutDrums = pool.filter((score) => !score.drumsIntro)
    if (withoutDrums.length) candidates = withoutDrums
    else relaxed = true
  }
  const selected = weightedTake(candidates, random)
  if (candidates !== pool) {
    const selectedIndex = pool.findIndex((score) => score.id === selected.id)
    if (selectedIndex < 0) throw new Error('Generator invariant failed: candidate already consumed.')
    pool.splice(selectedIndex, 1)
  }
  return { selected, relaxed }
}

function orderSet(set: EligibleScore[], random: RandomSource): { scores: EligibleScore[]; drumsRelaxed: boolean } {
  const starter = set[0]
  if (!starter) throw new Error('Generator invariant failed: set has no starter.')
  const ordered = [starter]
  let drumsRelaxed = false
  const nonStarters = set.slice(1)
  const groups = [nonStarters.filter((score) => score.goesHigh), nonStarters.filter((score) => !score.goesHigh)]

  for (const group of groups) {
    while (group.length) {
      const result = takeWithDrumsPreference(group, ordered[ordered.length - 1], random)
      ordered.push(result.selected)
      drumsRelaxed ||= result.relaxed
    }
  }
  return { scores: ordered, drumsRelaxed }
}

export function assertPerformanceValid(performance: GeneratedPerformance): void {
  if (performance.sets.length !== performance.setCount) throw new Error('Invalid generated performance: set count mismatch.')
  const ids = new Set<string>()
  for (const set of performance.sets) {
    if (set.scores.length !== performance.scoresPerSet) {
      throw new Error(`Invalid generated performance: Set ${set.number} has the wrong score count.`)
    }
    if (!set.scores[0]?.canStart) throw new Error(`Invalid generated performance: Set ${set.number} lacks a starter.`)
    let regularPieceSeen = false
    for (const score of set.scores.slice(1)) {
      if (score.goesHigh && regularPieceSeen) {
        throw new Error(`Invalid generated performance: a goes-high piece is too late in Set ${set.number}.`)
      }
      regularPieceSeen ||= !score.goesHigh
    }
    for (const score of set.scores) {
      if (ids.has(score.id)) throw new Error(`Invalid generated performance: duplicate score ${score.id}.`)
      ids.add(score.id)
    }
  }
}

export interface GenerationDependencies {
  now: string
  createId: () => string
  random?: RandomSource
}

export function generatePerformance(
  scores: readonly Score[],
  options: GenerationOptions,
  dependencies: GenerationDependencies,
): GeneratedPerformance {
  const feasibility = validateFeasibility(scores, options)
  if (!feasibility.ok) throw new Error(feasibility.message)

  const random = dependencies.random ?? createSeededRandom(options.seed)
  const starters = feasibility.eligible.filter((score) => score.canStart)
  const reservedStarters: EligibleScore[] = []
  for (let index = 0; index < options.setCount; index += 1) reservedStarters.push(weightedTake(starters, random))

  const reservedIds = new Set(reservedStarters.map((score) => score.id))
  const remaining = feasibility.eligible.filter((score) => !reservedIds.has(score.id))
  const workingSets: EligibleScore[][] = reservedStarters.map((starter) => [starter])
  let drumsRelaxed = false

  for (const set of workingSets) {
    while (set.length < options.scoresPerSet) {
      const previous = set[set.length - 1]
      const result = takeWithDrumsPreference(remaining, previous, random)
      set.push(result.selected)
      drumsRelaxed ||= result.relaxed
    }
  }

  for (let index = 0; index < workingSets.length; index += 1) {
    const set = workingSets[index]
    if (!set) continue
    const ordered = orderSet(set, random)
    workingSets[index] = ordered.scores
    drumsRelaxed ||= ordered.drumsRelaxed
  }

  const sets = workingSets.map((set, index) => ({
    number: index + 1,
    scores: set.map(toPerformanceSnapshot),
  }))
  const performance: GeneratedPerformance = {
    id: dependencies.createId(),
    generatedAt: dependencies.now,
    preset: options.preset,
    seed: options.seed >>> 0,
    setCount: options.setCount,
    scoresPerSet: options.scoresPerSet,
    sets,
    warnings: drumsRelaxed ? [DRUMS_WARNING] : [],
  }
  assertPerformanceValid(performance)
  return performance
}

export function flattenPerformance(performance: GeneratedPerformance): PerformanceScoreSnapshot[] {
  return performance.sets.flatMap((set) => set.scores)
}
