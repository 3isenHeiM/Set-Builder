import type { SharedSetList } from '../domain/sharedSetList'

export interface PagePreview {
  title: string
  description: string
  url: string
}

export function appPreview(origin: string): PagePreview {
  return { title: 'Piece Selector', description: 'Build your sets. Follow the performance. A setlist companion for your street band, ready offline.', url: `${origin}/` }
}

export function sharedPreview(url: string, saved?: SharedSetList): PagePreview {
  if (!saved) return { title: 'Setlist unavailable · Piece Selector', description: 'This shared setlist is unavailable. Ask its owner for a current link.', url }
  const sets = saved.sets.length
  const pieces = saved.sets.reduce((count, set) => count + set.scores.length, 0)
  return {
    title: `${saved.name.trim() || 'Shared setlist'} · Piece Selector`,
    description: `${sets} ${sets === 1 ? 'set' : 'sets'} · ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}. Follow this read-only performance, with an optional drummer view.`,
    url,
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export function previewMarkup(preview: PagePreview): string {
  const image = new URL('/social-preview.png', preview.url).href
  const properties = {
    'og:type': 'website', 'og:site_name': 'Piece Selector', 'og:title': preview.title, 'og:description': preview.description,
    'og:url': preview.url, 'og:image': image, 'og:image:type': 'image/png', 'og:image:width': '1200', 'og:image:height': '630',
    'og:image:alt': 'Piece Selector — build your sets, follow the performance.',
  }
  return `<title>${escapeHtml(preview.title)}</title>\n<meta name="description" content="${escapeHtml(preview.description)}" />\n`
    + Object.entries(properties).map(([property, value]) => `<meta property="${property}" content="${escapeHtml(value)}" />`).join('\n')
    + `\n<meta name="twitter:card" content="summary_large_image" />\n<meta name="twitter:title" content="${escapeHtml(preview.title)}" />\n<meta name="twitter:description" content="${escapeHtml(preview.description)}" />\n<meta name="twitter:image" content="${escapeHtml(image)}" />`
}

export async function withPagePreview(asset: Response, preview: PagePreview, head: boolean, status = 200): Promise<Response> {
  if (!asset.ok || !asset.headers.get('content-type')?.includes('text/html')) return asset
  const html = (await asset.text()).replace(/<!--social-preview:start-->[\s\S]*?<!--social-preview:end-->/, () => previewMarkup(preview))
  const headers = new Headers(asset.headers)
  for (const name of ['etag', 'last-modified', 'content-length', 'content-encoding']) headers.delete(name)
  headers.set('cache-control', 'no-store')
  headers.set('x-robots-tag', 'noindex, nofollow')
  headers.set('referrer-policy', 'no-referrer')
  return new Response(head ? null : html, { status, headers })
}
