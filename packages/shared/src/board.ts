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

export type BoardAccess = 'owner' | 'view' | 'edit'

export interface BoardListItem extends Board {
  access: BoardAccess
  ownerName: string
  shareToken: string | null
}

export interface BoardResponse {
  board: Board
}

export interface BoardListResponse {
  boards: BoardListItem[]
}
