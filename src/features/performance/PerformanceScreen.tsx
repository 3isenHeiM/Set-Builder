import { assertPerformanceValid } from '../../domain/generator'
import type { GeneratedPerformance } from '../../domain/types'
import { UiIcon } from '../../app/UiIcon'

interface PerformanceScreenProps {
  performance: GeneratedPerformance | undefined
  onRegenerate: () => void
}

export function PerformanceScreen({ performance, onRegenerate }: PerformanceScreenProps) {
  if (!performance) return <section className="empty-state compact"><div className="hero-mark" aria-hidden="true"><UiIcon name="sets" /></div><h1>No sets yet.</h1><button className="primary-action" type="button" onClick={onRegenerate}>Build sets</button></section>
  if (import.meta.env.DEV) assertPerformanceValid(performance)

  return (
    <section className="screen-section performance" aria-labelledby="performance-title">
      <div className="title-row"><div><div className="eyebrow">{performance.preset === '80s' ? '80s' : 'Mix'}</div><h1 id="performance-title">Tonight’s sets</h1></div>{import.meta.env.DEV && <span className="verified" title="Hard generation constraints passed">Valid</span>}</div>
      <p className="alignment-stamp"><time dateTime={performance.generatedAt}>{new Date(performance.generatedAt).toLocaleString()}</time></p>
      {performance.warnings.map((warning) => <p className="notice" role="status" key={warning}>{warning}</p>)}
      <div className="set-list">
        {performance.sets.map((set) => (
          <section className="set-card" key={set.number} aria-labelledby={`set-${set.number}`}>
            <h2 id={`set-${set.number}`}><span>Set</span> {set.number}</h2>
            <ol>
              {set.scores.map((score, index) => <li key={score.id}><span className="position">{index + 1}</span><span className="score-number">{score.displayNumber}</span><span className="score-copy"><strong>{score.title}</strong><small>H{score.hotness}{score.goesHigh ? ' · High' : ''}{score.drumsIntro ? ' · Drums' : ''}{index === 0 ? ' · Start' : ''}</small></span></li>)}
            </ol>
          </section>
        ))}
      </div>
      <button type="button" className="secondary-action" onClick={onRegenerate}>New sets</button>
    </section>
  )
}
