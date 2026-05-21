import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import api from '../../services/api'

// Page "Mot de passe oublié" — envoie un email de réinitialisation
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch {
      setError('Une erreur est survenue. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border-color)',
    borderRadius: 11,
    padding: '13px 16px',
    color: 'var(--text)',
    fontSize: 15,
    fontFamily: 'DM Sans, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
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
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 48, color: 'var(--accent)', display: 'block', lineHeight: 1 }}>
            Nearly.
          </span>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 18, padding: '28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

          {sent ? (
            // Confirmation
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <span style={{ fontSize: 48 }}>📬</span>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--text)', margin: 0 }}>
                Email envoyé
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Si un compte existe avec cette adresse, tu recevras un lien pour réinitialiser ton mot de passe. Vérifie aussi tes spams.
              </p>
              <Link
                to="/login"
                style={{
                  display: 'inline-block',
                  marginTop: 8,
                  padding: '12px 28px',
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  fontWeight: 700,
                  fontSize: 14,
                  borderRadius: 11,
                  textDecoration: 'none',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            // Formulaire
            <>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>
                Mot de passe oublié
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 22, lineHeight: 1.5 }}>
                Entre ton adresse email. Si un compte existe, tu recevras un lien pour réinitialiser ton mot de passe.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
                    Adresse email
                  </label>
                  <input
                    type="email"
                    style={inputStyle}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={e => e.target.style.borderColor = 'rgba(232,255,71,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                    autoFocus
                    required
                  />
                </div>

                {error && (
                  <div style={{ background: 'rgba(255,122,61,0.1)', border: '1px solid rgba(255,122,61,0.2)', borderRadius: 11, padding: '12px 16px', fontSize: 14, color: 'var(--orange)' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: 'var(--accent)',
                    color: 'var(--bg)',
                    fontWeight: 700,
                    fontSize: 15,
                    padding: '14px 0',
                    borderRadius: 11,
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  {loading && <span style={{ width: 16, height: 16, border: '2px solid color-mix(in srgb, var(--on-accent) 30%, transparent)', borderTop: '2px solid var(--on-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />}
                  Envoyer le lien
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/login" style={{ color: 'var(--text-tertiary)', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ArrowLeft size={14} /> Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}
