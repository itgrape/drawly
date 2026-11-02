import { createWriteStream } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { env } from '../../config/env'

const assetsDirectory = path.join(env.dataDirectory, 'assets')

export async function storeAsset(rawId: string, stream: Readable) {
  const id = sanitizeAssetId(rawId)
  await mkdir(assetsDirectory, { recursive: true })
  await pipeline(stream, createWriteStream(path.join(assetsDirectory, id)))
}

export async function loadAsset(rawId: string) {
  const id = sanitizeAssetId(rawId)
  return readFile(path.join(assetsDirectory, id))
}

function sanitizeAssetId(id: string) {
  const sanitized = id.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-220)
  if (!sanitized) throw new Error('Invalid asset id')
  return sanitized
}
