import { useState } from 'react'
import type { Hotness, Score, ScoreConfiguration } from '../../domain/types'

function configurationFromScore(score: Score): ScoreConfiguration {
  return {
    canStart: score.canStart,
    hotness: score.hotness,
    drumsIntro: score.drumsIntro,
    enabled: score.enabled,
    in80s: score.tags.includes('80s'),
  }
}

interface ConfigurationFieldsProps {
  score: Score
  saveLabel?: string
  progress?: string | undefined
  onSave: (configuration: ScoreConfiguration) => Promise<void>
  onDraftChange?: ((configuration: ScoreConfiguration) => Promise<void>) | undefined
  onClose: () => void
}

export function ConfigurationEditor({ score, saveLabel = 'Save score', progress, onSave, onDraftChange, onClose }: ConfigurationFieldsProps) {
  const [draft, setDraft] = useState(() => configurationFromScore(score))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const valid = draft.canStart !== null && draft.hotness !== null && draft.drumsIntro !== null

  const change = (configuration: ScoreConfiguration) => {
    setDraft(configuration)
    if (onDraftChange) void onDraftChange(configuration).catch(() => setMessage('A change could not be saved. Try again before leaving.'))
  }

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      await onSave(draft)
      setMessage('Score saved on this device.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the score.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="editor-panel" aria-labelledby="edit-score-title">
      {progress && <div className="progress-label" aria-live="polite">{progress}</div>}
      <button type="button" className="text-button" onClick={onClose}>← Back to library</button>
      <div className="score-heading">
        <span className="score-number">{score.displayNumber}</span>
        <h2 id="edit-score-title">{score.title}</h2>
      </div>

      <fieldset className="field-group">
        <legend>Can start a set?</legend>
        <div className="segmented two">
          {[true, false].map((value) => <label key={String(value)}><input type="radio" name="starter" checked={draft.canStart === value} onChange={() => change({ ...draft, canStart: value })} /><span>{value ? 'Yes' : 'No'}</span></label>)}
        </div>
      </fieldset>

      <fieldset className="field-group">
        <legend>Hotness</legend>
        <div className="segmented five">
          {([1, 2, 3, 4, 5] as Hotness[]).map((value) => <label key={value}><input type="radio" name="hotness" checked={draft.hotness === value} onChange={() => change({ ...draft, hotness: value })} /><span aria-label={`Hotness ${value} of 5`}>{value}</span></label>)}
        </div>
        <p className="field-hint">Higher numbers make this score more likely to be selected.</p>
      </fieldset>

      <fieldset className="field-group">
        <legend>Drums intro?</legend>
        <div className="segmented two">
          {[true, false].map((value) => <label key={String(value)}><input type="radio" name="drums" checked={draft.drumsIntro === value} onChange={() => change({ ...draft, drumsIntro: value })} /><span>{value ? 'Yes' : 'No'}</span></label>)}
        </div>
      </fieldset>

      <label className="toggle-row"><input type="checkbox" checked={draft.in80s} onChange={(event) => change({ ...draft, in80s: event.target.checked })} /><span><strong>In the 80s repertoire</strong><small>Eligible for 80s performances once configured.</small></span></label>
      <label className="toggle-row"><input type="checkbox" checked={draft.enabled} onChange={(event) => change({ ...draft, enabled: event.target.checked })} /><span><strong>Enabled for generation</strong><small>Turn off to exclude manually without losing settings.</small></span></label>

      {!valid && <p className="notice" role="status">Choose a starter value, hotness, and drums-intro value to complete configuration.</p>}
      {message && <p className={message.includes('saved') ? 'success' : 'error'} role="status">{message}</p>}
      <button type="button" className="primary-action sticky-action" onClick={() => void save()} disabled={saving || !valid}>{saving ? 'Saving…' : saveLabel}</button>
    </section>
  )
}
