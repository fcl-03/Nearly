import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import Spinner from '../../components/ui/Spinner'

// Page de vérification d'email — centrée, design system Nearly
export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('pending') // pending | loading | success | error

  const token = params.get('token')

  // Ne pas auto-vérifier : les filtres anti-spam visitent les liens automatiquement
  // et consommeraient le token. On attend que l'utilisateur clique lui-même.

  async function handleConfirm() {
    if (!token) { setStatus('error'); return }
    setStatus('loading')
    try {
      await api.get(`/auth/verify-email?token=${token}`)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ marginBottom: 36 }}>
          <span
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 36,
              color: 'var(--accent)',
            }}
          >
            Nearly.
          </span>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 18,
            padding: '40px 28px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >

          {/* État : en attente de confirmation */}
          {status === 'pending' && (
            <>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(232,255,71,0.1)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
                📬
              </div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text)', margin: 0 }}>
                Confirmer ton email
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
                Clique sur le bouton ci-dessous pour valider ton adresse email.
              </p>
              <button
                onClick={handleConfirm}
                style={{ width: '100%', background: 'var(--accent)', color: 'var(--bg)', fontWeight: 700, fontSize: 15, padding: '13px 0', borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginTop: 4 }}
              >
                Confirmer mon email
              </button>
            </>
          )}

          {/* État : chargement */}
          {status === 'loading' && (
            <>
              <Spinner size="lg" />
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                Vérification en cours…
              </p>
            </>
          )}

          {/* État : succès */}
          {status === 'success' && (
            <>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'rgba(61,219,130,0.12)',
                  border: '2px solid var(--green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 36,
                }}
              >
                ✅
              </div>
              <h2
                style={{
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 800,
                  fontSize: 24,
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                Email vérifié !
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
                Ton adresse email a bien été confirmée. Tu peux maintenant te connecter.
              </p>
              <button
                onClick={() => navigate('/login')}
                style={{
                  width: '100%',
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  fontWeight: 700,
                  fontSize: 15,
                  padding: '13px 0',
                  borderRadius: 11,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  marginTop: 4,
                }}
              >
                Se connecter
              </button>
            </>
          )}

          {/* État : erreur */}
          {status === 'error' && (
            <>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'rgba(255,122,61,0.12)',
                  border: '2px solid var(--orange)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 36,
                }}
              >
                ❌
              </div>
              <h2
                style={{
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 800,
                  fontSize: 24,
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                Lien invalide
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
                Ce lien de vérification est invalide ou a expiré.
              </p>
              <button
                onClick={() => navigate('/login')}
                style={{
                  width: '100%',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  fontWeight: 600,
                  fontSize: 15,
                  padding: '13px 0',
                  borderRadius: 11,
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  marginTop: 4,
                }}
              >
                Retour à la connexion
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
