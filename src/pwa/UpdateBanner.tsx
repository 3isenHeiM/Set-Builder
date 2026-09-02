import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

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

  if (needRefresh) return <aside className="update-banner" role="status"><p><strong>An update is ready.</strong> Refresh without changing your local library.</p><button type="button" onClick={() => void update.current()}>Refresh now</button></aside>
  if (offlineReady) return <aside className="update-banner" role="status"><p>App shell ready for offline use.</p><button type="button" aria-label="Dismiss offline-ready message" onClick={() => setOfflineReady(false)}>×</button></aside>
  if (error) return <aside className="update-banner warning" role="status"><p>The offline app shell could not update. Try again when online.</p><button type="button" aria-label="Dismiss offline update warning" onClick={() => setError(false)}>×</button></aside>
  return null
}
