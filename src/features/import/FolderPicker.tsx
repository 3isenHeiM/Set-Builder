import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { buildFolderSnapshot } from '../../domain/filename'
import type { FolderSnapshot } from '../../domain/types'

function browserSupportsFolderSelection(): boolean {
  return 'webkitdirectory' in HTMLInputElement.prototype
}

interface FolderPickerProps {
  mode: 'import' | 'realign'
  onSnapshot: (snapshot: FolderSnapshot) => void
  directorySupport?: boolean
}

export function FolderPicker({ mode, onSnapshot, directorySupport = browserSupportsFolderSelection() }: FolderPickerProps) {
  const directoryInput = useRef<HTMLInputElement>(null)
  const fallbackInput = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [selectionStatus, setSelectionStatus] = useState('')

  useEffect(() => {
    if (directorySupport) directoryInput.current?.setAttribute('webkitdirectory', '')
  }, [directorySupport])

  const selected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files
    if (!files?.length) {
      setSelectionStatus('No folder was selected. Your library has not changed.')
      return
    }
    // File contents never cross this metadata-only boundary.
    const snapshot = buildFolderSnapshot(files, new Date().toISOString())
    event.currentTarget.value = ''
    setSelectionStatus(`Scanned ${files.length} file ${files.length === 1 ? 'name' : 'names'} for review.`)
    onSnapshot(snapshot)
  }

  const action = mode === 'import' ? 'Import scores from this folder' : 'Re-align with scores folder'
  return (
    <section className="folder-picker" aria-labelledby={`${inputId}-heading`}>
      <h2 id={`${inputId}-heading`} className="sr-only">{action}</h2>
      {directorySupport ? (
        <>
          <input ref={directoryInput} id={inputId} className="hidden-input" type="file" accept=".mscz" multiple onChange={selected} />
          <button className="primary-action" type="button" onClick={() => directoryInput.current?.click()}>{action}</button>
        </>
      ) : (
        <>
          <p className="notice">Folder selection is unavailable in this browser. Select the scores together instead; nested folder paths may be unavailable.</p>
          <input ref={fallbackInput} id={inputId} className="hidden-input" type="file" accept=".mscz" multiple onChange={selected} />
          <button className="primary-action" type="button" onClick={() => fallbackInput.current?.click()}>{action}</button>
        </>
      )}
      <p className="picker-note">Only `.mscz` filenames are inspected. Music files are never read or copied.</p>
      <p className="sr-only" aria-live="polite">{selectionStatus}</p>
    </section>
  )
}
