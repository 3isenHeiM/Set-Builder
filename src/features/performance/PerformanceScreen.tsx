import { assertPerformanceValid } from '../../domain/generator'
import type { GeneratedPerformance } from '../../domain/types'
import { UiIcon } from '../../app/UiIcon'
import { localizedKnownMessage, useI18n } from '../../app/i18n'

interface PerformanceScreenProps {
  performance: GeneratedPerformance | undefined
  onRegenerate: () => void
}

export function PerformanceScreen({ performance, onRegenerate }: PerformanceScreenProps) {
  const { locale, t } = useI18n()
  if (!performance) return <section className="empty-state compact"><div className="hero-mark" aria-hidden="true"><UiIcon name="sets" /></div><h1>{t('noSets')}</h1><button className="primary-action" type="button" onClick={onRegenerate}>{t('buildSets')}</button></section>
  if (import.meta.env.DEV) assertPerformanceValid(performance)

  return (
    <section className="screen-section performance" aria-labelledby="performance-title">
      <div className="title-row"><div><div className="eyebrow">{performance.preset === '80s' ? '80s' : t('mix')}</div><h1 id="performance-title">{t('setsTitle')}</h1></div>{import.meta.env.DEV && <span className="verified" title={t('hardRulesPassed')}>{t('valid')}</span>}</div>
      <p className="alignment-stamp"><time dateTime={performance.generatedAt}>{new Date(performance.generatedAt).toLocaleString(locale)}</time></p>
      {performance.warnings.map((warning) => <p className="notice" role="status" key={warning}>{localizedKnownMessage(warning, locale) ?? warning}</p>)}
      <div className="set-list">
        {performance.sets.map((set) => (
          <section className="set-card" key={set.number} aria-labelledby={`set-${set.number}`}>
            <h2 id={`set-${set.number}`}><span>{t('set')}</span> {set.number}</h2>
            <ol>
              {set.scores.map((score, index) => <li key={score.id}><span className="position">{index + 1}</span><span className="score-number">{score.displayNumber}</span><span className="score-copy"><strong>{score.title}</strong><small>{t('hotnessShort')}{score.hotness}{score.goesHigh ? ` · ${t('highPiece')}` : ''}{score.drumsIntro ? ` · ${t('drums')}` : ''}{index === 0 ? ` · ${t('start')}` : ''}</small></span></li>)}
            </ol>
          </section>
        ))}
      </div>
      <button type="button" className="secondary-action" onClick={onRegenerate}>{t('newSets')}</button>
    </section>
  )
}
