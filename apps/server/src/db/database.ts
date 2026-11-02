import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { env } from '../config/env'

mkdirSync(env.dataDirectory, { recursive: true })

export const appDatabase = new Database(path.join(env.dataDirectory, 'app.db'))

appDatabase.pragma('journal_mode = WAL')
appDatabase.pragma('foreign_keys = ON')
appDatabase.pragma('busy_timeout = 5000')

appDatabase.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_opened_at INTEGER,
    deleted_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS boards_owner_status_idx ON boards(owner_id, status);
  CREATE INDEX IF NOT EXISTS boards_recent_idx
    ON boards(owner_id, status, last_opened_at DESC, updated_at DESC);

  CREATE TABLE IF NOT EXISTS board_shares (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')),
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS board_shares_token_idx ON board_shares(token);
  CREATE INDEX IF NOT EXISTS board_shares_board_idx ON board_shares(board_id, revoked_at);
  CREATE UNIQUE INDEX IF NOT EXISTS board_shares_active_permission_idx
    ON board_shares(board_id, permission) WHERE revoked_at IS NULL;
`)
