import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { UiIcon } from '../app/UiIcon'
import { useI18n } from '../app/i18n'

export function UpdateBanner() {
  const { t } = useI18n()
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [error, setError] = useState(false)
  const update = useRef<() => Promise<void>>(() => Promise.resolve())

  useEffect(() => {
    update.current = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => setOfflineReady(true),
      onRegisterError: () => setError(true),
    })
  }, [])

  if (needRefresh) return <aside className="update-banner" role="status"><p><strong>{t('updateReady')}</strong></p><button type="button" onClick={() => void update.current()}>{t('refresh')}</button></aside>
  if (offlineReady) return <aside className="update-banner" role="status"><p>{t('readyOffline')}</p><button type="button" aria-label={t('dismissOfflineMessage')} onClick={() => setOfflineReady(false)}><UiIcon name="close" /></button></aside>
  if (error) return <aside className="update-banner warning" role="status"><p>{t('updateFailed')}</p><button type="button" aria-label={t('dismissUpdateWarning')} onClick={() => setError(false)}><UiIcon name="close" /></button></aside>
  return null
}
