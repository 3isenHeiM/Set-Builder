import { useState } from 'react'
import type { Hotness, Score, ScoreConfiguration } from '../../domain/types'
import { UiIcon } from '../../app/UiIcon'

function configurationFromScore(score: Score): ScoreConfiguration {
  return {
    canStart: score.canStart,
    hotness: score.hotness,
    drumsIntro: score.drumsIntro,
    goesHigh: score.goesHigh,
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
  const valid = draft.canStart !== null && draft.hotness !== null && draft.drumsIntro !== null && draft.goesHigh !== null
  const answered = [draft.canStart, draft.hotness, draft.drumsIntro, draft.goesHigh].filter((value) => value !== null).length
  const hotnessLabels = ['Low', 'Medium', 'High'] as const

  const change = (configuration: ScoreConfiguration) => {
    setDraft(configuration)
    if (onDraftChange) void onDraftChange(configuration).catch(() => setMessage('Save failed. Try again.'))
  }

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      await onSave(draft)
      setMessage('Saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the score.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="editor-panel" aria-labelledby="edit-score-title">
      {progress && <div className="progress-label" aria-live="polite">{progress}</div>}
      <button type="button" className="text-button icon-text" onClick={onClose}><UiIcon name="back" />Back</button>
      <div className="score-heading">
        <span className="score-number">{score.displayNumber}</span>
        <h1 id="edit-score-title">{score.title}</h1>
      </div>

      <div className={`metric-progress ${valid ? 'complete' : ''}`} aria-live="polite">
        <span>{valid ? 'Ready for sets' : `${answered} / 4 set`}</span>
        <div className="metric-track" role="progressbar" aria-label="Score configuration" aria-valuemin={0} aria-valuemax={4} aria-valuenow={answered}><span style={{ width: `${answered * 25}%` }} /></div>
      </div>

      <div className="metric-grid">
        <fieldset className={`field-group metric-card metric-wide ${draft.canStart !== null ? 'answered' : ''}`}>
          <legend><span className="metric-icon"><UiIcon name="start" /></span><span>Can start?</span>{draft.canStart !== null && <span className="metric-check"><UiIcon name="check" /></span>}</legend>
          <div className="segmented two">
            {[true, false].map((value) => <label key={String(value)}><input type="radio" name="starter" checked={draft.canStart === value} onChange={() => change({ ...draft, canStart: value })} /><span>{value ? 'Yes' : 'No'}</span></label>)}
          </div>
        </fieldset>

        <fieldset className={`field-group metric-card metric-wide ${draft.hotness !== null ? 'answered' : ''}`}>
          <legend><span className="metric-icon"><UiIcon name="heat" /></span><span>Hotness</span>{draft.hotness !== null && <span className="metric-check"><UiIcon name="check" /></span>}</legend>
          <div className="segmented three hotness-scale">
            {([1, 2, 3] as Hotness[]).map((value) => <label key={value}><input type="radio" name="hotness" checked={draft.hotness === value} onChange={() => change({ ...draft, hotness: value })} /><span aria-label={`Hotness ${value} of 3`}><strong>{value}</strong><small>{hotnessLabels[value - 1]}</small></span></label>)}
          </div>
        </fieldset>

        <fieldset className={`field-group metric-card ${draft.drumsIntro !== null ? 'answered' : ''}`}>
          <legend><span className="metric-icon"><UiIcon name="drum" /></span><span>Drums intro</span>{draft.drumsIntro !== null && <span className="metric-check"><UiIcon name="check" /></span>}</legend>
          <div className="segmented two">
            {[true, false].map((value) => <label key={String(value)}><input type="radio" name="drums" checked={draft.drumsIntro === value} onChange={() => change({ ...draft, drumsIntro: value })} /><span>{value ? 'Yes' : 'No'}</span></label>)}
          </div>
          <p className="field-hint">Spaced apart.</p>
        </fieldset>

        <fieldset className={`field-group metric-card ${draft.goesHigh !== null ? 'answered' : ''}`}>
          <legend><span className="metric-icon"><UiIcon name="high" /></span><span>Goes high?</span>{draft.goesHigh !== null && <span className="metric-check"><UiIcon name="check" /></span>}</legend>
          <div className="segmented two">
            {[true, false].map((value) => <label key={String(value)}><input type="radio" name="goes-high" checked={draft.goesHigh === value} onChange={() => change({ ...draft, goesHigh: value })} /><span>{value ? 'Yes' : 'No'}</span></label>)}
          </div>
          <p className="field-hint">Placed early.</p>
        </fieldset>
      </div>

      <label className="toggle-row"><input type="checkbox" checked={draft.in80s} onChange={(event) => change({ ...draft, in80s: event.target.checked })} /><span><strong>80s repertoire</strong><small>Include in 80s sets.</small></span></label>
      <label className="toggle-row"><input type="checkbox" checked={draft.enabled} onChange={(event) => change({ ...draft, enabled: event.target.checked })} /><span><strong>Enabled</strong><small>Include in generated sets.</small></span></label>

      {!valid && <p className="notice" role="status">Complete the four fields to use this piece.</p>}
      {message && <p className={message === 'Saved.' ? 'success' : 'error'} role="status">{message}</p>}
      <button type="button" className="primary-action sticky-action" onClick={() => void save()} disabled={saving || !valid}>{saving ? 'Saving…' : saveLabel}</button>
    </section>
  )
}
