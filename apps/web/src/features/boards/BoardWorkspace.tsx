import type { BoardResponse } from '@drawly/shared/board'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import type { AuthenticatedOutletContext } from '../../app/AuthenticatedLayout'
import { LoadingScreen } from '../../components/LoadingScreen'
import { apiRequest } from '../../lib/api'
import { CollaborativeBoard } from '../board/CollaborativeBoard'
import { ShareDialog } from '../shares/ShareDialog'

type BoardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; title: string }

export function BoardWorkspace() {
  const { boardId = '' } = useParams()
  const { user } = useOutletContext<AuthenticatedOutletContext>()
  const navigate = useNavigate()
  const [boardState, setBoardState] = useState<BoardState>({ status: 'loading' })
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    let active = true
    setBoardState({ status: 'loading' })
    apiRequest<BoardResponse>(`/api/boards/${encodeURIComponent(boardId)}`)
      .then(({ board }) => {
        if (active) setBoardState({ status: 'ready', title: board.title })
      })
      .catch((error) => {
        if (active) setBoardState({ status: 'error', message: error instanceof Error ? error.message : '画板加载失败' })
      })
    return () => { active = false }
  }, [boardId])

  if (boardState.status === 'loading') return <LoadingScreen />
  if (boardState.status === 'error') {
    return (
      <div className="board-load-error">
        <h1>无法打开画板</h1>
        <p>{boardState.message}</p>
        <button className="primary-button" onClick={() => navigate('/')}>返回画板列表</button>
      </div>
    )
  }

  return (
    <>
      <CollaborativeBoard
        user={user}
        roomId={boardId}
        canComment
        onShare={() => setShareOpen(true)}
      />
      <div className="board-navigation">
        <Link to="/" className="back-to-boards" aria-label="返回画板列表">‹</Link>
        <span title={boardState.title}>{boardState.title}</span>
      </div>
      {shareOpen && (
        <ShareDialog
          boardId={boardId}
          boardTitle={boardState.title}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  )
}
