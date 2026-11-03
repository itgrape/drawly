import { NodeSqliteWrapper, SQLiteSyncStorage, TLSocketRoom } from '@tldraw/sync-core'
import { createCommentAuthorizers } from '@tldraw/sync-collaboration'
import { commentSchemaRecords, createTLSchema } from '@tldraw/tlschema'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { env } from '../../config/env'

const roomsDirectory = path.join(env.dataDirectory, 'rooms')
mkdirSync(roomsDirectory, { recursive: true })

const COMMENT_OBJECT_TYPES = ['comment', 'comment-thread', 'comment-reaction'] as const
const roomSchema = createTLSchema({ records: commentSchemaRecords })

interface RoomSessionMeta {
  userId: string
  shareId?: string
}

const activeRooms = new Map<string, TLSocketRoom<any, RoomSessionMeta>>()

export function makeOrLoadRoom(rawRoomId: string) {
  const roomId = sanitizeRoomId(rawRoomId)
  const existingRoom = activeRooms.get(roomId)

  if (existingRoom && !existingRoom.isClosed()) return existingRoom

  const database = new Database(path.join(roomsDirectory, `${roomId}.db`))
  const storage = new SQLiteSyncStorage({
    sql: new NodeSqliteWrapper(database),
    objectTypes: COMMENT_OBJECT_TYPES,
  })
  const room = new TLSocketRoom<any, RoomSessionMeta>({
    storage,
    schema: roomSchema,
    objectTypes: COMMENT_OBJECT_TYPES,
    authorizeRecord: {
      ...createCommentAuthorizers<RoomSessionMeta>({
        getUserId: (session) => session.meta.userId,
      }),
    },
    onSessionRemoved(room, args) {
      if (args.numSessionsRemaining === 0) {
        room.close()
        database.close()
        activeRooms.delete(roomId)
      }
    },
  })

  activeRooms.set(roomId, room)
  return room
}

// Read an inactive room without retaining a database connection or creating a sync session.
export function getRoomPreviewSnapshot(rawRoomId: string) {
  const roomId = sanitizeRoomId(rawRoomId)
  const active = activeRooms.get(roomId)
  if (active && !active.isClosed()) return active.getCurrentSnapshot()
  const database = new Database(path.join(roomsDirectory, `${roomId}.db`))
  const room = new TLSocketRoom({
    storage: new SQLiteSyncStorage({ sql: new NodeSqliteWrapper(database), objectTypes: COMMENT_OBJECT_TYPES }),
    schema: roomSchema,
    objectTypes: COMMENT_OBJECT_TYPES,
  })
  try {
    return room.getCurrentSnapshot()
  } finally {
    room.close()
    database.close()
  }
}

export function closeSessionsForShare(rawRoomId: string, shareId: string) {
  const room = activeRooms.get(sanitizeRoomId(rawRoomId))
  if (!room || room.isClosed()) return
  for (const session of room.getSessions()) {
    if (session.meta.shareId === shareId) {
      room.closeSession(session.sessionId, 'FORBIDDEN')
    }
  }
}

export async function duplicateRoomDatabase(rawSourceId: string, rawTargetId: string) {
  const sourceId = sanitizeRoomId(rawSourceId)
  const targetId = sanitizeRoomId(rawTargetId)
  const sourcePath = path.join(roomsDirectory, `${sourceId}.db`)
  if (!existsSync(sourcePath)) return

  const sourceDatabase = new Database(sourcePath, { readonly: true })
  try {
    await sourceDatabase.backup(path.join(roomsDirectory, `${targetId}.db`))
  } finally {
    sourceDatabase.close()
  }
}

function sanitizeRoomId(roomId: string) {
  const sanitized = roomId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)
  return sanitized || 'invalid-room'
}
