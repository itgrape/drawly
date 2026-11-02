import type { FastifyInstance } from 'fastify'
import type { RawData } from 'ws'
import { getRequestUser } from '../auth/auth.session'
import { findOwnedActiveBoard } from '../boards/board.repository'
import { findActiveShareAccess } from '../shares/share.repository'
import { makeOrLoadRoom } from './room.manager'

export function registerSyncRoutes(app: FastifyInstance) {
  app.get('/connect/:roomId', { websocket: true }, (socket, request) => {
    const user = getRequestUser(request)
    if (!user) {
      socket.close(1008, 'Authentication required')
      return
    }

    const roomId = (request.params as { roomId: string }).roomId
    const ownerBoard = findOwnedActiveBoard(user.id, roomId)
    const shareToken = (request.query as { shareToken?: string }).shareToken
    const sharedAccess = !ownerBoard && shareToken
      ? findActiveShareAccess(shareToken, roomId)
      : null
    if (!ownerBoard && !sharedAccess) {
      socket.close(1008, 'Board not found or access denied')
      return
    }
    const sessionId = (request.query as { sessionId?: string }).sessionId
    if (!sessionId) {
      socket.close(1008, 'Missing sessionId')
      return
    }

    const pendingMessages: RawData[] = []
    const collectMessage = (message: RawData) => pendingMessages.push(message)
    socket.on('message', collectMessage)

    const room = makeOrLoadRoom(roomId)
    room.handleSocketConnect({
      sessionId,
      socket,
      isReadonly: sharedAccess?.access.permission === 'view',
      objectAccess: sharedAccess?.access.permission === 'view' ? 'read' : 'write',
      meta: { userId: user.id, shareId: sharedAccess?.shareId },
    })

    socket.off('message', collectMessage)
    for (const message of pendingMessages) socket.emit('message', message)
  })
}
