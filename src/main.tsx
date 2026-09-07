import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './styles.css'
import { detectLocale } from './app/i18n'

const root = document.getElementById('root')
if (!root) throw new Error('Application root is unavailable.')

document.documentElement.lang = detectLocale()

createRoot(root).render(<StrictMode><App /></StrictMode>)
