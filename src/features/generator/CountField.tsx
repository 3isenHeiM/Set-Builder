import { useId } from 'react'
import { UiIcon } from '../../app/UiIcon'
import { useI18n } from '../../app/i18n'

interface CountFieldProps {
  label: string
  value: number
  maximum: number
  onChange: (value: number) => void
}

export function CountField({ label, value, maximum, onChange }: CountFieldProps) {
  const id = useId()
  const { t } = useI18n()
  return (
    <div className="count-field">
      <label htmlFor={id}>{label}</label>
      <div className="count-stepper">
        <button type="button" aria-label={t('decreaseCount', { label })} disabled={value <= 1} onClick={() => onChange(Number.isFinite(value) ? Math.max(1, Math.min(maximum, value - 1)) : 1)}><UiIcon name="minus" /></button>
        <input id={id} type="number" inputMode="numeric" min="1" max={maximum} step="1" aria-describedby={`${id}-range`} value={Number.isNaN(value) ? '' : value} onChange={(event) => onChange(event.target.valueAsNumber)} />
        <button type="button" aria-label={t('increaseCount', { label })} disabled={value >= maximum} onClick={() => onChange(Number.isFinite(value) ? Math.max(1, Math.min(maximum, value + 1)) : 1)}><UiIcon name="plus" /></button>
      </div>
      <small id={`${id}-range`}>{t('countRange', { maximum })}</small>
    </div>
  )
}
