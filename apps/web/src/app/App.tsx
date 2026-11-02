import type { AuthResponse, DrawlyUser } from '@drawly/shared/auth'
import { useEffect, useState } from 'react'
import { LoadingScreen } from '../components/LoadingScreen'
import { AuthenticatedApp } from './AuthenticatedApp'
import { AuthScreen } from '../features/auth/AuthScreen'
import { apiRequest } from '../lib/api'

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: DrawlyUser }

export function App() {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    apiRequest<AuthResponse>('/api/auth/me')
      .then(({ user }) => {
        setAuthState(user ? { status: 'authenticated', user } : { status: 'anonymous' })
      })
      .catch(() => setAuthState({ status: 'anonymous' }))
  }, [])

  if (authState.status === 'loading') return <LoadingScreen />

  if (authState.status === 'anonymous') {
    return (
      <AuthScreen
        onAuthenticated={(user) => setAuthState({ status: 'authenticated', user })}
      />
    )
  }

  return (
    <AuthenticatedApp
      user={authState.user}
      onUserChange={(user) => setAuthState({ status: 'authenticated', user })}
      onLogout={() => setAuthState({ status: 'anonymous' })}
    />
  )
}
