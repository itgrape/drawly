import type { SharedBoardAccessResponse } from '@drawly/shared/share'
import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type { AuthenticatedOutletContext } from '../../app/AuthenticatedLayout'
import { LoadingScreen } from '../../components/LoadingScreen'
import { apiRequest } from '../../lib/api'
import { CollaborativeBoard } from '../board/CollaborativeBoard'

type AccessState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; boardId: string; title: string; permission: 'view' | 'edit'; ownerName: string }

export function SharedBoardWorkspace() {
  const { token = '' } = useParams()
  const { user } = useOutletContext<AuthenticatedOutletContext>()
  const [state, setState] = useState<AccessState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    apiRequest<SharedBoardAccessResponse>(`/api/shares/${encodeURIComponent(token)}`)
      .then(({ access }) => {
        if (active) setState({ status: 'ready', ...access })
      })
      .catch((error) => {
        if (active) setState({ status: 'error', message: error instanceof Error ? error.message : '分享链接加载失败' })
      })
    return () => { active = false }
  }, [token])

  if (state.status === 'loading') return <LoadingScreen />
  if (state.status === 'error') {
    return (
      <div className="board-load-error">
        <h1>无法打开分享画板</h1>
        <p>{state.message}</p>
        <Link className="primary-button link-button" to="/">返回画板列表</Link>
      </div>
    )
  }

  return (
    <>
      <CollaborativeBoard user={user} roomId={state.boardId} shareToken={token} />
      <div className="board-navigation shared-board-navigation">
        <Link to="/" className="back-to-boards" aria-label="返回画板列表">‹</Link>
        <span title={state.title}>{state.title}</span>
        <span className={`share-access-badge share-access-${state.permission}`}>
          {state.permission === 'view' ? '只读' : '可编辑'}
        </span>
      </div>
      <div className="shared-owner-badge">由 {state.ownerName} 分享</div>
    </>
  )
}
