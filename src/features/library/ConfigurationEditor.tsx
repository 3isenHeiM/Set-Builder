import { useState } from 'react'
import type { Hotness, Score, ScoreConfiguration } from '../../domain/types'
import { UiIcon } from '../../app/UiIcon'
import { localizedError, useI18n } from '../../app/i18n'
import { configurationStatus } from '../../domain/configuration'

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
  const { t } = useI18n()
  return (
    <div className={`binary-switch ${value === null ? 'unset' : value ? 'on' : 'off'}`}>
      {[false, true].map((option) => (
        <label key={String(option)}>
          <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} />
          <span>{option ? t('yes') : t('no')}</span>
        </label>
      ))}
    </div>
  )
}

export function ConfigurationEditor({ score, saveLabel = 'Save score', progress, onSave, onDraftChange, onClose }: ConfigurationFieldsProps) {
  const { locale, t } = useI18n()
  const [draft, setDraft] = useState(() => configurationFromScore(score))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const valid = configurationStatus(draft) === 'complete'
  const hotnessLabels: Record<Hotness, string> = { 1: t('low'), 2: t('medium'), 3: t('high') }

  const change = (configuration: ScoreConfiguration) => {
    setDraft(configuration)
    if (onDraftChange) void onDraftChange(configuration).catch((error: unknown) => setMessage(localizedError(error, locale, t('saveFailed'))))
  }

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      await onSave(draft)
      setMessage(t('saved'))
    } catch (error) {
      setMessage(localizedError(error, locale, t('scoreSaveFailed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="editor-panel" aria-labelledby="edit-score-title">
      {progress && <div className="progress-label" aria-live="polite">{progress}</div>}
      <button type="button" className="text-button icon-text" onClick={onClose}><UiIcon name="back" />{t('back')}</button>
      <div className="score-heading">
        <span className="score-number">{score.displayNumber}</span>
        <h1 id="edit-score-title">{score.title}</h1>
      </div>

      <div className="metric-grid">
        <fieldset className={`field-group metric-card metric-wide metric-start ${draft.canStart !== null ? 'answered' : ''}`}>
          <legend><span className="metric-icon"><UiIcon name="start" /></span><span>{t('canStartSet')}</span></legend>
          <BinarySwitch name="starter" value={draft.canStart} onChange={(value) => change({ ...draft, canStart: value })} />
        </fieldset>

        <fieldset className={`field-group metric-card metric-wide metric-hotness ${draft.hotness !== null ? 'answered' : ''}`}>
          <legend><span className="metric-icon"><UiIcon name="heat" /></span><span>{t('hotness')}</span></legend>
          <div className="heat-scale">
            {([1, 2, 3] as Hotness[]).map((value) => <label key={value}><input type="radio" name="hotness" checked={draft.hotness === value} onChange={() => change({ ...draft, hotness: value })} /><span className={`heat-choice heat-${value}`} aria-label={t('hotnessLabel', { level: hotnessLabels[value], value })}><span className="heat-bars" aria-hidden="true">{([1, 2, 3] as const).map((step) => <i className={step <= value ? 'lit' : ''} key={step} />)}</span><strong>{hotnessLabels[value]}</strong></span></label>)}
          </div>
        </fieldset>

        <fieldset className={`field-group metric-card metric-drums ${draft.drumsIntro !== null ? 'answered' : ''}`}>
          <legend><span className="metric-icon"><UiIcon name="drum" /></span><span>{t('drumsIntro')}</span></legend>
          <BinarySwitch name="drums" value={draft.drumsIntro} onChange={(value) => change({ ...draft, drumsIntro: value })} />
          <p className="field-hint">{t('spacedApart')}</p>
        </fieldset>

        <fieldset className={`field-group metric-card metric-high ${draft.goesHigh !== null ? 'answered' : ''}`}>
          <legend><span className="metric-icon"><UiIcon name="high" /></span><span>{t('goesHigh')}</span></legend>
          <BinarySwitch name="goes-high" value={draft.goesHigh} onChange={(value) => change({ ...draft, goesHigh: value })} />
          <p className="field-hint">{t('placedEarly')}</p>
        </fieldset>
      </div>

      <div className="preference-stack">
        <label className="toggle-row toggle-80s"><span className="toggle-copy"><strong>{t('repertoire80s')}</strong><small>{t('include80sSets')}</small></span><input role="switch" type="checkbox" checked={draft.in80s} onChange={(event) => change({ ...draft, in80s: event.target.checked })} /><span className="switch-control" aria-hidden="true"><span /></span></label>
        <label className="toggle-row toggle-enabled"><span className="toggle-copy"><strong>{t('enabled')}</strong><small>{t('includeGeneratedSets')}</small></span><input role="switch" type="checkbox" checked={draft.enabled} onChange={(event) => change({ ...draft, enabled: event.target.checked })} /><span className="switch-control" aria-hidden="true"><span /></span></label>
      </div>

      {!valid && <p className="notice" role="status">{t('completeFourFields')}</p>}
      {message && <p className={message === t('saved') ? 'success' : 'error'} role="status">{message}</p>}
      <button type="button" className="primary-action sticky-action" onClick={() => void save()} disabled={saving || !valid}>{saving ? t('saving') : saveLabel}</button>
    </section>
  )
}
