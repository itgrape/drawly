import type { Board, BoardListItem, BoardListResponse, BoardResponse } from '@drawly/shared/board'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../../lib/api'
import { BoardNameDialog } from './BoardNameDialog'
import { ShareDialog } from '../shares/ShareDialog'

type DialogState =
  | { mode: 'create' }
  | { mode: 'rename'; board: Board }
  | null

type BoardTab = 'recent' | 'mine' | 'deleted'

export function BoardDashboard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<BoardTab>('recent')
  const [boards, setBoards] = useState<BoardListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [dialogError, setDialogError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [busyBoardId, setBusyBoardId] = useState<string | null>(null)
  const [shareBoard, setShareBoard] = useState<BoardListItem | null>(null)

  const loadBoards = useCallback(async (nextTab: BoardTab) => {
    setLoading(true)
    setPageError('')
    try {
      const query = nextTab === 'deleted'
        ? 'status=deleted&scope=owned'
        : `status=active&scope=${nextTab === 'recent' ? 'recent' : 'owned'}`
      const response = await apiRequest<BoardListResponse>(`/api/boards?${query}`)
      setBoards(response.boards)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '画板加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBoards(tab)
  }, [loadBoards, tab])

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
        await loadBoards(tab)
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
      await loadBoards(tab)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusyBoardId(null)
    }
  }

  function openBoard(board: BoardListItem) {
    navigate(board.shareToken
      ? `/share/${encodeURIComponent(board.shareToken)}`
      : `/boards/${board.id}`)
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
            aria-selected={tab === 'recent'}
            className={tab === 'recent' ? 'active' : ''}
            onClick={() => setTab('recent')}
          >最近使用</button>
          <button
            role="tab"
            aria-selected={tab === 'mine'}
            className={tab === 'mine' ? 'active' : ''}
            onClick={() => setTab('mine')}
          >我的画板</button>
          <button
            role="tab"
            aria-selected={tab === 'deleted'}
            className={tab === 'deleted' ? 'active' : ''}
            onClick={() => setTab('deleted')}
          >回收站</button>
        </div>
      </div>

      {pageError && <div className="boards-error">{pageError}</div>}
      {loading ? (
        <div className="boards-state"><span className="loading-spinner" />正在加载画板…</div>
      ) : boards.length === 0 ? (
        <div className="boards-empty">
          <div className="empty-board-icon">□</div>
          <h2>{emptyTitle(tab)}</h2>
          <p>{emptyDescription(tab)}</p>
          {tab === 'mine' && (
            <button className="primary-button" onClick={() => setDialog({ mode: 'create' })}>新建画板</button>
          )}
        </div>
      ) : (
        <div className="boards-grid">
          {boards.map((board) => (
            <article className="board-card" key={board.id}>
              <button
                className="board-preview"
                onClick={() => tab !== 'deleted' && openBoard(board)}
                disabled={tab === 'deleted'}
                aria-label={`打开${board.title}`}
              >
                <span className="board-preview-grid" />
                <span className="board-preview-logo">D</span>
              </button>
              <div className="board-card-content">
                <h2 title={board.title}>{board.title}</h2>
                <div className="board-card-meta">
                  <p>{formatBoardTime(board, tab)}</p>
                  {board.access !== 'owner' && (
                    <span className={`board-access-label board-access-${board.access}`}>
                      {board.access === 'view' ? '他人分享 · 只读' : '他人分享 · 可编辑'}
                    </span>
                  )}
                </div>
                <div className="board-actions">
                  {tab === 'deleted' ? (
                    <button disabled={busyBoardId === board.id} onClick={() => void runBoardAction(board.id, 'restore')}>恢复</button>
                  ) : board.access === 'owner' ? (
                    <>
                      <button onClick={() => openBoard(board)}>打开</button>
                      <button onClick={() => { setDialogError(''); setDialog({ mode: 'rename', board }) }}>重命名</button>
                      <button onClick={() => setShareBoard(board)}>分享</button>
                      <button disabled={busyBoardId === board.id} onClick={() => void runBoardAction(board.id, 'duplicate')}>复制</button>
                      <button className="danger-action" disabled={busyBoardId === board.id} onClick={() => void runBoardAction(board.id, 'delete')}>删除</button>
                    </>
                  ) : (
                    <button onClick={() => openBoard(board)}>打开</button>
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

function formatBoardTime(board: Board, tab: BoardTab) {
  const timestamp = tab === 'deleted'
    ? board.deletedAt
    : board.lastOpenedAt ?? board.updatedAt
  if (!timestamp) return ''
  const label = tab === 'deleted' ? '删除于' : board.lastOpenedAt ? '最近打开' : '创建于'
  return `${label} ${new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(timestamp)}`
}

function emptyTitle(tab: BoardTab) {
  if (tab === 'recent') return '还没有最近使用的画板'
  if (tab === 'mine') return '还没有自己的画板'
  return '回收站是空的'
}

function emptyDescription(tab: BoardTab) {
  if (tab === 'recent') return '打开自己的画板或他人分享的画板后，它会出现在这里。'
  if (tab === 'mine') return '创建第一个画板，开始和团队一起构思。'
  return '删除的画板会保留在这里，可随时恢复。'
}
