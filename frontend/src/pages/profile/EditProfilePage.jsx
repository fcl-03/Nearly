import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import api from '../../services/api'
import Spinner from '../../components/ui/Spinner'

// Page dédiée à la modification du profil
export default function EditProfilePage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()

  const [form, setForm] = useState({ first_name: '', username: '', email: '', bio: '', city: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const avatarRef = useRef()

  // Synchroniser le formulaire avec le profil
  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '',
        username: user.username || '',
        email: user.email || '',
        bio: user.bio || '',
        city: user.city || '',
      })
    }
  }, [user?.id])

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    // Validation frontend
    if (form.username && (form.username.length < 3 || form.username.length > 30)) {
      setSaveError('Le nom d\'utilisateur doit faire entre 3 et 30 caractères.')
      setSaving(false)
      return
    }
    try {
      const { data } = await api.put('/users/me', form)
      setUser(data)
      navigate(-1)
    } catch (err) {
      const s = err.response?.status
      const detail = err.response?.data?.detail
      if (s === 409) setSaveError('Cet email ou nom d\'utilisateur est déjà utilisé.')
      else if (s === 422 && Array.isArray(detail)) {
        // Erreurs de validation Pydantic — afficher un message lisible
        const messages = detail.map(e => {
          const field = e.loc?.slice(-1)[0]
          if (field === 'username') return 'Nom d\'utilisateur : 3 à 30 caractères, lettres minuscules, chiffres et _'
          return `${field} : ${e.msg}`
        })
        setSaveError(messages.join('. '))
      }
      else setSaveError(typeof detail === 'string' ? detail : 'Une erreur est survenue.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarLoading(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      await api.post('/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const me = await api.get('/users/me')
      setUser(me.data)
    } catch {}
    finally { setAvatarLoading(false) }
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}>
        <Spinner />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', overflowY: 'auto' }}>

      {/* ── En-tête ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border-color)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text)' }}
          aria-label="Retour"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--text)', margin: 0, flex: 1 }}>
          Modifier le profil
        </h1>
        {/* Bouton Enregistrer rapide dans le header */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 9,
            padding: '7px 16px',
            color: 'var(--bg)',
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 700,
            fontSize: 13,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      <div style={{ padding: '28px 20px 80px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Avatar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => avatarRef.current.click()}
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            aria-label="Changer l'avatar"
          >
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: '50%',
                border: '3px solid var(--accent)',
                overflow: 'hidden',
                background: 'var(--surface2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                fontWeight: 700,
                color: 'var(--accent)',
                fontFamily: 'Syne, sans-serif',
              }}
            >
              {avatarLoading ? (
                <Spinner size="sm" />
              ) : user.avatar_url ? (
                <img src={user.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                user.first_name?.[0]?.toUpperCase()
              )}
            </div>
            {/* Icône caméra */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--bg)',
              }}
            >
              <Camera size={14} color="var(--bg)" />
            </div>
          </button>
          <input
            ref={avatarRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
            Appuie pour changer ta photo
          </p>
          {user.avatar_url && (
            <button
              onClick={async () => {
                setAvatarLoading(true)
                try {
                  await api.delete('/users/me/avatar')
                  const me = await api.get('/users/me')
                  setUser(me.data)
                } catch {}
                finally { setAvatarLoading(false) }
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--orange)',
                fontFamily: 'DM Sans, sans-serif',
                padding: '4px 0',
              }}
            >
              Supprimer la photo
            </button>
          )}
        </div>

        {/* ── Formulaire ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <EditField
            label="Prénom"
            value={form.first_name}
            onChange={v => setForm(f => ({ ...f, first_name: v }))}
          />

          <EditField
            label="Nom d'utilisateur"
            value={form.username}
            onChange={v => setForm(f => ({ ...f, username: v.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
            prefix="@"
            hint="3-30 caractères · lettres minuscules, chiffres, _"
          />

          <EditField
            label="Email"
            type="email"
            value={form.email}
            onChange={v => setForm(f => ({ ...f, email: v }))}
            hint="Un email de vérification sera envoyé si tu changes d'adresse"
          />

          <EditField
            label="Bio"
            value={form.bio}
            onChange={v => setForm(f => ({ ...f, bio: v }))}
            multiline
            maxLength={500}
          />

          <EditField
            label="Ville"
            value={form.city}
            onChange={v => setForm(f => ({ ...f, city: v }))}
          />

        </div>

        {/* ── Erreur ── */}
        {saveError && (
          <p style={{ fontSize: 13, color: 'var(--orange)', textAlign: 'center', fontFamily: 'DM Sans, sans-serif' }}>
            {saveError}
          </p>
        )}

        {/* ── Bouton Enregistrer principal ── */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            background: 'var(--accent)',
            color: 'var(--bg)',
            fontWeight: 700,
            fontSize: 15,
            padding: '14px 0',
            borderRadius: 11,
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
            fontFamily: 'DM Sans, sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {saving && (
            <span style={{
              width: 16, height: 16,
              border: '2px solid color-mix(in srgb, var(--on-accent) 30%, transparent)',
              borderTop: '2px solid var(--on-accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              display: 'inline-block',
            }} />
          )}
          Enregistrer les modifications
        </button>

      </div>
    </div>
  )
}

// Champ d'édition réutilisable
function EditField({ label, value, onChange, multiline, maxLength, placeholder, type = 'text', hint, prefix }) {
  const inputStyle = {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border-color)',
    borderRadius: 11,
    padding: prefix ? '13px 16px 13px 30px' : '13px 16px',
    color: 'var(--text)',
    fontSize: 15,
    fontFamily: 'DM Sans, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        {prefix && (
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: 15, pointerEvents: 'none' }}>
            {prefix}
          </span>
        )}
        {multiline ? (
          <textarea
            style={{ ...inputStyle, resize: 'none' }}
            rows={3}
            value={value}
            onChange={e => onChange(e.target.value)}
            maxLength={maxLength}
            placeholder={placeholder}
            onFocus={e => e.target.style.borderColor = 'rgba(232,255,71,0.6)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
          />
        ) : (
          <input
            style={inputStyle}
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            onFocus={e => e.target.style.borderColor = 'rgba(232,255,71,0.6)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
          />
        )}
      </div>
      {hint && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{hint}</span>}
    </div>
  )
}
