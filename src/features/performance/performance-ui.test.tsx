import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createSetListBackup, type SetListBackup } from '../../domain/setListBackup'
import type { GeneratedPerformance, SavedSetList } from '../../domain/types'
import { makePerformance } from '../../test/fixtures'
import { PerformanceScreen } from './PerformanceScreen'

function saved(performance: GeneratedPerformance = makePerformance()): SavedSetList {
  return { id: performance.id, name: 'Parade', createdAt: performance.generatedAt, updatedAt: performance.generatedAt, performance }
}

describe('saved set lists', () => {
  it('renames a set list and imports an exported snapshot', async () => {
    const user = userEvent.setup()
    const setList = saved()
    const onSave = vi.fn(() => Promise.resolve())
    const onImport = vi.fn<(backup: SetListBackup) => Promise<void>>(() => Promise.resolve())
    const { container } = render(<PerformanceScreen setList={setList} savedSetLists={[setList]} onSave={onSave} onSelect={vi.fn(() => Promise.resolve())} onImport={onImport} onRegenerate={vi.fn()} />)
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
})
