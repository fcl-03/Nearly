import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import api from '../../services/api'
import CharterContent from './CharterContent'

// Page Charte & Politique de confidentialité — RGPD complet
export default function CharterPage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  const [reachedBottom, setReachedBottom] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(user?.data_consent ?? false)

  // Détection scroll sur le window (la page entière scrolle)
  useEffect(() => {
    function onScroll() {
      const scrolled = window.scrollY + window.innerHeight
      const total = document.documentElement.scrollHeight
      if (total - scrolled < 80) setReachedBottom(true)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function handleAccept() {
    setAccepting(true)
    try {
      const { data } = await api.put('/users/me', { data_consent: true })
      setUser(data)
      localStorage.setItem('charter_accepted_once', '1')
      setAccepted(true)
      setTimeout(() => navigate('/events', { replace: true }), 800)
    } catch {
      setAccepting(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', overflowY: 'auto' }}>

      {/* En-tête */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', borderBottom: '1px solid var(--border-color)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {accepted && (
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text)' }}
            aria-label="Retour"
          >
            <ArrowLeft size={22} color="var(--text)" />
          </button>
        )}
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--text)', margin: 0 }}>
          Charte & Confidentialité
        </h1>
      </div>

      {/* Contenu complet */}
      <div style={{ padding: '20px 20px 60px' }}>
        <CharterContent />

        {/* Bouton d'acceptation — débloqué après avoir scrollé jusqu'en bas */}
        {!accepted && (
          <div style={{ marginTop: 32, marginBottom: 12 }}>
            <button
              onClick={handleAccept}
              disabled={accepting}
              style={{
                width: '100%',
                background: reachedBottom ? 'var(--accent)' : 'var(--surface2)',
                border: reachedBottom ? 'none' : '1px solid var(--border-color)',
                borderRadius: 11,
                padding: '15px 0',
                color: reachedBottom ? 'var(--on-accent)' : 'var(--text-tertiary)',
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                cursor: reachedBottom && !accepting ? 'pointer' : 'not-allowed',
                transition: 'background 0.3s, color 0.3s',
              }}
            >
              {accepting ? 'Enregistrement…' : reachedBottom ? 'J\'accepte la charte ✓' : '↓ Lis jusqu\'en bas pour accepter'}
            </button>
            {!reachedBottom && (
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>
                Fais défiler jusqu'en bas pour débloquer l'acceptation
              </p>
            )}
          </div>
        )}

        {accepted && (
          <div style={{ marginTop: 32, marginBottom: 12, textAlign: 'center' }}>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: 'var(--green)', fontWeight: 700 }}>
              ✓ Charte acceptée
            </p>
          </div>
        )}
      </div>

      {/* Bandeau fixe en bas — rappel de scroll */}
      {!reachedBottom && !accepted && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 800,
          zIndex: 50,
          background: 'linear-gradient(to top, var(--bg) 60%, transparent)',
          padding: '32px 20px 20px',
          pointerEvents: 'none',
          textAlign: 'center',
        }}>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-tertiary)' }}>
            ↓ Continue de lire pour accepter
          </span>
        </div>
      )}
    </div>
  )
}
