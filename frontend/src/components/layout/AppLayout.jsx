import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import api from '../../services/api'
import BottomNav from './BottomNav'
import Spinner from '../ui/Spinner'

// Layout principal — mobile first, pas de sidebar, BottomNav fixe
export default function AppLayout() {
  const { accessToken, user, setUser } = useAuthStore()
  const { pathname } = useLocation()
  const [userLoaded, setUserLoaded] = useState(false)

  // Charger le profil utilisateur au montage si connecté
  useEffect(() => {
    if (accessToken) {
      api.get('/users/me')
        .then(r => { setUser(r.data); setUserLoaded(true) })
        .catch(() => setUserLoaded(true))
    } else {
      setUserLoaded(true)
    }
  }, [accessToken])

  // Rediriger vers login si non authentifié
  if (!accessToken) return <Navigate to="/login" replace />

  // Attendre que le profil soit chargé avant de décider quoi que ce soit
  if (!userLoaded) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh', background: 'var(--bg)' }}>
        <Spinner />
      </div>
    )
  }

  // Charte obligatoire — jamais pour les admins, jamais si déjà acceptée une fois
  const hasAcceptedOnce = !!localStorage.getItem('charter_accepted_once')
  const mustAcceptCharter = (
    user &&
    !user.data_consent &&
    !hasAcceptedOnce &&
    !user.is_admin &&
    pathname !== '/charter'
  )

  if (mustAcceptCharter) return <Navigate to="/charter" replace />

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Skip-to-content pour accessibilité clavier */}
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          top: -50,
          left: 0,
          background: 'var(--accent)',
          color: 'var(--bg)',
          padding: '8px 16px',
          zIndex: 100,
          fontWeight: 700,
          borderRadius: '0 0 8px 0',
        }}
        onFocus={e => { e.target.style.top = '0' }}
        onBlur={e => { e.target.style.top = '-50px' }}
      >
        Aller au contenu
      </a>

      {/* Conteneur centré — s'élargit sur tablette/desktop */}
      <main
        id="main-content"
        className="nearly-main"
        style={{
          width: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 80,
          minHeight: '100dvh',
        }}
      >
        <Outlet />
      </main>

      {/* Navigation fixe en bas */}
      <BottomNav />
    </div>
  )
}
