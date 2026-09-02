import { buildFolderSnapshot } from './filename'
import { applyReconciliation, classifyReconciliation } from './reconciliation'
import { makeScore } from '../test/fixtures'

const firstTime = '2026-01-02T10:00:00.000Z'
const secondTime = '2026-01-03T10:00:00.000Z'

describe('reconciliation', () => {
  it('classifies every supported change and does not mutate input', () => {
    const unchanged = makeScore()
    const renamed = makeScore({ id: 'score-2', scoreNumber: 2, displayNumber: '02', title: 'Old' })
    const reappeared = makeScore({ id: 'score-3', scoreNumber: 3, displayNumber: '03', availability: 'missing' })
    const missing = makeScore({ id: 'score-4', scoreNumber: 4, displayNumber: '04', title: 'Vanishing' })
    const renumbered = makeScore({ id: 'score-5', scoreNumber: 5, displayNumber: '05', title: 'Renumber me', tags: ['80s'] })
    const snapshot = buildFolderSnapshot(
      [
        { name: '01 - Take On Me.mscz' },
        { name: '02 - New.mscz' },
        { name: '03 - Take On Me.mscz' },
        { name: '06 - New score.mscz' },
        { name: '07 - RENÚMBER.mscz' },
        { name: 'oops.mscz' },
        { name: '08 - duplicate.mscz' },
        { name: '008 - duplicate two.mscz' },
      ],
      firstTime,
    )
    renumbered.title = 'Renúmber'
    const plan = classifyReconciliation(snapshot, [unchanged, renamed, reappeared, missing, renumbered])
    expect(plan.unchanged.map((change) => change.scoreId)).toEqual(['score-1'])
    expect(plan.renamed.map((change) => change.scoreId)).toEqual(['score-2'])
    expect(plan.reappeared.map((change) => change.scoreId)).toEqual(['score-3'])
    expect(plan.added.map((change) => change.file.scoreNumber)).toEqual([6])
    expect(plan.missing.map((change) => change.scoreId)).toEqual(['score-4', 'score-5'])
    expect(plan.possibleRenumberings.map((change) => change.scoreId)).toEqual(['score-5'])
    expect(plan.malformed).toHaveLength(1)
    expect(plan.duplicates[0]?.files).toHaveLength(2)
    expect(reappeared.availability).toBe('missing')
  })

  it('preserves configuration for rename, disappearance, reappearance and explicit renumbering', () => {
    const original = makeScore({ tags: ['80s'], hotness: 5, drumsIntro: true, canStart: false, enabled: false })
    const renamedPlan = classifyReconciliation(buildFolderSnapshot([{ name: '01 - New Name.mscz' }], firstTime), [original])
    const renamed = applyReconciliation([original], renamedPlan, {}, firstTime, () => 'new-id', 'scan-1').scores[0]
    expect(renamed).toMatchObject({ id: original.id, title: 'New Name', tags: ['80s'], hotness: 5, drumsIntro: true, canStart: false, enabled: false })

    const missingPlan = classifyReconciliation(buildFolderSnapshot([], secondTime), renamed ? [renamed] : [])
    const missing = applyReconciliation(renamed ? [renamed] : [], missingPlan, {}, secondTime, () => 'new-id', 'scan-2').scores[0]
    expect(missing?.availability).toBe('missing')
    const restoredPlan = classifyReconciliation(buildFolderSnapshot([{ name: '01 - New Name.mscz' }], secondTime), missing ? [missing] : [])
    const restored = applyReconciliation(missing ? [missing] : [], restoredPlan, {}, secondTime, () => 'new-id', 'scan-3').scores[0]
    expect(restored).toMatchObject({ id: original.id, availability: 'active', tags: ['80s'], hotness: 5 })

    const renumberPlan = classifyReconciliation(buildFolderSnapshot([{ name: '25 - New Name.mscz' }], secondTime), restored ? [restored] : [])
    const suggestion = renumberPlan.possibleRenumberings[0]
    expect(suggestion).toBeDefined()
    const changed = applyReconciliation(restored ? [restored] : [], renumberPlan, suggestion ? { [suggestion.id]: 'same-score' } : {}, secondTime, () => 'unused', 'scan-4').scores[0]
    expect(changed).toMatchObject({ id: original.id, scoreNumber: 25, displayNumber: '25', tags: ['80s'], hotness: 5 })
  })

  it('is idempotent across repeated snapshots and permits adding a suggested renumbering as new', () => {
    const original = makeScore()
    const snapshot = buildFolderSnapshot([{ name: '99 - Take On Me.mscz' }], firstTime)
    const firstPlan = classifyReconciliation(snapshot, [original])
    const suggestion = firstPlan.possibleRenumberings[0]
    const afterFirst = applyReconciliation([original], firstPlan, suggestion ? { [suggestion.id]: 'add-new' } : {}, firstTime, () => 'score-99', 'scan-1').scores
    expect(afterFirst).toHaveLength(2)
    expect(afterFirst.find((score) => score.id === original.id)?.availability).toBe('missing')

    const secondPlan = classifyReconciliation({ ...snapshot, scannedAt: secondTime }, afterFirst)
    expect(secondPlan.added).toHaveLength(0)
    expect(secondPlan.renamed).toHaveLength(0)
    const afterSecond = applyReconciliation(afterFirst, secondPlan, {}, secondTime, () => 'never', 'scan-2').scores
    expect(afterSecond.map((score) => ({ id: score.id, configuration: score.configuration }))).toEqual(
      afterFirst.map((score) => ({ id: score.id, configuration: score.configuration })),
    )
  })

  it('never marks an existing score missing just because its incoming number is conflicted', () => {
    const original = makeScore()
    const plan = classifyReconciliation(
      buildFolderSnapshot([{ name: '01 - Take On Me.mscz' }, { name: '1 - Other.mscz' }], firstTime),
      [original],
    )
    expect(plan.duplicates).toHaveLength(1)
    expect(plan.missing).toHaveLength(0)
    const applied = applyReconciliation([original], plan, {}, firstTime, () => 'unused', 'scan').scores[0]
    expect(applied).toEqual(original)
  })
})
