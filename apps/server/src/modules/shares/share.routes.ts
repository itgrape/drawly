import type { SharePermission } from '@drawly/shared/share'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { randomBytes, randomUUID } from 'node:crypto'
import { requireRequestUser } from '../auth/auth.session'
import { findOwnedActiveBoard } from '../boards/board.repository'
import { closeSessionsForShare } from '../sync/room.manager'
import {
  findActiveShareAccess,
  findActiveShareByPermission,
  insertShare,
  listActiveShares,
  revokeOwnedShare,
} from './share.repository'

export function registerShareRoutes(app: FastifyInstance) {
  app.get('/api/boards/:boardId/shares', async (request, reply) => {
    const user = requireRequestUser(request, reply)
    if (!user) return
    const boardId = getBoardId(request.params)
    if (!findOwnedActiveBoard(user.id, boardId)) return boardNotFound(reply)
    return { shares: listActiveShares(user.id, boardId) }
  })

  app.post('/api/boards/:boardId/shares', async (request, reply) => {
    const user = requireRequestUser(request, reply)
    if (!user) return
    const boardId = getBoardId(request.params)
    if (!findOwnedActiveBoard(user.id, boardId)) return boardNotFound(reply)
    const permission = readPermission((request.body as { permission?: unknown } | null)?.permission)
    if (!permission) return reply.code(400).send({ error: '分享权限必须是只读或可编辑' })

    const existing = findActiveShareByPermission(user.id, boardId, permission)
    if (existing) return { share: existing }

    const row = {
      id: randomUUID(),
      board_id: boardId,
      created_by: user.id,
      token: randomBytes(32).toString('base64url'),
      permission,
      created_at: Date.now(),
      revoked_at: null,
    }
    insertShare(row)
    reply.code(201)
    return { share: {
      id: row.id,
      boardId: row.board_id,
      permission: row.permission,
      token: row.token,
      createdAt: row.created_at,
    } }
  })

  app.delete('/api/boards/:boardId/shares/:shareId', async (request, reply) => {
    const user = requireRequestUser(request, reply)
    if (!user) return
    const { boardId, shareId } = request.params as { boardId: string; shareId: string }
    if (!revokeOwnedShare(user.id, boardId, shareId, Date.now())) return shareNotFound(reply)
    closeSessionsForShare(boardId, shareId)
    reply.code(204).send()
  })

  app.get('/api/shares/:token', async (request, reply) => {
    const user = requireRequestUser(request, reply)
    if (!user) return
    const token = (request.params as { token: string }).token
    const result = findActiveShareAccess(token)
    if (!result) return shareNotFound(reply)
    return { access: result.access }
  })
}

function getBoardId(params: unknown) {
  return (params as { boardId: string }).boardId
}

function readPermission(value: unknown): SharePermission | null {
  return value === 'view' || value === 'edit' ? value : null
}

function boardNotFound(reply: FastifyReply) {
  return reply.code(404).send({ error: '画板不存在或无权管理分享' })
}

function shareNotFound(reply: FastifyReply) {
  return reply.code(404).send({ error: '分享链接不存在或已关闭' })
}
