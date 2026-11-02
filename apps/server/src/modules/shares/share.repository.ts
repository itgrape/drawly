import type { BoardShare, SharePermission, SharedBoardAccess } from '@drawly/shared/share'
import { appDatabase } from '../../db/database'

interface ShareRow {
  id: string
  board_id: string
  created_by: string
  token: string
  permission: SharePermission
  created_at: number
  revoked_at: number | null
}

interface ShareAccessRow extends ShareRow {
  title: string
  owner_name: string
  owner_id: string
}

export function listActiveShares(ownerId: string, boardId: string) {
  const rows = appDatabase.prepare(
    `SELECT board_shares.* FROM board_shares
     INNER JOIN boards ON boards.id = board_shares.board_id
     WHERE board_shares.board_id = ? AND boards.owner_id = ?
       AND boards.status = 'active' AND board_shares.revoked_at IS NULL
     ORDER BY board_shares.created_at ASC`
  ).all(boardId, ownerId) as ShareRow[]
  return rows.map(toBoardShare)
}

export function findActiveShareByPermission(
  ownerId: string,
  boardId: string,
  permission: SharePermission
) {
  const row = appDatabase.prepare(
    `SELECT board_shares.* FROM board_shares
     INNER JOIN boards ON boards.id = board_shares.board_id
     WHERE board_shares.board_id = ? AND boards.owner_id = ?
       AND boards.status = 'active' AND board_shares.permission = ?
       AND board_shares.revoked_at IS NULL`
  ).get(boardId, ownerId, permission) as ShareRow | undefined
  return row ? toBoardShare(row) : null
}

export function insertShare(row: ShareRow) {
  appDatabase.prepare(
    `INSERT INTO board_shares
      (id, board_id, created_by, token, permission, created_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`
  ).run(row.id, row.board_id, row.created_by, row.token, row.permission, row.created_at)
}

export function revokeOwnedShare(ownerId: string, boardId: string, shareId: string, now: number) {
  const result = appDatabase.prepare(
    `UPDATE board_shares SET revoked_at = ?
     WHERE id = ? AND board_id = ? AND revoked_at IS NULL
       AND EXISTS (
         SELECT 1 FROM boards
         WHERE boards.id = board_shares.board_id
           AND boards.owner_id = ? AND boards.status = 'active'
       )`
  ).run(now, shareId, boardId, ownerId)
  return result.changes > 0
}

export function findActiveShareAccess(token: string, expectedBoardId?: string) {
  const row = appDatabase.prepare(
    `SELECT board_shares.*, boards.title, boards.owner_id,
            users.display_name AS owner_name
     FROM board_shares
     INNER JOIN boards ON boards.id = board_shares.board_id
     INNER JOIN users ON users.id = boards.owner_id
     WHERE board_shares.token = ? AND board_shares.revoked_at IS NULL
       AND boards.status = 'active'
       AND (? IS NULL OR boards.id = ?)`
  ).get(token, expectedBoardId ?? null, expectedBoardId ?? null) as ShareAccessRow | undefined

  if (!row) return null
  return {
    shareId: row.id,
    ownerId: row.owner_id,
    access: {
      boardId: row.board_id,
      title: row.title,
      permission: row.permission,
      ownerName: row.owner_name,
    } satisfies SharedBoardAccess,
  }
}

function toBoardShare(row: ShareRow): BoardShare {
  return {
    id: row.id,
    boardId: row.board_id,
    permission: row.permission,
    token: row.token,
    createdAt: row.created_at,
  }
}
