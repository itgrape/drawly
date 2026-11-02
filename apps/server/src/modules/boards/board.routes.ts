import type { BoardStatus } from '@drawly/shared/board'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { requireRequestUser } from '../auth/auth.session'
import { duplicateRoomDatabase } from '../sync/room.manager'
import {
  findOwnedActiveBoard,
  findOwnedBoardRow,
  insertBoard,
  listOwnedBoards,
  renameOwnedActiveBoard,
  restoreOwnedBoard,
  softDeleteOwnedBoard,
  toBoard,
  touchOwnedActiveBoard,
} from './board.repository'

const MAX_TITLE_LENGTH = 80

export function registerBoardRoutes(app: FastifyInstance) {
  app.get('/api/boards', async (request, reply) => {
    const user = requireRequestUser(request, reply)
    if (!user) return
    const requestedStatus = (request.query as { status?: string }).status
    const status: BoardStatus = requestedStatus === 'deleted' ? 'deleted' : 'active'
    return { boards: listOwnedBoards(user.id, status) }
  })

  app.post('/api/boards', async (request, reply) => {
    const user = requireRequestUser(request, reply)
    if (!user) return
    const title = readTitle((request.body as { title?: unknown } | null)?.title, reply, true)
    if (!title) return

    const now = Date.now()
    const row = {
      id: randomUUID(),
      owner_id: user.id,
      title,
      status: 'active' as const,
      created_at: now,
      updated_at: now,
      last_opened_at: null,
      deleted_at: null,
    }
    insertBoard(row)
    reply.code(201)
    return { board: toBoard(row) }
  })

  app.get('/api/boards/:boardId', async (request, reply) => {
    const user = requireRequestUser(request, reply)
    if (!user) return
    const boardId = getBoardId(request.params)
    const board = findOwnedActiveBoard(user.id, boardId)
    if (!board) return notFound(reply)

    const now = Date.now()
    touchOwnedActiveBoard(user.id, boardId, now)
    return { board: { ...board, lastOpenedAt: now } }
  })

  app.patch('/api/boards/:boardId', async (request, reply) => {
    const user = requireRequestUser(request, reply)
    if (!user) return
    const title = readTitle((request.body as { title?: unknown } | null)?.title, reply)
    if (!title) return
    const boardId = getBoardId(request.params)
    if (!renameOwnedActiveBoard(user.id, boardId, title, Date.now())) return notFound(reply)
    return { board: findOwnedActiveBoard(user.id, boardId) }
  })

  app.post('/api/boards/:boardId/duplicate', async (request, reply) => {
    const user = requireRequestUser(request, reply)
    if (!user) return
    const sourceId = getBoardId(request.params)
    const source = findOwnedBoardRow(user.id, sourceId)
    if (!source || source.status !== 'active') return notFound(reply)

    const now = Date.now()
    const row = {
      ...source,
      id: randomUUID(),
      title: copyTitle(source.title),
      status: 'active' as const,
      created_at: now,
      updated_at: now,
      last_opened_at: null,
      deleted_at: null,
    }
    await duplicateRoomDatabase(source.id, row.id)
    insertBoard(row)
    reply.code(201)
    return { board: toBoard(row) }
  })

  app.delete('/api/boards/:boardId', async (request, reply) => {
    const user = requireRequestUser(request, reply)
    if (!user) return
    if (!softDeleteOwnedBoard(user.id, getBoardId(request.params), Date.now())) {
      return notFound(reply)
    }
    reply.code(204).send()
  })

  app.post('/api/boards/:boardId/restore', async (request, reply) => {
    const user = requireRequestUser(request, reply)
    if (!user) return
    const boardId = getBoardId(request.params)
    if (!restoreOwnedBoard(user.id, boardId, Date.now())) return notFound(reply)
    return { board: findOwnedActiveBoard(user.id, boardId) }
  })
}

function getBoardId(params: unknown) {
  return (params as { boardId: string }).boardId
}

function readTitle(value: unknown, reply: FastifyReply, allowDefault = false) {
  const title = typeof value === 'string' ? value.trim() : ''
  if (!title && allowDefault) return '未命名画板'
  if (!title) {
    reply.code(400).send({ error: '请输入画板名称' })
    return null
  }
  if (title.length > MAX_TITLE_LENGTH) {
    reply.code(400).send({ error: `画板名称不能超过 ${MAX_TITLE_LENGTH} 个字符` })
    return null
  }
  return title
}

function copyTitle(title: string) {
  const suffix = ' 副本'
  return `${title.slice(0, MAX_TITLE_LENGTH - suffix.length)}${suffix}`
}

function notFound(reply: FastifyReply) {
  return reply.code(404).send({ error: '画板不存在或无权访问' })
}
