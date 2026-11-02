import type { FastifyInstance } from 'fastify'
import { requireRequestUser } from '../auth/auth.session'
import { loadAsset, storeAsset } from './assets.service'

export function registerAssetRoutes(app: FastifyInstance) {
  app.put('/uploads/:id', async (request, reply) => {
    if (!requireRequestUser(request, reply)) return
    const id = (request.params as { id: string }).id
    await storeAsset(id, request.raw)
    return reply.send({ ok: true })
  })

  app.get('/uploads/:id', async (request, reply) => {
    if (!requireRequestUser(request, reply)) return
    const id = (request.params as { id: string }).id
    const data = await loadAsset(id)
    reply.header('Content-Security-Policy', "default-src 'none'")
    reply.header('X-Content-Type-Options', 'nosniff')
    return reply.type('application/octet-stream').send(data)
  })
}
