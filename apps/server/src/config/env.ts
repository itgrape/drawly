import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../../../../', import.meta.url))

export const env = {
  port: Number(process.env.PORT ?? 5858),
  isProduction: process.env.NODE_ENV === 'production',
  dataDirectory: process.env.DRAWLY_DATA_DIR ?? path.join(projectRoot, '.data'),
  webDirectory: process.env.DRAWLY_WEB_DIR,
  allowedOrigins: (process.env.DRAWLY_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
}

export function isAllowedOrigin(origin: string) {
  if (env.allowedOrigins.includes(origin)) return true
  if (env.isProduction) return false
  return /^http:\/\/[^/]+:5757$/.test(origin)
}
