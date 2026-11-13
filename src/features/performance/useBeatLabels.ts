import { useI18n } from '../../app/i18n'

export function useBeatLabels() {
  const { t } = useI18n()
  return { quarter: t('tempoQuarter'), half: t('tempoHalf'), eighth: t('tempoEighth'), 'dotted-quarter': t('tempoDottedQuarter'), 'dotted-half': t('tempoDottedHalf'), 'dotted-eighth': t('tempoDottedEighth') }
}
