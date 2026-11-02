import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import websocketPlugin from '@fastify/websocket'
import fastify, { type FastifyRequest } from 'fastify'
import { env, isAllowedOrigin } from './config/env'
import { registerAssetRoutes } from './modules/assets/assets.routes'
import { registerAuthRoutes } from './modules/auth/auth.routes'
import { registerBoardRoutes } from './modules/boards/board.routes'
import { registerCommentRoutes } from './modules/comments/comment.routes'
import { registerShareRoutes } from './modules/shares/share.routes'
import { registerSyncRoutes } from './modules/sync/sync.routes'
import { registerUnfurlRoutes } from './modules/unfurl/unfurl.routes'

export async function createApp() {
  const app = fastify({
    logger: {
      serializers: {
        req(request: FastifyRequest) {
          return {
            method: request.method,
            url: redactShareToken(request.url),
            host: request.host,
            remoteAddress: request.ip,
            remotePort: request.socket.remotePort,
          }
        },
      },
    },
  })

  await app.register(websocketPlugin)
  await app.register(cookie)
  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) return callback(null, true)
      return callback(new Error('Origin is not allowed'), false)
    },
  })

  app.get('/health', async () => ({ ok: true }))
  app.addContentTypeParser('*', (_request, _payload, done) => done(null))

  await registerAuthRoutes(app)
  registerBoardRoutes(app)
  registerCommentRoutes(app)
  registerShareRoutes(app)
  registerSyncRoutes(app)
  registerAssetRoutes(app)
  registerUnfurlRoutes(app)

  if (env.webDirectory) {
    await app.register(fastifyStatic, {
      root: env.webDirectory,
    })
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && request.headers.accept?.includes('text/html')) {
        return reply.sendFile('index.html')
      }
      return reply.code(404).send({ error: 'Not found' })
    })
  }

  return app
}

function redactShareToken(url: string) {
  return url
    .replace(/(\/api\/shares\/)[^/?]+/g, '$1[redacted]')
    .replace(/([?&]shareToken=)[^&]+/g, '$1[redacted]')
}
