import { assertPerformanceValid } from '../../domain/generator'
import type { GeneratedPerformance } from '../../domain/types'

interface PerformanceScreenProps {
  performance: GeneratedPerformance | undefined
  onRegenerate: () => void
}

export function PerformanceScreen({ performance, onRegenerate }: PerformanceScreenProps) {
  if (!performance) return <section className="empty-state compact"><div className="hero-mark" aria-hidden="true">≡</div><h1>No performance yet</h1><p>Generate complete sets when the library has enough configured scores and starters.</p><button className="primary-action" type="button" onClick={onRegenerate}>Go to generator</button></section>
  if (import.meta.env.DEV) assertPerformanceValid(performance)

  return (
    <section className="screen-section performance" aria-labelledby="performance-title">
      <div className="title-row"><div><div className="eyebrow">{performance.preset === '80s' ? '80s' : 'Mix'} · seed {performance.seed}</div><h1 id="performance-title">Current performance</h1></div>{import.meta.env.DEV && <span className="verified" title="Hard generation constraints passed">Validated</span>}</div>
      <p className="alignment-stamp">Saved <time dateTime={performance.generatedAt}>{new Date(performance.generatedAt).toLocaleString()}</time></p>
      {performance.warnings.map((warning) => <p className="notice" role="status" key={warning}>{warning}</p>)}
      <div className="set-list">
        {performance.sets.map((set) => (
          <section className="set-card" key={set.number} aria-labelledby={`set-${set.number}`}>
            <h2 id={`set-${set.number}`}><span>Set</span> {set.number}</h2>
            <ol>
              {set.scores.map((score, index) => <li key={score.id}><span className="position">{index + 1}</span><span className="score-number">{score.displayNumber}</span><span className="score-copy"><strong>{score.title}</strong><small>Hotness {score.hotness}{score.drumsIntro ? ' · Drums intro' : ''}{index === 0 ? ' · Starter' : ''}</small></span></li>)}
            </ol>
          </section>
        ))}
      </div>
      <button type="button" className="secondary-action" onClick={onRegenerate}>Regenerate performance</button>
    </section>
  )
}
