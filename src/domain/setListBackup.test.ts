import { makePerformance } from '../test/fixtures'
import type { SavedSetList } from './types'
import { createSetListBackup, parseSetListBackupJson, restoreSetList, setListBackupToJson } from './setListBackup'

const saved: SavedSetList = {
  id: 'local-list-id',
  name: 'Parade',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  performance: makePerformance({ sets: [{ ...makePerformance().sets[0]!, name: 'Opening' }] }),
}

describe('set-list export and import', () => {
  it('round trips names, order and score metadata with fresh internal IDs', () => {
    const source = setListBackupToJson(createSetListBackup(saved, '2026-09-02T10:00:00.000Z'))
    let next = 0
    const restored = restoreSetList(parseSetListBackupJson(source), '2026-09-03T10:00:00.000Z', () => `new-${next++}`)
    expect(restored).toMatchObject({ id: 'new-0', name: 'Parade', performance: { generatedAt: saved.performance.generatedAt, sets: [{ name: 'Opening', scores: [{ id: 'new-1', title: 'Take On Me' }] }] } })
    expect(source).not.toContain('local-list-id')
    expect(source).not.toContain('score-1')
  })

  it('rejects malformed, duplicated and non-starter imports', () => {
    expect(() => parseSetListBackupJson('{')).toThrow('not valid JSON')
    const backup = createSetListBackup(saved, '2026-09-02T10:00:00.000Z')
    backup.setList.sets[0]!.scores[0]!.canStart = false
    expect(() => parseSetListBackupJson(JSON.stringify(backup))).toThrow('must start')
    backup.setList.sets[0]!.scores[0]!.canStart = true
    backup.setList.sets[0]!.scores.push({ ...backup.setList.sets[0]!.scores[0]! })
    expect(() => parseSetListBackupJson(JSON.stringify(backup))).toThrow('appears more than once')
  })
})
