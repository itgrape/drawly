import type { Board, BoardStatus } from '@drawly/shared/board'
import { appDatabase } from '../../db/database'

export interface BoardRow {
  id: string
  owner_id: string
  title: string
  status: BoardStatus
  created_at: number
  updated_at: number
  last_opened_at: number | null
  deleted_at: number | null
}

export function listOwnedBoards(ownerId: string, status: BoardStatus) {
  const rows = appDatabase.prepare(
    `SELECT * FROM boards
     WHERE owner_id = ? AND status = ?
     ORDER BY COALESCE(last_opened_at, updated_at) DESC, created_at DESC`
  ).all(ownerId, status) as BoardRow[]
  return rows.map(toBoard)
}

export function findOwnedBoardRow(ownerId: string, boardId: string) {
  return appDatabase.prepare(
    'SELECT * FROM boards WHERE id = ? AND owner_id = ?'
  ).get(boardId, ownerId) as BoardRow | undefined
}

export function findOwnedActiveBoard(ownerId: string, boardId: string) {
  const row = appDatabase.prepare(
    `SELECT * FROM boards
     WHERE id = ? AND owner_id = ? AND status = 'active'`
  ).get(boardId, ownerId) as BoardRow | undefined
  return row ? toBoard(row) : null
}

export function insertBoard(row: BoardRow) {
  appDatabase.prepare(
    `INSERT INTO boards
      (id, owner_id, title, status, created_at, updated_at, last_opened_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    row.owner_id,
    row.title,
    row.status,
    row.created_at,
    row.updated_at,
    row.last_opened_at,
    row.deleted_at
  )
}

export function renameOwnedActiveBoard(
  ownerId: string,
  boardId: string,
  title: string,
  now: number
) {
  const result = appDatabase.prepare(
    `UPDATE boards SET title = ?, updated_at = ?
     WHERE id = ? AND owner_id = ? AND status = 'active'`
  ).run(title, now, boardId, ownerId)
  return result.changes > 0
}

export function touchOwnedActiveBoard(ownerId: string, boardId: string, now: number) {
  const result = appDatabase.prepare(
    `UPDATE boards SET last_opened_at = ?
     WHERE id = ? AND owner_id = ? AND status = 'active'`
  ).run(now, boardId, ownerId)
  return result.changes > 0
}

export function softDeleteOwnedBoard(ownerId: string, boardId: string, now: number) {
  const result = appDatabase.prepare(
    `UPDATE boards SET status = 'deleted', deleted_at = ?, updated_at = ?
     WHERE id = ? AND owner_id = ? AND status = 'active'`
  ).run(now, now, boardId, ownerId)
  return result.changes > 0
}

export function restoreOwnedBoard(ownerId: string, boardId: string, now: number) {
  const result = appDatabase.prepare(
    `UPDATE boards SET status = 'active', deleted_at = NULL, updated_at = ?
     WHERE id = ? AND owner_id = ? AND status = 'deleted'`
  ).run(now, boardId, ownerId)
  return result.changes > 0
}

export function toBoard(row: BoardRow): Board {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
    deletedAt: row.deleted_at,
  }
}
