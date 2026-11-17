import { localizedKnownMessage, useI18n } from '../../app/i18n'
import type { SavedSetList, Score } from '../../domain/types'
import { createDrummerNotesResolver } from '../../domain/drummerNotes'
import { DrummerNotes } from './DrummerNotes'
import { SetCard } from './SetCard'
import { entryKey, pieceOccurrenceCounts } from '../../domain/performanceEntries'
import { RepeatWarning } from './RepeatWarning'

export function ReadOnlySetList({ setList, showDrummerNotes = true, libraryScores = [] }: { setList: SavedSetList; showDrummerNotes?: boolean; libraryScores?: readonly Score[] }) {
  const { locale, t } = useI18n()
  const notesFor = createDrummerNotesResolver(libraryScores)
  const pieces = setList.performance.sets.flatMap((set) => set.scores)
  const occurrences = pieceOccurrenceCounts(pieces)
  return <div className="set-list read-only-set-list">
    {pieces.some((piece) => occurrences(piece) > 1) && <p className="repeat-hint">{t('repeatedPieceHelp')}</p>}
    {setList.performance.warnings.map((warning) => <p className="notice" role="status" key={warning}>{localizedKnownMessage(warning, locale) ?? warning}</p>)}
    {setList.performance.sets.map((set) => <SetCard key={set.number} number={set.number} title={set.name ?? ''} count={set.scores.length}>
      <ol>{set.scores.map((score, index) => {
        const notes = showDrummerNotes ? notesFor(score) : undefined
        return <li key={entryKey(score)}>
          <span className="position">{index + 1}</span><span className="score-number">{score.displayNumber}</span>
          <span className="score-copy"><span className="piece-title"><strong>{score.title}</strong>{occurrences(score) > 1 && <RepeatWarning title={score.title} />}</span><small>{score.collection || 'General'}</small>{notes && <DrummerNotes value={notes.drummerNotes} timing={notes.drummerTiming} />}</span>
        </li>
      })}</ol>
    </SetCard>)}
  </div>
}
