import { useState } from 'react'
import { MAX_SCORES_PER_SET, MAX_SETS, generatePerformance, validateFeasibility } from '../../domain/generator'
import { eligibleScores } from '../../domain/eligibility'
import type { GeneratedPerformance, Score } from '../../domain/types'
import { createLocalId, createSeed } from '../../app/id'
import { localizedError, localizedKnownMessage, useI18n } from '../../app/i18n'
import { collectionKey, collectionNames } from '../../domain/collections'
import { CountField } from './CountField'

interface GenerateScreenProps {
  scores: Score[]
  collections?: string[]
  hasPerformance: boolean
  onGenerated: (performance: GeneratedPerformance) => Promise<void>
}

export function GenerateScreen({ scores, collections: storedCollections = [], hasPerformance, onGenerated }: GenerateScreenProps) {
  const { locale, t } = useI18n()
  const preset = 'mix'
  const [setCount, setSetCount] = useState(3)
  const [scoresPerSet, setScoresPerSet] = useState(8)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [collection, setCollection] = useState('')
  const collections = collectionNames(scores, storedCollections)
  const scopedScores = collection ? scores.filter((score) => collectionKey(score.collection) === collectionKey(collection)) : scores
  const eligible = eligibleScores(scopedScores, preset)
  const starterCount = eligible.filter((score) => score.canStart).length
  const feasibility = validateFeasibility(scopedScores, { preset, setCount, scoresPerSet, seed: 0 })

  const generate = async () => {
    setError('')
    setSaving(true)
    try {
      const performance = generatePerformance(
        scopedScores,
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
      <label><span>{t('collection')}</span><select value={collection} onChange={(event) => setCollection(event.target.value)}><option value="">{t('allCollections')}</option>{collections.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      {hasPerformance && <p className="notice">{t('createsSavedSetList')}</p>}
      <div className="number-fields">
        <CountField label={t('sets')} value={setCount} maximum={MAX_SETS} onChange={setSetCount} />
        <CountField label={t('piecesPerSet')} value={scoresPerSet} maximum={MAX_SCORES_PER_SET} onChange={setScoresPerSet} />
      </div>
      <div className="availability-card" aria-live="polite">
        <span><strong>{eligible.length}</strong> {t('eligible')}</span>
        <span><strong>{starterCount}</strong> {t('starters')}</span>
      </div>
      {!feasibility.ok && <p className="error" role="alert">{feasibilityMessage}</p>}
      {error && error !== feasibilityMessage && <p className="error" role="alert">{error}</p>}
      <button type="button" className="primary-action sticky-action" onClick={() => void generate()} disabled={!feasibility.ok || saving}>{saving ? t('saving') : t('generateSets')}</button>
    </section>
  )
}
