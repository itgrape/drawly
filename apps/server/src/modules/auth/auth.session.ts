import type { DrawlyUser } from '@drawly/shared/auth'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { env } from '../../config/env'
import {
  deleteExpiredSessions,
  deleteSession,
  findUserBySession,
  insertSession,
} from './auth.repository'
import { createSessionToken, hashSessionToken } from './auth.security'

const SESSION_COOKIE = 'drawly_session'
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

export function createSession(reply: FastifyReply, userId: string) {
  const token = createSessionToken()
  const now = Date.now()
  const expiresAt = now + SESSION_DURATION_MS

  insertSession(hashSessionToken(token), userId, now, expiresAt)
  deleteExpiredSessions(now)
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  })
}

export function destroySession(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[SESSION_COOKIE]
  if (token) deleteSession(hashSessionToken(token))
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
  })
}

export function getRequestUser(request: FastifyRequest): DrawlyUser | null {
  const token = request.cookies[SESSION_COOKIE]
  return token ? findUserBySession(hashSessionToken(token), Date.now()) : null
}

export function requireRequestUser(
  request: FastifyRequest,
  reply: FastifyReply
): DrawlyUser | null {
  const user = getRequestUser(request)
  if (!user) {
    reply.code(401).send({ error: '请先登录' })
    return null
  }
  return user
}
