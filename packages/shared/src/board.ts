export type BoardStatus = 'active' | 'deleted'

export interface Board {
  id: string
  title: string
  status: BoardStatus
  createdAt: number
  updatedAt: number
  lastOpenedAt: number | null
  deletedAt: number | null
}

export interface BoardResponse {
  board: Board
}

export interface BoardListResponse {
  boards: Board[]
}
