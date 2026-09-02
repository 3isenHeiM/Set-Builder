import { useState } from 'react'
import { MAX_SCORES_PER_SET, MAX_SETS, generatePerformance, validateFeasibility } from '../../domain/generator'
import { eligibleScores } from '../../domain/eligibility'
import type { GeneratedPerformance, Preset, Score } from '../../domain/types'
import { createLocalId, createSeed } from '../../app/id'
import { localizedError, localizedKnownMessage, useI18n } from '../../app/i18n'

interface GenerateScreenProps {
  scores: Score[]
  hasPerformance: boolean
  onGenerated: (performance: GeneratedPerformance) => Promise<void>
}

export function GenerateScreen({ scores, hasPerformance, onGenerated }: GenerateScreenProps) {
  const { locale, t } = useI18n()
  const [preset, setPreset] = useState<Preset>('mix')
  const [setCount, setSetCount] = useState(3)
  const [scoresPerSet, setScoresPerSet] = useState(8)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const eligible = eligibleScores(scores, preset)
  const starterCount = eligible.filter((score) => score.canStart).length
  const feasibility = validateFeasibility(scores, { preset, setCount, scoresPerSet, seed: 0 })

  const generate = async () => {
    setError('')
    setSaving(true)
    try {
      const performance = generatePerformance(
        scores,
        { preset, setCount, scoresPerSet, seed: createSeed() },
        { now: new Date().toISOString(), createId: createLocalId },
      )
      await onGenerated(performance)
    } catch (reason) {
      setError(localizedError(reason, locale, t('performanceCreateFailed')))
    } finally {
      setSaving(false)
    }
  }

  const feasibilityMessage = feasibility.ok ? '' : localizedKnownMessage(feasibility.message, locale) ?? t('performanceCreateFailed')

  return (
    <section className="screen-section" aria-labelledby="generate-title">
      <div className="eyebrow">{t('noRepeats')}</div>
      <h1 id="generate-title">{t('buildSets')}</h1>
      {hasPerformance && <p className="notice">{t('replacesSavedSets')}</p>}
      <fieldset className="preset-field">
        <legend>{t('repertoire')}</legend>
        <div className="preset-grid">
          <label className={preset === 'mix' ? 'selected' : ''}><input type="radio" name="preset" value="mix" checked={preset === 'mix'} onChange={() => setPreset('mix')} /><strong>{t('mix')}</strong><small>{t('allReadyPieces')}</small></label>
          <label className={preset === '80s' ? 'selected' : ''}><input type="radio" name="preset" value="80s" checked={preset === '80s'} onChange={() => setPreset('80s')} /><strong>80s</strong><small>{t('ready80sPieces')}</small></label>
        </div>
      </fieldset>
      <div className="number-fields">
        <label><span>{t('sets')}</span><input type="number" inputMode="numeric" min="1" max={MAX_SETS} value={setCount} onChange={(event) => setSetCount(event.target.valueAsNumber)} /></label>
        <label><span>{t('piecesPerSet')}</span><input type="number" inputMode="numeric" min="1" max={MAX_SCORES_PER_SET} value={scoresPerSet} onChange={(event) => setScoresPerSet(event.target.valueAsNumber)} /></label>
      </div>
      <div className="availability-card" aria-live="polite">
        <span><strong>{eligible.length}</strong> {t('eligible')}</span>
        <span><strong>{starterCount}</strong> {t('starters')}</span>
      </div>
      {!feasibility.ok && <p className="error" role="alert">{feasibilityMessage}</p>}
      {error && error !== feasibilityMessage && <p className="error" role="alert">{error}</p>}
      <button type="button" className="primary-action sticky-action" onClick={() => void generate()} disabled={!feasibility.ok || saving}>{saving ? t('saving') : hasPerformance ? t('replaceSets') : t('generateSets')}</button>
    </section>
  )
}
