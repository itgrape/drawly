export interface CommentMember {
  id: string
  username: string
  displayName: string
  avatarColor: string
}

export interface CommentMembersResponse {
  members: CommentMember[]
}
