import { useEffect, useRef } from 'react'

const TURNSTILE_SCRIPT_ID = 'piece-selector-turnstile'
const TURNSTILE_SCRIPT_SOURCE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileOptions {
  sitekey: string
  action: 'login'
  appearance: 'always'
  size: 'flexible'
  theme: 'auto'
  callback: (token: string) => void
  'error-callback': () => void
  'expired-callback': () => void
  'timeout-callback': () => void
}

interface TurnstileApi {
  ready: (callback: () => void) => void
  render: (container: HTMLElement, options: TurnstileOptions) => string
  remove: (widgetId: string) => void
  reset: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  return new Promise((resolve, reject) => {
    const loaded = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Human verification is unavailable. Try again.'))
    const failed = () => {
      document.getElementById(TURNSTILE_SCRIPT_ID)?.remove()
      reject(new Error('Human verification is unavailable. Try again.'))
    }
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', loaded, { once: true })
      existing.addEventListener('error', failed, { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = TURNSTILE_SCRIPT_ID
    script.src = TURNSTILE_SCRIPT_SOURCE
    script.async = true
    script.defer = true
    script.addEventListener('load', loaded, { once: true })
    script.addEventListener('error', failed, { once: true })
    document.head.append(script)
  })
}

export function TurnstileVerification({ siteKey, onVerified, onUnavailable }: {
  siteKey: string
  onVerified: (token: string) => void
  onUnavailable: () => void
}) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    let widgetId: string | undefined
    const clear = () => {
      if (active) onVerified('')
    }
    const reset = (api: TurnstileApi) => {
      clear()
      if (widgetId) api.reset(widgetId)
    }
    void loadTurnstile().then((api) => api.ready(() => {
      if (!active || !container.current) return
      widgetId = api.render(container.current, {
        sitekey: siteKey,
        action: 'login',
        appearance: 'always',
        size: 'flexible',
        theme: 'auto',
        callback: (token) => { if (active) onVerified(token) },
        'error-callback': () => { clear(); if (active) onUnavailable() },
        'expired-callback': () => reset(api),
        'timeout-callback': () => reset(api),
      })
    })).catch(() => { if (active) onUnavailable() })
    return () => {
      active = false
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [onUnavailable, onVerified, siteKey])

  return <div className="turnstile-slot" ref={container} />
}
