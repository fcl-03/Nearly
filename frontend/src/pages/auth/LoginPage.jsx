import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Sun, Moon } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore } from '../../stores/themeStore'
import api from '../../services/api'

// Page de connexion — inspirée du design system Nearly
export default function LoginPage() {
  const navigate = useNavigate()
  const { setTokens } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [bannedInfo, setBannedInfo] = useState(null) // { message, contact_email, help }
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBannedInfo(null)
    setLoading(true)
    try {
      await api.post('/auth/login', form)
      setTokens()
      navigate('/events')
    } catch (err) {
      const s = err.response?.status
      const detail = err.response?.data?.detail
      // Compte suspendu : message dédié avec contact pour recours
      if (s === 403 && typeof detail === 'object' && detail?.code === 'account_suspended') {
        setBannedInfo(detail)
      } else if (s === 401 || s === 403) {
        setError('Email ou mot de passe incorrect.')
      } else {
        setError('Une erreur est survenue, réessaie.')
      }
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
      {/* Toggle thème */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'var(--surface2)',
          border: '1px solid var(--border-color)',
          borderRadius: '50%',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
        }}
        aria-label="Changer le thème"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <span
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 48,
              color: 'var(--accent)',
              display: 'block',
              lineHeight: 1,
            }}
          >
            Nearly.
          </span>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>
            De vraies sorties avec de vraies personnes.
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 18,
            padding: '28px 24px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}
        >
          <h2
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 20,
              color: 'var(--text)',
              marginBottom: 22,
            }}
          >
            Connexion
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
                Adresse email
              </label>
              <input
                type="email"
                style={inputStyle}
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                onFocus={e => e.target.style.borderColor = 'rgba(232,255,71,0.6)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                autoFocus
                required
              />
            </div>

            {/* Mot de passe */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  style={{ ...inputStyle, paddingRight: 44 }}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  onFocus={e => e.target.style.borderColor = 'rgba(232,255,71,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                  required
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
            </div>

            {/* Message d'erreur */}
            {error && (
              <div
                style={{
                  background: 'rgba(255,122,61,0.1)',
                  border: '1px solid rgba(255,122,61,0.2)',
                  borderRadius: 11,
                  padding: '12px 16px',
                  fontSize: 14,
                  color: 'var(--orange)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                ⚠ {error}
              </div>
            )}

            {/* Compte suspendu : message dédié avec recours */}
            {bannedInfo && (
              <div
                style={{
                  background: 'rgba(255,80,80,0.08)',
                  border: '1px solid rgba(255,80,80,0.3)',
                  borderRadius: 14,
                  padding: '16px 18px',
                  fontSize: 14,
                  color: 'var(--text)',
                  fontFamily: 'DM Sans, sans-serif',
                  lineHeight: 1.5,
                }}
              >
                <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, margin: '0 0 8px', color: '#FF6B6B' }}>
                  🚫 Compte suspendu
                </p>
                <p style={{ margin: '0 0 8px' }}>{bannedInfo.message}</p>
                {bannedInfo.help && (
                  <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)' }}>{bannedInfo.help}</p>
                )}
                {bannedInfo.contact_email && (
                  <a
                    href={`mailto:${bannedInfo.contact_email}?subject=Demande de réexamen de mon compte&body=Bonjour,%0D%0A%0D%0AMon compte (${form.email}) a été suspendu et je souhaite contester cette décision.%0D%0A%0D%0AMerci de réexaminer mon dossier.%0D%0A`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      color: 'var(--accent-text, var(--accent))', textDecoration: 'underline', fontWeight: 600,
                    }}
                  >
                    Contacter le support : {bannedInfo.contact_email}
                  </a>
                )}
              </div>
            )}

            {/* Bouton connexion */}
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
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontFamily: 'DM Sans, sans-serif',
                transition: 'opacity 0.15s',
              }}
            >
              {loading && (
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: '2px solid color-mix(in srgb, var(--on-accent) 30%, transparent)',
                    borderTop: '2px solid var(--on-accent)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    display: 'inline-block',
                  }}
                />
              )}
              Se connecter
            </button>
          </form>
        </div>

        {/* Mot de passe oublié */}
        <p style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/forgot-password" style={{ color: 'var(--text-tertiary)', fontSize: 13, textDecoration: 'none' }}>
            Mot de passe oublié ?
          </Link>
        </p>

        {/* Lien inscription */}
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>
          Pas encore de compte ?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            Créer mon compte
          </Link>
        </p>
      </div>
    </div>
  )
}
