import type { DrawlyUser } from '@drawly/shared/auth'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BoardDashboard } from '../features/boards/BoardDashboard'
import { BoardWorkspace } from '../features/boards/BoardWorkspace'
import { SharedBoardWorkspace } from '../features/shares/SharedBoardWorkspace'
import { AuthenticatedLayout } from './AuthenticatedLayout'

export function AuthenticatedApp({
  user,
  onUserChange,
  onLogout,
}: {
  user: DrawlyUser
  onUserChange: (user: DrawlyUser) => void
  onLogout: () => void
}) {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <AuthenticatedLayout
              user={user}
              onUserChange={onUserChange}
              onLogout={onLogout}
            />
          }
        >
          <Route index element={<BoardDashboard />} />
          <Route path="boards/:boardId" element={<BoardWorkspace />} />
          <Route path="share/:token" element={<SharedBoardWorkspace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
