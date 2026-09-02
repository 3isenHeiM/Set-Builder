import { useState } from 'react'

const DISMISS_KEY = 'piece-selector-install-guide-dismissed'

function installed(): boolean {
  return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || Reflect.get(navigator, 'standalone') === true
}

export function InstallGuide() {
  const [visible, setVisible] = useState(() => !installed() && localStorage.getItem(DISMISS_KEY) !== 'true')
  if (!visible) return null
  return (
    <aside className="install-guide" aria-label="Install Piece Selector">
      <div><strong>Keep it on your Home Screen</strong><p>In Safari, tap Share → <strong>Add to Home Screen</strong>, and enable <strong>Open as Web App</strong> if offered.</p></div>
      <button type="button" aria-label="Dismiss installation guidance" onClick={() => { localStorage.setItem(DISMISS_KEY, 'true'); setVisible(false) }}>×</button>
    </aside>
  )
}

export function AboutScreen() {
  return (
    <section className="screen-section" aria-labelledby="about-title">
      <div className="eyebrow">On-device by design</div><h1 id="about-title">About Piece Selector</h1>
      <div className="info-card"><h2>Install on iPhone</h2><p>Open this app in Safari, tap the Share button, choose <strong>Add to Home Screen</strong>, and enable <strong>Open as Web App</strong> if that option appears. Open it once online before relying on offline mode.</p></div>
      <div className="info-card"><h2>Your data stays here</h2><p>The app examines filenames and paths only. Music files are not read, cached, uploaded, or copied. Configuration and the current performance live in this browser profile’s IndexedDB.</p></div>
      <div className="info-card"><h2>Keep a backup</h2><p>Browser storage is not a backup. Clearing Safari site data, uninstalling in some circumstances, or changing browser profiles can erase this local library.</p></div>
    </section>
  )
}
