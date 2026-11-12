import { UiIcon } from '../../app/UiIcon'

export function MovePieceControl({ label, destinations, disabled, onMove }: {
  label: string
  destinations: Array<{ index: number; name: string }>
  disabled: boolean
  onMove: (index: number) => void
}) {
  if (!destinations.length) return null
  return <span className={`compact-move-control${disabled ? ' disabled' : ''}`} title={label}>
    <UiIcon name="move" />
    <select aria-label={label} value="" disabled={disabled} onChange={(event) => { if (event.target.value !== '') onMove(Number(event.target.value)) }}>
      <option value="">{label}</option>
      {destinations.map((destination) => <option key={destination.index} value={destination.index}>{destination.name}</option>)}
    </select>
  </span>
}
