import type { Board, BoardListItem, BoardStatus } from '@drawly/shared/board'
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
    `SELECT boards.*, users.display_name AS owner_name FROM boards
     INNER JOIN users ON users.id = boards.owner_id
     WHERE boards.owner_id = ? AND boards.status = ?
     ORDER BY COALESCE(boards.last_opened_at, boards.updated_at) DESC, boards.created_at DESC`
  ).all(ownerId, status) as Array<BoardRow & { owner_name: string }>
  return rows.map((row) => toBoardListItem(row, 'owner', row.owner_name, null))
}

interface RecentBoardRow extends BoardRow {
  owner_name: string
  access: 'owner' | 'view' | 'edit'
  share_token: string | null
  recent_opened_at: number
}

export function listRecentBoards(userId: string) {
  const rows = appDatabase.prepare(
    `SELECT boards.id, boards.owner_id, boards.title, boards.status,
            boards.created_at, boards.updated_at,
            board_recents.last_opened_at AS recent_opened_at,
            board_recents.last_opened_at, boards.deleted_at,
            owners.display_name AS owner_name,
            CASE WHEN boards.owner_id = ? THEN 'owner' ELSE board_shares.permission END AS access,
            CASE WHEN boards.owner_id = ? THEN NULL ELSE board_shares.token END AS share_token
     FROM board_recents
     INNER JOIN boards ON boards.id = board_recents.board_id
     INNER JOIN users AS owners ON owners.id = boards.owner_id
     LEFT JOIN board_shares
       ON board_shares.id = board_recents.share_id
      AND board_shares.board_id = boards.id
      AND board_shares.revoked_at IS NULL
     WHERE board_recents.user_id = ? AND boards.status = 'active'
       AND (boards.owner_id = ? OR board_shares.id IS NOT NULL)
     ORDER BY board_recents.last_opened_at DESC`
  ).all(userId, userId, userId, userId) as RecentBoardRow[]

  return rows.map((row) => toBoardListItem(
    row,
    row.access,
    row.owner_name,
    row.share_token
  ))
}

export function recordRecentBoard(
  userId: string,
  boardId: string,
  shareId: string | null,
  now: number
) {
  appDatabase.prepare(
    `INSERT INTO board_recents (user_id, board_id, share_id, last_opened_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, board_id) DO UPDATE SET
       share_id = excluded.share_id,
       last_opened_at = excluded.last_opened_at`
  ).run(userId, boardId, shareId, now)
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

function toBoardListItem(
  row: BoardRow,
  access: BoardListItem['access'],
  ownerName: string,
  shareToken: string | null
): BoardListItem {
  return { ...toBoard(row), access, ownerName, shareToken }
}
