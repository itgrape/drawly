export interface DrawlyUser {
  id: string
  username: string
  displayName: string
  avatarColor: string
  createdAt: number
  updatedAt: number
}

export interface AuthResponse {
  user: DrawlyUser | null
}

export interface AuthErrorResponse {
  error: string
  field?: 'username' | 'password' | 'displayName' | 'avatarColor'
}
