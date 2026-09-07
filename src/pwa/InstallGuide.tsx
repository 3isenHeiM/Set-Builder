import { useState } from 'react'
import type { ReactNode } from 'react'
import { UiIcon } from '../app/UiIcon'
import { useI18n } from '../app/i18n'

const DISMISS_KEY = 'piece-selector-install-guide-dismissed'

function installed(): boolean {
  return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || Reflect.get(navigator, 'standalone') === true
}

export function InstallGuide() {
  const { t } = useI18n()
  const [visible, setVisible] = useState(() => !installed() && localStorage.getItem(DISMISS_KEY) !== 'true')
  if (!visible) return null
  return (
    <aside className="install-guide" aria-label={t('installGuide')}>
      <div><strong>{t('installGuideTitle')}</strong><p>{t('installGuideBody')}</p></div>
      <button type="button" aria-label={t('dismissInstallGuide')} onClick={() => { localStorage.setItem(DISMISS_KEY, 'true'); setVisible(false) }}><UiIcon name="close" /></button>
    </aside>
  )
}

export function AboutScreen({ children }: { children?: ReactNode }) {
  const { t } = useI18n()
  return (
    <section className="screen-section" aria-labelledby="about-title">
      <h1 id="about-title">{t('about')}</h1>
      <div className="info-card"><h2>{t('install')}</h2><p>{t('installInstructions')}</p></div>
      <div className="info-card"><h2>{t('onDevice')}</h2><p>{t('onDeviceDetails')}</p></div>
      {children}
    </section>
  )
}
