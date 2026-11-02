const MAX_RESPONSE_BYTES = 512_000

export async function unfurl(rawUrl: string) {
  const url = new URL(rawUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP(S) URLs are supported')
  }

  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'Drawly/0.1 link preview' },
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status}`)

  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (contentLength > MAX_RESPONSE_BYTES) throw new Error('Response is too large')

  const html = (await response.text()).slice(0, MAX_RESPONSE_BYTES)
  const finalUrl = response.url
  return {
    title: readMeta(html, 'og:title') || readTitle(html),
    description: readMeta(html, 'og:description') || readMeta(html, 'description'),
    image: resolveUrl(readMeta(html, 'og:image'), finalUrl),
    favicon: resolveUrl(readLink(html, 'icon'), finalUrl),
  }
}

function readMeta(html: string, key: string) {
  const escaped = escapeRegExp(key)
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'),
  ]
  return decodeHtml(patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean) ?? '')
}

function readTitle(html: string) {
  return decodeHtml(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '')
}

function readLink(html: string, rel: string) {
  const escaped = escapeRegExp(rel)
  const patterns = [
    new RegExp(`<link[^>]+rel=["'][^"']*${escaped}[^"']*["'][^>]+href=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<link[^>]+href=["']([^"']*)["'][^>]+rel=["'][^"']*${escaped}[^"']*["'][^>]*>`, 'i'),
  ]
  return decodeHtml(patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean) ?? '')
}

function resolveUrl(value: string, baseUrl: string) {
  if (!value) return ''
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return ''
  }
}

function decodeHtml(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
