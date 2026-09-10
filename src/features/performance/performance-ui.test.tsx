import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createSetListBackup, type SetListBackup } from '../../domain/setListBackup'
import type { GeneratedPerformance, PerformanceSet, SavedSet, SavedSetList } from '../../domain/types'
import { makePerformance, makeScore } from '../../test/fixtures'
import { PerformanceScreen } from './PerformanceScreen'

function saved(performance: GeneratedPerformance = makePerformance()): SavedSetList {
  return { id: performance.id, name: 'Parade', createdAt: performance.generatedAt, updatedAt: performance.generatedAt, performance }
}

describe('saved set lists', () => {
  it('renames a set list and imports an exported snapshot', async () => {
    const user = userEvent.setup()
    const setList = saved()
    const onSave = vi.fn<(setList: SavedSetList) => Promise<void>>(() => Promise.resolve())
    const onImport = vi.fn<(backup: SetListBackup) => Promise<void>>(() => Promise.resolve())
    const { container } = render(<PerformanceScreen scores={[]} setList={setList} savedSetLists={[setList]} savedSets={[]} onSave={onSave} onSaveSavedSet={vi.fn(() => Promise.reject(new Error('unused')))} onSelect={vi.fn(() => Promise.resolve())} onImport={onImport} onRegenerate={vi.fn()} />)
    const name = screen.getByRole('textbox', { name: 'Set-list name' })
    await user.clear(name)
    await user.type(name, 'Festival')
    fireEvent.blur(name)
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Festival' })))
    await screen.findByText('Saved.')

    const input = container.querySelector('input[type="file"]')
    if (!input) throw new Error('file input unavailable')
    const source = JSON.stringify(createSetListBackup(setList, '2026-09-02T10:00:00.000Z'))
    fireEvent.change(input, { target: { files: [{ name: 'sets.json', text: () => Promise.resolve(source) }] } })
    expect(await screen.findByText('Set list imported.')).toBeVisible()
    expect(onImport).toHaveBeenCalledOnce()
    expect(onImport.mock.calls[0]?.[0].setList.name).toBe('Parade')
  })

  it('adds an unused ready piece to a set', async () => {
    const user = userEvent.setup()
    const setList = saved()
    const onSave = vi.fn<(setList: SavedSetList) => Promise<void>>(() => Promise.resolve())
    render(<PerformanceScreen scores={[makeScore(), makeScore({ id: 'score-2', scoreNumber: 2, displayNumber: '02', title: 'Africa' })]} setList={setList} savedSetLists={[setList]} savedSets={[]} onSave={onSave} onSaveSavedSet={vi.fn(() => Promise.reject(new Error('unused')))} onSelect={vi.fn(() => Promise.resolve())} onImport={vi.fn(() => Promise.resolve())} onRegenerate={vi.fn()} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Add a piece' }), 'score-2')
    await user.click(screen.getByRole('button', { name: 'Add piece to Set 1' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave.mock.calls[0]?.[0].performance.sets[0]?.scores.map((score) => score.title)).toEqual(['Take On Me', 'Africa'])
  })

  it('names and saves one set for reuse', async () => {
    const user = userEvent.setup()
    const setList = saved()
    const savedSet = { id: 'saved-hot', name: 'Hot Set', createdAt: setList.createdAt, updatedAt: '2026-09-10T11:00:00.000Z', scores: setList.performance.sets[0]!.scores }
    const onSave = vi.fn<(setList: SavedSetList) => Promise<void>>(() => Promise.resolve())
    const onSaveSavedSet = vi.fn<(set: PerformanceSet) => Promise<SavedSet>>(() => Promise.resolve(savedSet))
    render(<PerformanceScreen scores={[]} setList={setList} savedSetLists={[setList]} savedSets={[]} onSave={onSave} onSaveSavedSet={onSaveSavedSet} onSelect={vi.fn(() => Promise.resolve())} onImport={vi.fn(() => Promise.resolve())} onRegenerate={vi.fn()} />)

    const name = screen.getByRole('textbox', { name: 'Name for Set 1' })
    await user.clear(name)
    await user.type(name, 'Hot Set')
    await user.click(screen.getByRole('button', { name: 'Save this set' }))

    await waitFor(() => expect(onSaveSavedSet).toHaveBeenCalledOnce())
    expect(onSaveSavedSet.mock.calls[0]?.[0].name).toBe('Hot Set')
    await screen.findByText('Set saved.')
  })
})
