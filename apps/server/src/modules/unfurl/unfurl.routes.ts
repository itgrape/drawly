import type { FastifyInstance } from 'fastify'
import { requireRequestUser } from '../auth/auth.session'
import { findOwnedActiveBoard } from '../boards/board.repository'
import { findActiveShareAccess } from '../shares/share.repository'
import { getRoomPreviewSnapshot } from '../sync/room.manager'
import { unfurl } from './unfurl.service'

export function registerUnfurlRoutes(app: FastifyInstance) {
  app.get('/api/board-preview', async (request, reply) => {
    const user = requireRequestUser(request, reply)
    if (!user) return
    const { boardId, shareToken } = request.query as { boardId?: string; shareToken?: string }
    const shared = shareToken ? findActiveShareAccess(shareToken) : null
    const owned = boardId ? findOwnedActiveBoard(user.id, boardId) : null
    if (!owned && !shared) return reply.code(404).send({ error: '画板不存在或无权访问' })
    const id = owned?.id ?? shared!.access.boardId
    const snapshot = getRoomPreviewSnapshot(id)
    reply.header('Cache-Control', 'no-store')
    return {
      title: owned?.title ?? shared!.access.title,
      snapshot: {
        schema: snapshot.schema,
        store: Object.fromEntries(snapshot.documents.map(({ state }) => [state.id, state])),
      },
    }
  })

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
