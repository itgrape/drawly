export type SharePermission = 'view' | 'edit'

export interface BoardShare {
  id: string
  boardId: string
  permission: SharePermission
  token: string
  createdAt: number
}

export interface BoardShareListResponse {
  shares: BoardShare[]
}

export interface BoardShareResponse {
  share: BoardShare
}

export interface SharedBoardAccess {
  boardId: string
  title: string
  permission: SharePermission
  ownerName: string
}

export interface SharedBoardAccessResponse {
  access: SharedBoardAccess
}
