import type { FastifyInstance, FastifyReply } from 'fastify'
import { requireRequestUser } from '../auth/auth.session'
import { findOwnedActiveBoard } from '../boards/board.repository'
import { findActiveShareAccess } from '../shares/share.repository'
import { listCommentMembers } from './comment.repository'

export function registerCommentRoutes(app: FastifyInstance) {
  app.get('/api/boards/:boardId/comment-members', async (request, reply) => {
    const user = requireRequestUser(request, reply)
    if (!user) return
    const boardId = (request.params as { boardId: string }).boardId
    const shareToken = (request.query as { shareToken?: string }).shareToken
    const ownerAccess = findOwnedActiveBoard(user.id, boardId)
    const sharedAccess = !ownerAccess && shareToken
      ? findActiveShareAccess(shareToken, boardId)
      : null
    if (!ownerAccess && !sharedAccess) return notFound(reply)
    return { members: listCommentMembers(boardId) }
  })
}

function notFound(reply: FastifyReply) {
  return reply.code(404).send({ error: '画板不存在或无权查看协作成员' })
}
