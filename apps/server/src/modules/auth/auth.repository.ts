import type { DrawlyUser } from '@drawly/shared/auth'
import { appDatabase } from '../../db/database'

export interface UserRow {
  id: string
  username: string
  password_hash: string
  display_name: string
  avatar_color: string
  created_at: number
  updated_at: number
}

interface SessionUserRow extends UserRow {
  token_hash: string
  expires_at: number
}

export function insertUser(row: UserRow) {
  appDatabase.prepare(
    `INSERT INTO users
      (id, username, password_hash, display_name, avatar_color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    row.username,
    row.password_hash,
    row.display_name,
    row.avatar_color,
    row.created_at,
    row.updated_at
  )
}

export function findUserRowByUsername(username: string) {
  return appDatabase.prepare('SELECT * FROM users WHERE username = ?').get(username) as
    | UserRow
    | undefined
}

export function findUserById(id: string) {
  const row = appDatabase.prepare('SELECT * FROM users WHERE id = ?').get(id) as
    | UserRow
    | undefined
  return row ? toPublicUser(row) : null
}

export function updateUserProfile(
  userId: string,
  displayName: string,
  avatarColor: string,
  updatedAt: number
) {
  appDatabase.prepare(
    'UPDATE users SET display_name = ?, avatar_color = ?, updated_at = ? WHERE id = ?'
  ).run(displayName, avatarColor, updatedAt, userId)
}

export function insertSession(
  tokenHash: string,
  userId: string,
  createdAt: number,
  expiresAt: number
) {
  appDatabase.prepare(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(tokenHash, userId, createdAt, expiresAt, createdAt)
}

export function deleteSession(tokenHash: string) {
  appDatabase.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
}

export function deleteExpiredSessions(now: number) {
  appDatabase.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now)
}

export function findUserBySession(tokenHash: string, now: number) {
  const row = appDatabase.prepare(
    `SELECT users.*, sessions.token_hash, sessions.expires_at
     FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`
  ).get(tokenHash, now) as SessionUserRow | undefined

  if (!row) return null
  appDatabase.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?')
    .run(now, row.token_hash)
  return toPublicUser(row)
}

export function toPublicUser(row: UserRow): DrawlyUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
