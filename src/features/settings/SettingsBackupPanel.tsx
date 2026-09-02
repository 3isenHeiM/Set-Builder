import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  createSettingsBackup,
  parseSettingsBackupJson,
  previewSettingsImport,
  settingsBackupToJson,
} from '../../domain/settingsBackup'
import type { SettingsBackup, SettingsImportReport } from '../../domain/settingsBackup'
import type { Score } from '../../domain/types'

interface SettingsBackupPanelProps {
  scores: Score[]
  onImport: (backup: SettingsBackup) => Promise<SettingsImportReport>
}

interface ImportPreview {
  backup: SettingsBackup
  report: SettingsImportReport
}

function downloadName(exportedAt: string): string {
  return `piece-selector-settings-${exportedAt.slice(0, 10)}.json`
}

export function SettingsBackupPanel({ scores, onImport }: SettingsBackupPanelProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportPreview>()
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [applying, setApplying] = useState(false)

  const download = () => {
    const exportedAt = new Date().toISOString()
    const backup = createSettingsBackup(scores, exportedAt)
    const url = URL.createObjectURL(new Blob([settingsBackupToJson(backup)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = downloadName(exportedAt)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setError('')
    setStatus(`${backup.pieces.length} ${backup.pieces.length === 1 ? 'piece' : 'pieces'} exported.`)
  }

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    setError('')
    setStatus('')
    setPreview(undefined)

    if (!file.name.toLocaleLowerCase().endsWith('.json')) {
      setError('Choose a Piece Selector .json settings file.')
      return
    }

    try {
      // This explicitly selected JSON contains settings only; score files are never read.
      const backup = parseSettingsBackupJson(await file.text())
      setPreview({ backup, report: previewSettingsImport(scores, backup) })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The settings file could not be opened.')
    }
  }

  const apply = async () => {
    if (!preview || preview.report.matched === 0) return
    setApplying(true)
    setError('')
    try {
      const report = await onImport(preview.backup)
      setPreview(undefined)
      setStatus(`${report.matched} ${report.matched === 1 ? 'piece' : 'pieces'} imported.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No settings were changed.')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="info-card settings-backup">
      <h2>Settings backup</h2>
      <p>Browser storage can be cleared.</p>
      <div className="settings-actions">
        <button type="button" className="secondary-action" disabled={scores.length === 0} onClick={download}>Download settings</button>
        <button type="button" className="secondary-action" onClick={() => fileInput.current?.click()}>Import settings</button>
        <input ref={fileInput} className="hidden-input" type="file" accept=".json,application/json" onChange={(event) => { void selectFile(event) }} />
      </div>
      <details><summary>Backup details</summary><p>Names and settings only. Imports match by number; files and sets are excluded.</p></details>

      {preview && (
        <div className="settings-preview" aria-labelledby="settings-preview-title">
          <h3 id="settings-preview-title">Import preview</h3>
          <dl className="backup-summary">
            <div><dt>In file</dt><dd>{preview.backup.pieces.length}</dd></div>
            <div><dt>Matched</dt><dd>{preview.report.matched}</dd></div>
            <div><dt>Missing</dt><dd>{preview.report.notFound}</dd></div>
            <div><dt>Renamed</dt><dd>{preview.report.titleMismatches.length}</dd></div>
          </dl>
          {preview.report.titleMismatches.length > 0 && (
            <details>
              <summary>Renamed pieces</summary>
              <ul className="plain-list">
                {preview.report.titleMismatches.map((item) => (
                  <li key={item.scoreNumber}><strong>{item.scoreNumber}</strong>: {item.backupName} → {item.currentName}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="action-row">
            <button type="button" className="secondary-action" disabled={applying} onClick={() => setPreview(undefined)}>Cancel</button>
            <button type="button" className="primary-action" disabled={applying || preview.report.matched === 0} onClick={() => { void apply() }}>{applying ? 'Importing…' : 'Import matched'}</button>
          </div>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {status && <p className="success" role="status">{status}</p>}
    </div>
  )
}
