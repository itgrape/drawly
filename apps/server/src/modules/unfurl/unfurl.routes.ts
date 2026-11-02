import type { FastifyInstance } from 'fastify'
import { requireRequestUser } from '../auth/auth.session'
import { unfurl } from './unfurl.service'

export function registerUnfurlRoutes(app: FastifyInstance) {
  app.get('/unfurl', async (request, reply) => {
    try {
      if (!requireRequestUser(request, reply)) return
      const url = (request.query as { url?: string }).url
      if (!url) return reply.code(400).send({ error: 'Missing url' })
      return reply.send(await unfurl(url))
    } catch (error) {
      request.log.warn(error, 'Failed to unfurl URL')
      return reply.code(422).send({ error: 'Unable to preview URL' })
    }
  })
}
