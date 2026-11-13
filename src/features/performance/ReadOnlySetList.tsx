import { localizedKnownMessage, useI18n } from '../../app/i18n'
import type { SavedSetList } from '../../domain/types'
import { DrummerNotes } from './DrummerNotes'
import { SetCard } from './SetCard'

export function ReadOnlySetList({ setList }: { setList: SavedSetList }) {
  const { locale, t } = useI18n()
  return <div className="set-list read-only-set-list">
    {setList.performance.warnings.map((warning) => <p className="notice" role="status" key={warning}>{localizedKnownMessage(warning, locale) ?? warning}</p>)}
    {setList.performance.sets.map((set) => <SetCard key={set.number} number={set.number} title={set.name ?? ''} count={set.scores.length}>
      <ol>{set.scores.map((score, index) => <li key={score.id}>
        <span className="position">{index + 1}</span><span className="score-number">{score.displayNumber}</span>
        <span className="score-copy"><strong>{score.title}</strong><small>{score.collection || 'General'}</small>{(score.goesHigh || score.drumsIntro || index === 0) && <small>{[score.goesHigh && t('highPiece'), score.drumsIntro && t('drums'), index === 0 && t('start')].filter(Boolean).join(' · ')}</small>}<DrummerNotes value={score.drummerNotes} timing={score.drummerTiming} /></span>
      </li>)}</ol>
    </SetCard>)}
  </div>
}
