import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import api from '../../services/api'

// Page de confirmation après paiement Stripe réussi
export default function PremiumSuccessPage() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()

  // Vérifier la session Stripe puis rafraîchir le profil
  useEffect(() => {
    async function activate() {
      const params = new URLSearchParams(window.location.search)
      const sessionId = params.get('session_id')
      if (sessionId) {
        try {
          await api.post('/payments/verify-session', { session_id: sessionId })
        } catch {}
      }
      const { data } = await api.get('/users/me')
      setUser(data)
    }
    activate()
    const t = setTimeout(() => navigate('/profile', { replace: true }), 3500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', gap: 20, textAlign: 'center' }}>
      <div style={{ fontSize: 64 }}>⚡</div>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 28, color: 'var(--accent)', margin: 0 }}>
        Bienvenue dans Nearly Premium !
      </h1>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 320 }}>
        Ton abonnement est actif. Profite de toutes les fonctionnalités sans limites.
      </p>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-tertiary)' }}>
        Redirection dans quelques secondes…
      </p>
    </div>
  )
}
