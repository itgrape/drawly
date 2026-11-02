import type { AuthResponse, DrawlyUser } from '@drawly/shared/auth'
import { type FormEvent, useState } from 'react'
import { UserAvatar } from '../../components/UserAvatar'
import { apiRequest } from '../../lib/api'

export function ProfileDialog({
  user,
  onClose,
  onSaved,
}: {
  user: DrawlyUser
  onClose: () => void
  onSaved: (user: DrawlyUser) => void
}) {
  const [displayName, setDisplayName] = useState(user.displayName)
  const [avatarColor, setAvatarColor] = useState(user.avatarColor)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const response = await apiRequest<AuthResponse>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName, avatarColor }),
      })
      if (response.user) onSaved(response.user)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="profile-heading">
          <UserAvatar user={{ ...user, displayName, avatarColor }} large />
          <div>
            <h2 id="profile-title">个人资料</h2>
            <p>@{user.username}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            显示名称
            <input
              value={displayName}
              maxLength={50}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </label>
          <label>
            头像颜色
            <input
              className="color-input"
              type="color"
              value={avatarColor}
              onChange={(event) => setAvatarColor(event.target.value)}
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <div className="dialog-actions">
            <button type="button" className="secondary-button" onClick={onClose}>取消</button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? '保存中…' : '保存'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
