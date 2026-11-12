import { App } from './App'
import { SharedSetListScreen } from '../features/performance/SharedSetListScreen'

export function AppEntry({ pathname = window.location.pathname }: { pathname?: string }) {
  if (pathname.startsWith('/share/')) return <SharedSetListScreen token={/^\/share\/([a-f0-9]{64})\/?$/.exec(pathname)?.[1] ?? ''} />
  return <App />
}
