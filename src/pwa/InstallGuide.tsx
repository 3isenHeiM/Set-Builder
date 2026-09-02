import { useState } from 'react'
import type { ReactNode } from 'react'
import { UiIcon } from '../app/UiIcon'

const DISMISS_KEY = 'piece-selector-install-guide-dismissed'

function installed(): boolean {
  return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || Reflect.get(navigator, 'standalone') === true
}

export function InstallGuide() {
  const [visible, setVisible] = useState(() => !installed() && localStorage.getItem(DISMISS_KEY) !== 'true')
  if (!visible) return null
  return (
    <aside className="install-guide" aria-label="Install Piece Selector">
      <div><strong>Install for offline use</strong><p>Safari: Share → <strong>Add to Home Screen</strong>.</p></div>
      <button type="button" aria-label="Dismiss installation guidance" onClick={() => { localStorage.setItem(DISMISS_KEY, 'true'); setVisible(false) }}><UiIcon name="close" /></button>
    </aside>
  )
}

export function AboutScreen({ children }: { children?: ReactNode }) {
  return (
    <section className="screen-section" aria-labelledby="about-title">
      <h1 id="about-title">About</h1>
      <div className="info-card"><h2>Install</h2><p>In Safari, tap Share → <strong>Add to Home Screen</strong>. Enable <strong>Open as Web App</strong> if shown, then open once online.</p></div>
      <div className="info-card"><h2>On-device</h2><p>Only names and paths are examined. Music files stay untouched; settings and sets stay here.</p></div>
      {children}
    </section>
  )
}
