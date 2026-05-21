import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import api from '../../services/api'

// Page de réinitialisation du mot de passe (via le lien reçu par email)
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reset-password', { token, new_password: password })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Lien invalide ou expiré. Redemande un nouveau lien.')
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

  // Pas de token dans l'URL
  if (!token) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🔗</span>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--text)', marginBottom: 12 }}>Lien invalide</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>Ce lien de réinitialisation n'est pas valide.</p>
          <Link to="/forgot-password" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>
            Redemander un lien
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 48, color: 'var(--accent)', display: 'block', lineHeight: 1 }}>
            Nearly.
          </span>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 18, padding: '28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

          {success ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <span style={{ fontSize: 48 }}>✅</span>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--text)', margin: 0 }}>
                Mot de passe modifié
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Tu peux maintenant te connecter avec ton nouveau mot de passe.
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
                Se connecter
              </Link>
            </div>
          ) : (
            <>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>
                Nouveau mot de passe
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 22, lineHeight: 1.5 }}>
                Choisis un nouveau mot de passe pour ton compte.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Nouveau mot de passe */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
                    Nouveau mot de passe
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      style={{ ...inputStyle, paddingRight: 44 }}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={e => e.target.style.borderColor = 'rgba(232,255,71,0.6)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                      autoFocus
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-tertiary)' }}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>8 caractères minimum</span>
                </div>

                {/* Confirmation */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
                    Confirmer le mot de passe
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    style={inputStyle}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    onFocus={e => e.target.style.borderColor = 'rgba(232,255,71,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                    required
                    minLength={8}
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
                  Changer mon mot de passe
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
