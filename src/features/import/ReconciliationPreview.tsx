import { useEffect, useState } from 'react'
import type { ReconciliationPlan, RenumberingDecision, RenumberingDecisions } from '../../domain/types'

interface ReconciliationPreviewProps {
  plan: ReconciliationPlan
  applying: boolean
  error: string
  onApply: (decisions: RenumberingDecisions) => Promise<void>
  onCancel: () => void
}

const reasonText: Record<ReconciliationPlan['malformed'][number]['reason'], string> = {
  'empty-title': 'title is empty',
  'invalid-format': 'use “number - title.mscz”',
  'non-positive-number': 'number must be positive',
  'number-too-large': 'number is too large',
}

function Count({ value, label }: { value: number; label: string }) {
  return <li><strong>{value}</strong><span>{label}</span></li>
}

export function ReconciliationPreview({ plan, applying, error, onApply, onCancel }: ReconciliationPreviewProps) {
  const [decisions, setDecisions] = useState<RenumberingDecisions>({})
  useEffect(() => setDecisions({}), [plan])
  const unresolved = plan.possibleRenumberings.filter((suggestion) => !decisions[suggestion.id]).length
  const duplicateFiles = plan.duplicates.reduce((sum, conflict) => sum + conflict.files.length, 0)

  const decide = (id: string, decision: RenumberingDecision) => {
    setDecisions((current) => ({ ...current, [id]: decision }))
  }

  return (
    <section className="preview-panel" aria-labelledby="preview-title">
      <div className="eyebrow">Review before applying</div>
      <h2 id="preview-title">Folder comparison</h2>
      <ul className="summary-grid" aria-label="Comparison summary">
        <Count value={plan.added.length} label="new" />
        <Count value={plan.renamed.length} label="renamed" />
        <Count value={plan.reappeared.length} label="restored" />
        <Count value={plan.missing.length} label="missing" />
        <Count value={plan.malformed.length + duplicateFiles} label="attention" />
        <Count value={plan.unchanged.length} label="unchanged" />
      </ul>

      {plan.possibleRenumberings.length > 0 && (
        <div className="renumbering-list">
          <h3>Possible renumbering</h3>
          <p className="secondary">These titles match, but their numbers changed. Choose explicitly.</p>
          {plan.possibleRenumberings.map((suggestion) => (
            <fieldset className="decision-card" key={suggestion.id}>
              <legend>{suggestion.oldDisplayNumber} → {suggestion.file.displayNumber} · {suggestion.file.title}</legend>
              <label className="choice"><input type="radio" name={suggestion.id} checked={decisions[suggestion.id] === 'same-score'} onChange={() => decide(suggestion.id, 'same-score')} /><span><strong>Treat as same score</strong><small>Keep its configuration and internal history.</small></span></label>
              <label className="choice"><input type="radio" name={suggestion.id} checked={decisions[suggestion.id] === 'add-new'} onChange={() => decide(suggestion.id, 'add-new')} /><span><strong>Add as new</strong><small>Keep the old score missing and create a pending score.</small></span></label>
            </fieldset>
          ))}
        </div>
      )}

      {plan.added.length > 0 && <details><summary>New scores ({plan.added.length})</summary><ul>{plan.added.map(({ file }) => <li key={file.relativePath}><strong>{file.displayNumber}</strong> {file.title}</li>)}</ul></details>}
      {plan.renamed.length > 0 && <details><summary>Renamed scores ({plan.renamed.length})</summary><ul>{plan.renamed.map(({ scoreId, file }) => <li key={scoreId}><strong>{file.displayNumber}</strong> becomes {file.title}</li>)}</ul></details>}
      {plan.reappeared.length > 0 && <details><summary>Restored scores ({plan.reappeared.length})</summary><ul>{plan.reappeared.map(({ scoreId, file }) => <li key={scoreId}><strong>{file.displayNumber}</strong> {file.title}</li>)}</ul></details>}
      {plan.missing.length > 0 && <details><summary>Will be marked missing ({plan.missing.length})</summary><ul>{plan.missing.map((score) => <li key={score.scoreId}><strong>{score.displayNumber}</strong> {score.title}</li>)}</ul></details>}
      {plan.unchanged.length > 0 && <details><summary>Unchanged ({plan.unchanged.length})</summary><ul>{plan.unchanged.map(({ scoreId, file }) => <li key={scoreId}><strong>{file.displayNumber}</strong> {file.title}</li>)}</ul></details>}
      {plan.duplicates.length > 0 && <details open><summary>Duplicate numbers — skipped ({duplicateFiles})</summary>{plan.duplicates.map((conflict) => <div key={conflict.scoreNumber}><strong>Number {conflict.scoreNumber}</strong><ul>{conflict.files.map((file) => <li key={file.relativePath}>{file.relativePath}</li>)}</ul></div>)}</details>}
      {plan.malformed.length > 0 && <details open><summary>Malformed names — skipped ({plan.malformed.length})</summary><ul>{plan.malformed.map((file) => <li key={file.relativePath}><strong>{file.relativePath}</strong><br /><small>{reasonText[file.reason]}</small></li>)}</ul></details>}
      {plan.ignoredCount > 0 && <p className="secondary">{plan.ignoredCount} non-`.mscz` {plan.ignoredCount === 1 ? 'file was' : 'files were'} ignored.</p>}
      {unresolved > 0 && <p className="notice" role="status">Resolve {unresolved} possible {unresolved === 1 ? 'renumbering' : 'renumberings'} to continue.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="action-row">
        <button type="button" className="secondary-action" onClick={onCancel} disabled={applying}>Cancel</button>
        <button type="button" className="primary-action" onClick={() => void onApply(decisions)} disabled={applying || unresolved > 0}>{applying ? 'Applying…' : 'Apply changes'}</button>
      </div>
    </section>
  )
}
