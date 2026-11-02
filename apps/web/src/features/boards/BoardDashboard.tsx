import type { Board, BoardListResponse, BoardResponse, BoardStatus } from '@drawly/shared/board'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../../lib/api'
import { BoardNameDialog } from './BoardNameDialog'
import { ShareDialog } from '../shares/ShareDialog'

type DialogState =
  | { mode: 'create' }
  | { mode: 'rename'; board: Board }
  | null

export function BoardDashboard() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<BoardStatus>('active')
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [dialogError, setDialogError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [busyBoardId, setBusyBoardId] = useState<string | null>(null)
  const [shareBoard, setShareBoard] = useState<Board | null>(null)

  const loadBoards = useCallback(async (nextStatus: BoardStatus) => {
    setLoading(true)
    setPageError('')
    try {
      const response = await apiRequest<BoardListResponse>(`/api/boards?status=${nextStatus}`)
      setBoards(response.boards)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '画板加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBoards(status)
  }, [loadBoards, status])

  async function submitName(title: string) {
    if (!dialog) return
    setSubmitting(true)
    setDialogError('')
    try {
      if (dialog.mode === 'create') {
        const response = await apiRequest<BoardResponse>('/api/boards', {
          method: 'POST',
          body: JSON.stringify({ title }),
        })
        setDialog(null)
        navigate(`/boards/${response.board.id}`)
      } else {
        await apiRequest<BoardResponse>(`/api/boards/${dialog.board.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title }),
        })
        setDialog(null)
        await loadBoards(status)
      }
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function runBoardAction(boardId: string, action: 'duplicate' | 'delete' | 'restore') {
    setBusyBoardId(boardId)
    setPageError('')
    try {
      if (action === 'duplicate') {
        await apiRequest<BoardResponse>(`/api/boards/${boardId}/duplicate`, { method: 'POST' })
      } else if (action === 'delete') {
        await apiRequest(`/api/boards/${boardId}`, { method: 'DELETE' })
      } else {
        await apiRequest<BoardResponse>(`/api/boards/${boardId}/restore`, { method: 'POST' })
      }
      await loadBoards(status)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusyBoardId(null)
    }
  }

  return (
    <div className="boards-page">
      <header className="boards-header">
        <div className="boards-brand">
          <span className="brand-mark boards-brand-mark">D</span>
          <div>
            <h1>画板</h1>
            <p>管理你的协作空间</p>
          </div>
        </div>
        <button className="primary-button create-board-button" onClick={() => setDialog({ mode: 'create' })}>
          ＋ 新建画板
        </button>
      </header>

      <div className="boards-toolbar">
        <div className="board-tabs" role="tablist" aria-label="画板分类">
          <button
            role="tab"
            aria-selected={status === 'active'}
            className={status === 'active' ? 'active' : ''}
            onClick={() => setStatus('active')}
          >最近使用</button>
          <button
            role="tab"
            aria-selected={status === 'deleted'}
            className={status === 'deleted' ? 'active' : ''}
            onClick={() => setStatus('deleted')}
          >回收站</button>
        </div>
      </div>

      {pageError && <div className="boards-error">{pageError}</div>}
      {loading ? (
        <div className="boards-state"><span className="loading-spinner" />正在加载画板…</div>
      ) : boards.length === 0 ? (
        <div className="boards-empty">
          <div className="empty-board-icon">□</div>
          <h2>{status === 'active' ? '还没有画板' : '回收站是空的'}</h2>
          <p>{status === 'active' ? '创建第一个画板，开始和团队一起构思。' : '删除的画板会保留在这里，可随时恢复。'}</p>
          {status === 'active' && (
            <button className="primary-button" onClick={() => setDialog({ mode: 'create' })}>新建画板</button>
          )}
        </div>
      ) : (
        <div className="boards-grid">
          {boards.map((board) => (
            <article className="board-card" key={board.id}>
              <button
                className="board-preview"
                onClick={() => status === 'active' && navigate(`/boards/${board.id}`)}
                disabled={status === 'deleted'}
                aria-label={`打开${board.title}`}
              >
                <span className="board-preview-grid" />
                <span className="board-preview-logo">D</span>
              </button>
              <div className="board-card-content">
                <h2 title={board.title}>{board.title}</h2>
                <p>{formatBoardTime(board, status)}</p>
                <div className="board-actions">
                  {status === 'active' ? (
                    <>
                      <button onClick={() => navigate(`/boards/${board.id}`)}>打开</button>
                      <button onClick={() => { setDialogError(''); setDialog({ mode: 'rename', board }) }}>重命名</button>
                      <button onClick={() => setShareBoard(board)}>分享</button>
                      <button disabled={busyBoardId === board.id} onClick={() => void runBoardAction(board.id, 'duplicate')}>复制</button>
                      <button className="danger-action" disabled={busyBoardId === board.id} onClick={() => void runBoardAction(board.id, 'delete')}>删除</button>
                    </>
                  ) : (
                    <button disabled={busyBoardId === board.id} onClick={() => void runBoardAction(board.id, 'restore')}>恢复</button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {dialog && (
        <BoardNameDialog
          mode={dialog.mode}
          initialTitle={dialog.mode === 'rename' ? dialog.board.title : ''}
          submitting={submitting}
          error={dialogError}
          onClose={() => { if (!submitting) setDialog(null) }}
          onSubmit={(title) => void submitName(title)}
        />
      )}
      {shareBoard && (
        <ShareDialog
          boardId={shareBoard.id}
          boardTitle={shareBoard.title}
          onClose={() => setShareBoard(null)}
        />
      )}
    </div>
  )
}

function formatBoardTime(board: Board, status: BoardStatus) {
  const timestamp = status === 'deleted'
    ? board.deletedAt
    : board.lastOpenedAt ?? board.updatedAt
  if (!timestamp) return ''
  const label = status === 'deleted' ? '删除于' : board.lastOpenedAt ? '最近打开' : '创建于'
  return `${label} ${new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(timestamp)}`
}
