import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { INTERESTS } from '../../utils/categories'
import api from '../../services/api'
import CharterContent from '../legal/CharterContent'

// Page d'inscription en 3 étapes — inspirée du design system Nearly
export default function RegisterPage() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Étape 1 — compte
  const [form, setForm] = useState({ first_name: '', username: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [ageConsent, setAgeConsent] = useState(false)

  // Étape 2 — avatar
  const [avatar, setAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const avatarRef = useRef()

  // Étape 3 — intérêts
  const [allInterests, setAllInterests] = useState([])
  const [selected, setSelected] = useState([])

  async function handleStep1(e) {
    e.preventDefault()
    const errs = {}
    if (!form.first_name.trim()) errs.first_name = 'Requis.'
    const cleanUsername = form.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!cleanUsername) errs.username = 'Requis.'
    else if (cleanUsername.length < 3 || cleanUsername.length > 30) errs.username = 'Entre 3 et 30 caractères.'
    else if (cleanUsername !== form.username.trim()) errs.username = 'Lettres minuscules, chiffres et _ uniquement.'
    if (!form.email) errs.email = 'Requis.'
    if (form.password.length < 8) errs.password = 'Au moins 8 caractères.'
    if (!ageConsent) errs._age = 'Tu dois déclarer avoir au moins 18 ans pour continuer.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      await api.post('/auth/register', { first_name: form.first_name, email: form.email, password: form.password, is_adult: true, accepts_terms: true })
      await api.post('/auth/login', { email: form.email, password: form.password })
      setTokens()
      // Enregistrer le pseudo
      await api.put('/users/me', { username: form.username.trim() })
      const me = await api.get('/users/me')
      setUser(me.data)
      setStep(2) // → charte
    } catch (err) {
      const s = err.response?.status
      if (s === 409) setErrors({ email: 'Cet email est déjà utilisé.' })
      else setErrors({ _global: 'Une erreur est survenue.' })
    } finally { setLoading(false) }
  }

  // Étape 2 — acceptation de la charte
  async function handleStep2() {
    setLoading(true)
    try {
      await api.put('/users/me', { data_consent: true })
      localStorage.setItem('charter_accepted_once', '1')
      const me = await api.get('/users/me')
      setUser(me.data)
    } catch {}
    setLoading(false)
    setStep(3) // → avatar
  }

  function handleAvatarPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatar(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  // Étape 3 — avatar
  async function handleStep3() {
    setLoading(true)
    try {
      if (avatar) {
        const fd = new FormData()
        fd.append('avatar', avatar)
        await api.post('/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      const { data } = await api.get('/users/interests')
      setAllInterests(data)
    } catch {}
    setLoading(false)
    setStep(4) // → intérêts
  }

  function toggleInterest(id) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : prev.length < 10
        ? [...prev, id]
        : prev
    )
  }

  // Étape 4 — intérêts
  async function handleStep4() {
    setLoading(true)
    try {
      if (selected.length > 0) await api.put('/users/me/interests', { interest_ids: selected })
    } catch {}
    setLoading(false)
    navigate('/events')
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg)',
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
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px 20px 40px',
        overflowY: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 38,
              color: 'var(--accent)',
              display: 'block',
              lineHeight: 1,
            }}
          >
            Nearly.
          </span>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 }}>
            De vraies sorties avec de vraies personnes.
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 18,
            padding: '24px 22px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}
        >
          {/* Barre de progression */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                style={{
                  height: 4,
                  flex: 1,
                  borderRadius: 999,
                  background: i <= step ? 'var(--accent)' : 'var(--border-color)',
                  transition: 'background 0.4s ease',
                }}
              />
            ))}
          </div>

          {/* ── ÉTAPE 1 : compte ── */}
          {step === 1 && (
            <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <p style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                  Étape 1 sur 4
                </p>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text)', margin: 0 }}>
                  Ton compte
                </h2>
              </div>

              <FormField
                label="Prénom"
                value={form.first_name}
                onChange={v => setForm(f => ({ ...f, first_name: v }))}
                autoFocus
                error={errors.first_name}
                inputStyle={inputStyle}
              />
              <FormField
                label="Pseudo"
                value={form.username}
                onChange={v => setForm(f => ({ ...f, username: v }))}
                error={errors.username}
                inputStyle={inputStyle}
              />
              <FormField
                label="Email"
                type="email"
                value={form.email}
                onChange={v => setForm(f => ({ ...f, email: v }))}
                error={errors.email}
                inputStyle={inputStyle}
              />
              <FormField
                label="Mot de passe"
                type="password"
                value={form.password}
                onChange={v => setForm(f => ({ ...f, password: v }))}
                hint="8 caractères minimum"
                error={errors.password}
                inputStyle={inputStyle}
              />

              {/* Déclaration de majorité + CGU */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  cursor: 'pointer',
                  padding: '12px 14px',
                  background: ageConsent ? 'rgba(232,255,71,0.06)' : errors._age ? 'rgba(255,122,61,0.06)' : 'var(--bg)',
                  border: `1px solid ${ageConsent ? 'rgba(232,255,71,0.3)' : errors._age ? 'rgba(255,122,61,0.4)' : 'var(--border-color)'}`,
                  borderRadius: 11,
                  transition: 'all 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={ageConsent}
                  onChange={e => { setAgeConsent(e.target.checked); setErrors(prev => ({ ...prev, _age: undefined })) }}
                  style={{ marginTop: 2, accentColor: 'var(--accent)', width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Je déclare avoir au moins <strong style={{ color: 'var(--text)' }}>18 ans</strong>.
                </span>
              </label>
              {errors._age && (
                <span style={{ fontSize: 12, color: 'var(--orange)', marginTop: -8 }}>{errors._age}</span>
              )}

              {/* Notice email différé */}
              <div
                style={{
                  background: 'rgba(232,255,71,0.06)',
                  border: '1px solid rgba(232,255,71,0.15)',
                  borderRadius: 11,
                  padding: '12px 14px',
                  display: 'flex',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>📬</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', margin: 0 }}>
                    Vérification différée
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>
                    Tu as <strong style={{ color: 'var(--text)' }}>3 jours</strong> pour confirmer ton email.
                  </p>
                </div>
              </div>

              {errors._global && (
                <p style={{ fontSize: 13, color: 'var(--orange)' }}>{errors._global}</p>
              )}

              <AccentBtn loading={loading}>Continuer →</AccentBtn>

              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                Déjà un compte ?{' '}
                <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                  Se connecter
                </Link>
              </p>
            </form>
          )}

          {/* ── ÉTAPE 2 : charte de confidentialité ── */}
          {step === 2 && (
            <Step2Charter loading={loading} onAccept={handleStep2} />
          )}

          {/* ── ÉTAPE 3 : photo de profil ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <div style={{ width: '100%' }}>
                <p style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                  Étape 3 sur 4
                </p>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text)', margin: 0 }}>
                  Ta photo de profil
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                  Les autres membres doivent pouvoir te reconnaître
                </p>
              </div>

              {/* Zone avatar */}
              <button
                onClick={() => avatarRef.current.click()}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: 'var(--bg)',
                  border: `2px dashed ${avatarPreview ? 'var(--accent)' : 'var(--border-color)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <>
                    <span style={{ fontSize: 36 }}>📷</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Ajouter</span>
                  </>
                )}
              </button>
              <input
                ref={avatarRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleAvatarPick}
              />

              <div style={{ width: '100%' }}>
                <AccentBtn loading={loading} disabled={!avatar} onClick={handleStep3}>
                  Continuer →
                </AccentBtn>
                {!avatar && (
                  <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                    Choisis une photo pour continuer
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── ÉTAPE 4 : centres d'intérêt ── */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <p style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                  Étape 4 sur 4
                </p>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text)', margin: 0 }}>
                  Tes centres d'intérêt
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                  3 minimum · max 10
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                }}
              >
                {(allInterests.length > 0 ? allInterests : INTERESTS).map(interest => {
                  const id = interest.id ?? interest.label
                  const isSelected = selected.includes(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleInterest(id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        borderRadius: 14,
                        padding: '10px 4px',
                        aspectRatio: '1',
                        background: isSelected ? 'rgba(232,255,71,0.1)' : 'var(--bg)',
                        border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{interest.emoji}</span>
                      <span
                        style={{
                          fontSize: 10,
                          color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                          fontFamily: 'Syne, sans-serif',
                          fontWeight: isSelected ? 700 : 400,
                          textAlign: 'center',
                          lineHeight: 1.2,
                        }}
                      >
                        {interest.label ?? interest.name}
                      </span>
                    </button>
                  )
                })}
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, color: 'var(--accent)', fontSize: 18 }}>
                  {selected.length}
                </span>{' '}
                sélectionné{selected.length > 1 ? 's' : ''}
              </p>

              <AccentBtn
                loading={loading}
                disabled={selected.length < 3}
                onClick={handleStep4}
              >
                Voir les sorties près de moi →
              </AccentBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Étape 2 — charte complète (scroll jusqu'en bas obligatoire avant acceptation)
function Step2Charter({ loading, onAccept }) {
  const [reachedBottom, setReachedBottom] = useState(false)
  const scrollRef = useRef()

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onScroll() {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) setReachedBottom(true)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <p style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 4 }}>
          Étape 2 sur 4
        </p>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text)', margin: 0 }}>
          Charte, CGU & Confidentialité
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
          Lis l'intégralité ci-dessous. En acceptant, tu acceptes aussi les <a href="/terms" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Conditions Générales d'Utilisation</a>.
        </p>
      </div>

      {/* Zone scrollable contenant le texte complet */}
      <div
        ref={scrollRef}
        style={{
          maxHeight: '50vh',
          overflowY: 'auto',
          background: 'var(--bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: '16px 14px',
        }}
      >
        <CharterContent />
      </div>

      {!reachedBottom && (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
          ↓ Fais défiler jusqu'en bas pour activer le bouton
        </p>
      )}

      <AccentBtn loading={loading} disabled={!reachedBottom} onClick={onAccept}>
        {reachedBottom ? 'J\'accepte la charte et les CGU →' : 'Continue de lire…'}
      </AccentBtn>
    </div>
  )
}

// Champ de formulaire d'inscription
function FormField({ label, hint, error, onChange, inputStyle, showToggle, ...props }) {
  const [visible, setVisible] = useState(false)
  const isPassword = props.type === 'password' || showToggle
  const resolvedType = isPassword ? (visible ? 'text' : 'password') : props.type
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label
        style={{
          fontSize: 10,
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-tertiary)',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          style={{
            ...inputStyle,
            border: `1px solid ${error ? 'rgba(255,122,61,0.6)' : 'var(--border-color)'}`,
            paddingRight: isPassword ? 44 : undefined,
          }}
          onFocus={e => e.target.style.borderColor = error ? 'rgba(255,122,61,0.8)' : 'rgba(232,255,71,0.6)'}
          onBlur={e => e.target.style.borderColor = error ? 'rgba(255,122,61,0.6)' : 'var(--border-color)'}
          onChange={e => onChange(e.target.value)}
          {...props}
          type={resolvedType}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-tertiary)' }}
            tabIndex={-1}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <span style={{ fontSize: 12, color: 'var(--orange)' }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{hint}</span>}
    </div>
  )
}

// Bouton principal accent
function AccentBtn({ children, loading, disabled, onClick, ...props }) {
  const isDisabled = loading || disabled
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={{
        width: '100%',
        background: 'var(--accent)',
        color: 'var(--bg)',
        fontWeight: 700,
        fontSize: 15,
        padding: '14px 0',
        borderRadius: 11,
        border: 'none',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.45 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: 'DM Sans, sans-serif',
        transition: 'opacity 0.15s',
      }}
      {...props}
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
      {children}
    </button>
  )
}
