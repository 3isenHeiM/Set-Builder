import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createSettingsBackup, settingsBackupToJson } from '../../domain/settingsBackup'
import type { SettingsBackup, SettingsImportReport } from '../../domain/settingsBackup'
import { makeScore } from '../../test/fixtures'
import { SettingsBackupPanel } from './SettingsBackupPanel'

describe('settings import', () => {
  it('previews an explicitly selected settings JSON before restoring matched pieces', async () => {
    const scores = [makeScore({ title: 'Current title' })]
    const backup = createSettingsBackup([makeScore({ title: 'Backup title' })], '2026-09-01T12:00:00.000Z')
    const onImport = vi.fn<(backup: SettingsBackup) => Promise<SettingsImportReport>>(() => Promise.resolve({ matched: 1, notFound: 0, titleMismatches: [] }))
    const { container } = render(<SettingsBackupPanel scores={scores} onImport={onImport} />)
    const input = container.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('file input not rendered')

    fireEvent.change(input, { target: { files: [{ name: 'piece-selector-settings.json', text: () => Promise.resolve(settingsBackupToJson(backup)) }] } })

    expect(await screen.findByRole('heading', { name: 'Import preview' })).toBeVisible()
    fireEvent.click(screen.getByText('Renamed pieces'))
    expect(screen.getByText((_content, element) => element?.tagName === 'LI' && element.textContent?.includes('Backup title → Current title') === true)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Import matched' }))
    await waitFor(() => expect(onImport).toHaveBeenCalledWith(backup))
    expect(await screen.findByRole('status')).toHaveTextContent('1 piece imported.')
  })

  it('reports an invalid settings file without applying anything', async () => {
    const onImport = vi.fn<(backup: SettingsBackup) => Promise<SettingsImportReport>>()
    const { container } = render(<SettingsBackupPanel scores={[]} onImport={onImport} />)
    const input = container.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('file input not rendered')

    fireEvent.change(input, { target: { files: [{ name: 'bad.json', text: () => Promise.resolve('{bad') }] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('Settings file is not valid JSON.')
    expect(onImport).not.toHaveBeenCalled()
  })
})
