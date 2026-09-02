import { useEffect, useState } from 'react'
import type { ReconciliationPlan, RenumberingDecision, RenumberingDecisions } from '../../domain/types'
import { useI18n } from '../../app/i18n'

interface ReconciliationPreviewProps {
  plan: ReconciliationPlan
  applying: boolean
  error: string
  onApply: (decisions: RenumberingDecisions) => Promise<void>
  onCancel: () => void
}

function Count({ value, label }: { value: number; label: string }) {
  return <li><strong>{value}</strong><span>{label}</span></li>
}

export function ReconciliationPreview({ plan, applying, error, onApply, onCancel }: ReconciliationPreviewProps) {
  const { t } = useI18n()
  const reasonText: Record<ReconciliationPlan['malformed'][number]['reason'], string> = {
    'empty-title': t('malformedEmptyTitle'),
    'invalid-format': t('malformedInvalidFormat'),
    'non-positive-number': t('malformedNonPositive'),
    'number-too-large': t('malformedTooLarge'),
  }
  const [decisions, setDecisions] = useState<RenumberingDecisions>({})
  useEffect(() => setDecisions({}), [plan])
  const unresolved = plan.possibleRenumberings.filter((suggestion) => !decisions[suggestion.id]).length
  const duplicateFiles = plan.duplicates.reduce((sum, conflict) => sum + conflict.files.length, 0)

  const decide = (id: string, decision: RenumberingDecision) => {
    setDecisions((current) => ({ ...current, [id]: decision }))
  }

  return (
    <section className="preview-panel" aria-labelledby="preview-title">
      <h1 id="preview-title">{t('folderReview')}</h1>
      <ul className="summary-grid" aria-label={t('comparisonSummary')}>
        <Count value={plan.added.length} label={t('new')} />
        <Count value={plan.renamed.length} label={t('renamed')} />
        <Count value={plan.reappeared.length} label={t('restored')} />
        <Count value={plan.missing.length} label={t('missing').toLocaleLowerCase()} />
        <Count value={plan.malformed.length + duplicateFiles} label={t('attention')} />
        <Count value={plan.unchanged.length} label={t('unchanged')} />
      </ul>

      {plan.possibleRenumberings.length > 0 && (
        <div className="renumbering-list">
          <h2>{t('numberChanged')}</h2>
          {plan.possibleRenumberings.map((suggestion) => (
            <fieldset className="decision-card" key={suggestion.id}>
              <legend>{suggestion.oldDisplayNumber} → {suggestion.file.displayNumber} · {suggestion.file.title}</legend>
              <label className="choice"><input type="radio" name={suggestion.id} checked={decisions[suggestion.id] === 'same-score'} onChange={() => decide(suggestion.id, 'same-score')} /><span><strong>{t('treatAsSameScore')}</strong><small>{t('keepSettings')}</small></span></label>
              <label className="choice"><input type="radio" name={suggestion.id} checked={decisions[suggestion.id] === 'add-new'} onChange={() => decide(suggestion.id, 'add-new')} /><span><strong>{t('addAsNew')}</strong><small>{t('keepOldMissing')}</small></span></label>
            </fieldset>
          ))}
        </div>
      )}

      {plan.added.length > 0 && <details><summary>{t('newScores', { count: plan.added.length })}</summary><ul>{plan.added.map(({ file }) => <li key={file.relativePath}><strong>{file.displayNumber}</strong> {file.title}</li>)}</ul></details>}
      {plan.renamed.length > 0 && <details><summary>{t('renamedCount', { count: plan.renamed.length })}</summary><ul>{plan.renamed.map(({ scoreId, file }) => <li key={scoreId}><strong>{file.displayNumber}</strong> {file.title}</li>)}</ul></details>}
      {plan.reappeared.length > 0 && <details><summary>{t('restoredCount', { count: plan.reappeared.length })}</summary><ul>{plan.reappeared.map(({ scoreId, file }) => <li key={scoreId}><strong>{file.displayNumber}</strong> {file.title}</li>)}</ul></details>}
      {plan.missing.length > 0 && <details><summary>{t('missing')} ({plan.missing.length})</summary><ul>{plan.missing.map((score) => <li key={score.scoreId}><strong>{score.displayNumber}</strong> {score.title}</li>)}</ul></details>}
      {plan.duplicates.length > 0 && <details open><summary>{t('duplicatesSkipped', { count: duplicateFiles })}</summary>{plan.duplicates.map((conflict) => <div key={conflict.scoreNumber}><strong>{t('number', { number: conflict.scoreNumber })}</strong><ul>{conflict.files.map((file) => <li key={file.relativePath}>{file.relativePath}</li>)}</ul></div>)}</details>}
      {plan.malformed.length > 0 && <details open><summary>{t('malformedSkipped', { count: plan.malformed.length })}</summary><ul>{plan.malformed.map((file) => <li key={file.relativePath}><strong>{file.relativePath}</strong><br /><small>{reasonText[file.reason]}</small></li>)}</ul></details>}
      {unresolved > 0 && <p className="notice" role="status">{t('resolveRenumbering', { count: unresolved })}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="action-row">
        <button type="button" className="secondary-action" onClick={onCancel} disabled={applying}>{t('cancel')}</button>
        <button type="button" className="primary-action" onClick={() => void onApply(decisions)} disabled={applying || unresolved > 0}>{applying ? t('applying') : t('applyChanges')}</button>
      </div>
    </section>
  )
}
