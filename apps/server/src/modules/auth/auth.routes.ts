import type { AuthResponse } from '@drawly/shared/auth'
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import {
  findUserById,
  findUserRowByUsername,
  insertUser,
  toPublicUser,
  updateUserProfile,
} from './auth.repository'
import { avatarColorForUser, hashPassword, verifyPassword } from './auth.security'
import {
  createSession,
  destroySession,
  getRequestUser,
  requireRequestUser,
} from './auth.session'

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,32}$/
const AVATAR_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get('/api/auth/me', async (request): Promise<AuthResponse> => ({
    user: getRequestUser(request),
  }))

  app.post('/api/auth/register', async (request, reply) => {
    const body = asObject(request.body)
    const username = normalizeUsername(body.username)
    const password = typeof body.password === 'string' ? body.password : ''
    const displayName = normalizeDisplayName(body.displayName)

    if (!USERNAME_PATTERN.test(username)) {
      return reply.code(400).send({
        error: '用户名需为 3–32 位字母、数字或下划线', field: 'username',
      })
    }
    if (password.length < 8 || password.length > 128) {
      return reply.code(400).send({ error: '密码长度需为 8–128 位', field: 'password' })
    }
    if (!displayName) {
      return reply.code(400).send({
        error: '显示名称不能为空且不能超过 50 个字符', field: 'displayName',
      })
    }

    const now = Date.now()
    const userId = randomUUID()
    try {
      insertUser({
        id: userId,
        username,
        password_hash: await hashPassword(password),
        display_name: displayName,
        avatar_color: avatarColorForUser(userId),
        created_at: now,
        updated_at: now,
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return reply.code(409).send({ error: '该用户名已被使用', field: 'username' })
      }
      throw error
    }

    const user = findUserById(userId)!
    createSession(reply, user.id)
    return reply.code(201).send({ user })
  })

  app.post('/api/auth/login', async (request, reply) => {
    const body = asObject(request.body)
    const username = normalizeUsername(body.username)
    const password = typeof body.password === 'string' ? body.password : ''
    const row = findUserRowByUsername(username)

    if (!row || !(await verifyPassword(row.password_hash, password))) {
      return reply.code(401).send({ error: '用户名或密码错误' })
    }

    createSession(reply, row.id)
    return reply.send({ user: toPublicUser(row) })
  })

  app.post('/api/auth/logout', async (request, reply) => {
    destroySession(request, reply)
    return reply.code(204).send()
  })

  app.patch('/api/auth/profile', async (request, reply) => {
    const user = requireRequestUser(request, reply)
    if (!user) return

    const body = asObject(request.body)
    const displayName = normalizeDisplayName(body.displayName)
    const avatarColor = typeof body.avatarColor === 'string' ? body.avatarColor : ''

    if (!displayName) {
      return reply.code(400).send({
        error: '显示名称不能为空且不能超过 50 个字符', field: 'displayName',
      })
    }
    if (!AVATAR_COLOR_PATTERN.test(avatarColor)) {
      return reply.code(400).send({
        error: '头像颜色必须是有效的十六进制颜色', field: 'avatarColor',
      })
    }

    updateUserProfile(user.id, displayName, avatarColor.toLowerCase(), Date.now())
    return reply.send({ user: findUserById(user.id) })
  })
}

function normalizeUsername(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeDisplayName(value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim()
  return normalized.length <= 50 ? normalized : ''
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error &&
    String(error.code).startsWith('SQLITE_CONSTRAINT')
}
