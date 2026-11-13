import { emptyDrummerTiming } from './drummerNotes'
import { parseSharedSetList, toSharedSetList } from './sharedSetList'
import { makeScore, makeSetList } from '../test/fixtures'
import type { DrummerTiming } from './types'

const timing: DrummerTiming = { bpm: 120, beat: 'half', measure: '6/8', anacrusis: 1.5 }

describe('drummer details in older shared setlists', () => {
  it('fills missing fields by immutable piece ID without changing the frozen program', () => {
    const saved = makeSetList({ locked: true })
    const original = structuredClone(saved)
    const piece = makeScore({ collection: 'Renamed collection', title: 'New library title', drummerTiming: timing, drummerNotes: 'Quiet verse' })
    const shared = parseSharedSetList(toSharedSetList(saved, [piece]))
    expect(shared.sets[0]?.scores[0]).toMatchObject({ title: 'Take On Me', collection: 'General', drummerTiming: timing, drummerNotes: 'Quiet verse' })
    expect(saved).toEqual(original)
    for (const field of ['score-1', 'fileName', 'relativePath']) expect(JSON.stringify(shared)).not.toContain(field)
  })

  it('matches imported copies by collection and identifier', () => {
    const saved = makeSetList({ locked: true })
    const score = saved.performance.sets[0]!.scores[0]!
    score.id = 'imported-copy'
    score.collection = ' general '
    const shared = toSharedSetList(saved, [makeScore({ drummerTiming: timing, drummerNotes: 'Shared detail' }), makeScore({ id: 'other', collection: 'Christmas', drummerTiming: { ...timing, bpm: 200 }, drummerNotes: 'Other collection detail' })])
    expect(shared.sets[0]?.scores).toHaveLength(1)
    expect(shared.sets[0]?.scores.every((piece) => piece.drummerTiming?.bpm === 120 && piece.drummerNotes === 'Shared detail')).toBe(true)
    expect(JSON.stringify(shared)).not.toContain('Other collection detail')
  })

  it('keeps saved timing, no pickup, and cleared text over newer library values', () => {
    const saved = makeSetList({ locked: true })
    const savedTiming = { ...timing, anacrusis: null }
    Object.assign(saved.performance.sets[0]!.scores[0]!, { drummerTiming: savedTiming, drummerNotes: '' })
    const piece = makeScore({ drummerTiming: { ...timing, bpm: 200 }, drummerNotes: 'New library note' })
    expect(toSharedSetList(saved, [piece]).sets[0]?.scores[0]).toMatchObject({ drummerTiming: savedTiming, drummerNotes: '' })
  })

  it('fills timing left blank when locking without changing the saved blank fields', () => {
    const saved = makeSetList({ locked: true })
    const blank = emptyDrummerTiming()
    Object.assign(saved.performance.sets[0]!.scores[0]!, { drummerTiming: blank, drummerNotes: '' })
    const original = structuredClone(saved)
    expect(toSharedSetList(saved, [makeScore({ drummerTiming: timing })]).sets[0]?.scores[0]).toMatchObject({ drummerTiming: timing, drummerNotes: '' })
    expect(saved).toEqual(original)
    expect(toSharedSetList(saved).sets[0]?.scores[0]?.drummerTiming).toEqual(blank)
  })

  it('does not borrow details from an unrelated piece or collection', () => {
    const saved = makeSetList()
    saved.performance.sets[0]!.scores[0]!.id = 'unmatched'
    const unrelated = [makeScore({ id: 'other', collection: 'Christmas', drummerTiming: timing }), makeScore({ id: 'another', scoreNumber: 2, displayNumber: '02', drummerNotes: 'Private note' })]
    expect(toSharedSetList(saved, unrelated)).toEqual(toSharedSetList(saved))
  })
})
