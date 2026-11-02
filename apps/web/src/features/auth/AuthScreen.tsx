import type { AuthResponse, DrawlyUser } from '@drawly/shared/auth'
import { type FormEvent, useState } from 'react'
import { apiRequest } from '../../lib/api'

export function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: DrawlyUser) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await apiRequest<AuthResponse>(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ username, password, displayName }),
      })
      if (response.user) onAuthenticated(response.user)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '请求失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode() {
    setMode((current) => (current === 'login' ? 'register' : 'login'))
    setError('')
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">D</div>
        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              显示名称
              <input
                autoComplete="name"
                maxLength={50}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="例如：张三"
                required
              />
            </label>
          )}
          <label>
            用户名
            <input
              autoComplete="username"
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_]+"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="字母、数字或下划线"
              required
            />
          </label>
          <label>
            密码
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 8 位"
              required
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </form>
        <button className="switch-auth-button" type="button" onClick={switchMode}>
          {mode === 'login' ? '还没有账号？创建账号' : '已有账号？返回登录'}
        </button>
      </section>
    </div>
  )
}
