import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { UiIcon } from '../app/UiIcon'

export function UpdateBanner() {
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

  if (needRefresh) return <aside className="update-banner" role="status"><p><strong>Update ready.</strong></p><button type="button" onClick={() => void update.current()}>Refresh</button></aside>
  if (offlineReady) return <aside className="update-banner" role="status"><p>Ready offline.</p><button type="button" aria-label="Dismiss offline-ready message" onClick={() => setOfflineReady(false)}><UiIcon name="close" /></button></aside>
  if (error) return <aside className="update-banner warning" role="status"><p>Update failed. Try again online.</p><button type="button" aria-label="Dismiss offline update warning" onClick={() => setError(false)}><UiIcon name="close" /></button></aside>
  return null
}
