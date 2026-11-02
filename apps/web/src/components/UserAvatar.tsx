import type { DrawlyUser } from '@drawly/shared/auth'

export function UserAvatar({ user, large = false }: { user: DrawlyUser; large?: boolean }) {
  return (
    <span
      className={`user-avatar${large ? ' user-avatar-large' : ''}`}
      style={{ backgroundColor: user.avatarColor }}
      aria-hidden="true"
    >
      {Array.from(user.displayName.trim())[0]?.toUpperCase() ?? '?'}
    </span>
  )
}
