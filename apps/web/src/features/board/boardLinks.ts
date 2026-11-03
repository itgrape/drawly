export function getBoardLink(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.origin !== window.location.origin) return null
    const match = /^\/(boards|share)\/([^/]+)\/?$/.exec(parsed.pathname)
    if (!match) return null
    return { kind: match[1], id: decodeURIComponent(match[2]) }
  } catch {
    return null
  }
}

