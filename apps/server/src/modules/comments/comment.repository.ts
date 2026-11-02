import type { CommentMember } from '@drawly/shared/comment'
import { appDatabase } from '../../db/database'

interface CommentMemberRow {
  id: string
  username: string
  display_name: string
  avatar_color: string
  is_owner: number
}

export function listCommentMembers(boardId: string) {
  const rows = appDatabase.prepare(
    `SELECT users.id, users.username, users.display_name, users.avatar_color,
            CASE WHEN boards.owner_id = users.id THEN 1 ELSE 0 END AS is_owner
     FROM users
     INNER JOIN boards ON boards.id = ?
     WHERE users.id = boards.owner_id
        OR users.id IN (
          SELECT board_recents.user_id
          FROM board_recents
          WHERE board_recents.board_id = boards.id
        )
     ORDER BY is_owner DESC, users.display_name COLLATE NOCASE, users.username COLLATE NOCASE`
  ).all(boardId) as CommentMemberRow[]

  return rows.map((row): CommentMember => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
  }))
}
