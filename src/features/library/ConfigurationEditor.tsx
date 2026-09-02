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

function BinarySwitch({ name, value, onChange }: { name: string; value: boolean | null; onChange: (value: boolean) => void }) {
  return (
    <div className={`binary-switch ${value === null ? 'unset' : value ? 'on' : 'off'}`}>
      {[false, true].map((option) => (
        <label key={String(option)}>
          <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} />
          <span>{option ? 'Yes' : 'No'}</span>
        </label>
      ))}
    </div>
  )
}

export function ConfigurationEditor({ score, saveLabel = 'Save score', progress, onSave, onDraftChange, onClose }: ConfigurationFieldsProps) {
  const [draft, setDraft] = useState(() => configurationFromScore(score))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const valid = draft.canStart !== null && draft.hotness !== null && draft.drumsIntro !== null && draft.goesHigh !== null
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

      <div className="metric-grid">
        <fieldset className={`field-group metric-card metric-wide metric-start ${draft.canStart !== null ? 'answered' : ''}`}>
          <legend><span className="metric-icon"><UiIcon name="start" /></span><span>Can start a set?</span></legend>
          <BinarySwitch name="starter" value={draft.canStart} onChange={(value) => change({ ...draft, canStart: value })} />
        </fieldset>

        <fieldset className={`field-group metric-card metric-wide metric-hotness ${draft.hotness !== null ? 'answered' : ''}`}>
          <legend><span className="metric-icon"><UiIcon name="heat" /></span><span>Hotness</span></legend>
          <div className="heat-scale">
            {([1, 2, 3] as Hotness[]).map((value) => <label key={value}><input type="radio" name="hotness" checked={draft.hotness === value} onChange={() => change({ ...draft, hotness: value })} /><span className={`heat-choice heat-${value}`} aria-label={`Hotness ${hotnessLabels[value - 1]}, ${value} of 3`}><span className="heat-bars" aria-hidden="true">{([1, 2, 3] as const).map((step) => <i className={step <= value ? 'lit' : ''} key={step} />)}</span><strong>{hotnessLabels[value - 1]}</strong></span></label>)}
          </div>
        </fieldset>

        <fieldset className={`field-group metric-card metric-drums ${draft.drumsIntro !== null ? 'answered' : ''}`}>
          <legend><span className="metric-icon"><UiIcon name="drum" /></span><span>Drums intro</span></legend>
          <BinarySwitch name="drums" value={draft.drumsIntro} onChange={(value) => change({ ...draft, drumsIntro: value })} />
          <p className="field-hint">Spaced apart.</p>
        </fieldset>

        <fieldset className={`field-group metric-card metric-high ${draft.goesHigh !== null ? 'answered' : ''}`}>
          <legend><span className="metric-icon"><UiIcon name="high" /></span><span>Goes high?</span></legend>
          <BinarySwitch name="goes-high" value={draft.goesHigh} onChange={(value) => change({ ...draft, goesHigh: value })} />
          <p className="field-hint">Placed early.</p>
        </fieldset>
      </div>

      <div className="preference-stack">
        <label className="toggle-row toggle-80s"><span className="toggle-copy"><strong>80s repertoire</strong><small>Include in 80s sets.</small></span><input role="switch" type="checkbox" checked={draft.in80s} onChange={(event) => change({ ...draft, in80s: event.target.checked })} /><span className="switch-control" aria-hidden="true"><span /></span></label>
        <label className="toggle-row toggle-enabled"><span className="toggle-copy"><strong>Enabled</strong><small>Include in generated sets.</small></span><input role="switch" type="checkbox" checked={draft.enabled} onChange={(event) => change({ ...draft, enabled: event.target.checked })} /><span className="switch-control" aria-hidden="true"><span /></span></label>
      </div>

      {!valid && <p className="notice" role="status">Complete the four fields to use this piece.</p>}
      {message && <p className={message === 'Saved.' ? 'success' : 'error'} role="status">{message}</p>}
      <button type="button" className="primary-action sticky-action" onClick={() => void save()} disabled={saving || !valid}>{saving ? 'Saving…' : saveLabel}</button>
    </section>
  )
}
