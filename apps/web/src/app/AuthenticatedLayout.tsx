import type { DrawlyUser } from '@drawly/shared/auth'
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { DraggableAccountMenu } from '../features/account/DraggableAccountMenu'
import { ProfileDialog } from '../features/account/ProfileDialog'
import { apiRequest } from '../lib/api'

export interface AuthenticatedOutletContext {
  user: DrawlyUser
}

export function AuthenticatedLayout({
  user,
  onUserChange,
  onLogout,
}: {
  user: DrawlyUser
  onUserChange: (user: DrawlyUser) => void
  onLogout: () => void
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
      onLogout()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <main className="app-shell">
      <Outlet context={{ user } satisfies AuthenticatedOutletContext} />
      <DraggableAccountMenu
        user={user}
        onOpenProfile={() => setProfileOpen(true)}
        onLogout={handleLogout}
      />
      {profileOpen && (
        <ProfileDialog
          user={user}
          onClose={() => setProfileOpen(false)}
          onSaved={(nextUser) => {
            onUserChange(nextUser)
            setProfileOpen(false)
          }}
        />
      )}
    </main>
  )
}
