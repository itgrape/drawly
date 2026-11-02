import type {
  BoardShare,
  BoardShareListResponse,
  BoardShareResponse,
  SharePermission,
} from '@drawly/shared/share'
import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../../lib/api'

export function ShareDialog({
  boardId,
  boardTitle,
  onClose,
}: {
  boardId: string
  boardTitle: string
  onClose: () => void
}) {
  const [shares, setShares] = useState<BoardShare[]>([])
  const [loading, setLoading] = useState(true)
  const [busyPermission, setBusyPermission] = useState<SharePermission | null>(null)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadShares = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiRequest<BoardShareListResponse>(
        `/api/boards/${encodeURIComponent(boardId)}/shares`
      )
      setShares(response.shares)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '分享设置加载失败')
    } finally {
      setLoading(false)
    }
  }, [boardId])

  useEffect(() => { void loadShares() }, [loadShares])

  async function createShare(permission: SharePermission) {
    setBusyPermission(permission)
    setError('')
    try {
      const response = await apiRequest<BoardShareResponse>(
        `/api/boards/${encodeURIComponent(boardId)}/shares`,
        { method: 'POST', body: JSON.stringify({ permission }) }
      )
      setShares((current) => [
        ...current.filter((share) => share.permission !== permission),
        response.share,
      ])
      await copyShare(response.share)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '分享链接生成失败')
    } finally {
      setBusyPermission(null)
    }
  }

  async function revokeShare(share: BoardShare) {
    setBusyPermission(share.permission)
    setError('')
    try {
      await apiRequest(
        `/api/boards/${encodeURIComponent(boardId)}/shares/${encodeURIComponent(share.id)}`,
        { method: 'DELETE' }
      )
      setShares((current) => current.filter((item) => item.id !== share.id))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '关闭分享失败')
    } finally {
      setBusyPermission(null)
    }
  }

  async function copyShare(share: BoardShare) {
    try {
      await copyText(shareUrl(share.token))
      setCopiedId(share.id)
      window.setTimeout(() => setCopiedId((current) => current === share.id ? null : current), 1800)
    } catch {
      setError('无法自动复制，请手动复制链接')
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="share-dialog-header">
          <div>
            <h2 id="share-dialog-title">分享画板</h2>
            <p title={boardTitle}>{boardTitle}</p>
          </div>
          <button className="dialog-close-button" onClick={onClose} aria-label="关闭">×</button>
        </header>

        {loading ? (
          <div className="share-loading"><span className="loading-spinner" />正在加载…</div>
        ) : (
          <div className="share-options">
            <ShareOption
              permission="view"
              title="只读分享"
              description="获得链接的人可以查看画板和协作光标，但不能修改内容。"
              share={shares.find((item) => item.permission === 'view')}
              busy={busyPermission === 'view'}
              copied={copiedId === shares.find((item) => item.permission === 'view')?.id}
              onCreate={createShare}
              onCopy={copyShare}
              onRevoke={revokeShare}
            />
            <ShareOption
              permission="edit"
              title="可编辑分享"
              description="获得链接的人可以进入画板并实时编辑内容。"
              share={shares.find((item) => item.permission === 'edit')}
              busy={busyPermission === 'edit'}
              copied={copiedId === shares.find((item) => item.permission === 'edit')?.id}
              onCreate={createShare}
              onCopy={copyShare}
              onRevoke={revokeShare}
            />
          </div>
        )}
        {error && <div className="form-error share-error">{error}</div>}
        <p className="share-login-note">访问者需要登录 Drawly；关闭链接后，已打开的共享会话也会断开。</p>
      </section>
    </div>
  )
}

function ShareOption({
  permission,
  title,
  description,
  share,
  busy,
  copied,
  onCreate,
  onCopy,
  onRevoke,
}: {
  permission: SharePermission
  title: string
  description: string
  share?: BoardShare
  busy: boolean
  copied: boolean
  onCreate: (permission: SharePermission) => void
  onCopy: (share: BoardShare) => void
  onRevoke: (share: BoardShare) => void
}) {
  return (
    <div className="share-option">
      <div className={`share-permission-icon share-permission-${permission}`} aria-hidden="true">
        {permission === 'view' ? '◉' : '✎'}
      </div>
      <div className="share-option-body">
        <div className="share-option-heading">
          <h3>{title}</h3>
          <span className={share ? 'share-status-enabled' : ''}>{share ? '已开启' : '未开启'}</span>
        </div>
        <p>{description}</p>
        {share ? (
          <div className="share-link-row">
            <input value={shareUrl(share.token)} readOnly aria-label={`${title}链接`} />
            <button className="secondary-button" disabled={busy} onClick={() => void onCopy(share)}>
              {copied ? '已复制' : '复制'}
            </button>
            <button className="share-revoke-button" disabled={busy} onClick={() => void onRevoke(share)}>
              关闭
            </button>
          </div>
        ) : (
          <button className="secondary-button share-create-button" disabled={busy} onClick={() => void onCreate(permission)}>
            {busy ? '生成中…' : `生成并复制${title}链接`}
          </button>
        )}
      </div>
    </div>
  )
}

function shareUrl(token: string) {
  return `${window.location.origin}/share/${encodeURIComponent(token)}`
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('Copy failed')
}
