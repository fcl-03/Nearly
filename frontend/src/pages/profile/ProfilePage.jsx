import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Plus, Trash2, Heart, X, ChevronLeft, ChevronRight, Pencil, Check, Settings } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import api from '../../services/api'
import { getCat } from '../../utils/categories'
import Spinner from '../../components/ui/Spinner'
import PhotoUploadModal from '../../components/ui/PhotoUploadModal'

// Page de profil — Figma: Profile
export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [joinedEvents, setJoinedEvents] = useState([])
  const [joinedEventsCount, setJoinedEventsCount] = useState(0)
  const [resendStatus, setResendStatus] = useState(null) // null | 'sending' | 'sent' | 'error'
  const [photos, setPhotos] = useState([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [badges, setBadges] = useState([])
  const [allBadges, setAllBadges] = useState([])
  const [achievements, setAchievements] = useState([])
  const [viewerIndex, setViewerIndex] = useState(null)
  const [verifStatus, setVerifStatus] = useState(null) // null | 'pending' | 'rejected' | 'approved'
  const avatarRef = useRef()

  async function handleResendVerification() {
    setResendStatus('sending')
    try {
      await api.post('/auth/resend-verification')
      setResendStatus('sent')
    } catch {
      setResendStatus('error')
    }
  }

  // Charger les sorties rejointes, les photos, badges et statut de vérification
  useEffect(() => {
    api.get('/events').then(r => {
      const joined = r.data.filter(e => e.is_joined)
      setJoinedEventsCount(joined.length)
      setJoinedEvents(joined.slice(0, 3))
    }).catch(() => {})
    api.get('/badges').then(({ data }) => setAllBadges(data)).catch(() => {})
    api.get('/verification/status').then(({ data }) => setVerifStatus(data.status)).catch(() => {})

  }, [])

  useEffect(() => {
    if (!user?.id) return
    api.get(`/users/${user.id}/photos`).then(({ data }) => setPhotos(data)).catch(() => {})
    api.get(`/users/${user.id}/badges`).then(({ data }) => setBadges(data)).catch(() => {})
    api.get(`/users/${user.id}/achievements`).then(({ data }) => setAchievements(data)).catch(() => {})
  }, [user?.id])

  async function handlePhotoDelete(photoId) {
    if (!window.confirm('Supprimer cette photo ?')) return
    try {
      await api.delete(`/users/me/photos/${photoId}`)
      setPhotos(prev => prev.filter(p => p.id !== photoId))
    } catch {}
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

  const interests = user.interests ?? []

  return (
    <div style={{ minHeight: '100%', overflowY: 'auto' }}>

      {/* ── Section avatar + nom + stats ── */}
      <div
        style={{
          padding: '36px 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          position: 'relative',
        }}
      >
        {/* Bouton paramètres en haut à droite */}
        <button
          onClick={() => navigate('/settings')}
          aria-label="Paramètres"
          style={{
            position: 'absolute',
            top: 14,
            right: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            borderRadius: 999,
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface2)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'none' }}
        >
          <Settings size={20} />
        </button>

        {/* Avatar centré */}
        <button
          onClick={() => avatarRef.current.click()}
          style={{
            position: 'relative',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          aria-label="Modifier l'avatar"
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              border: '4px solid var(--accent)',
              overflow: 'hidden',
              background: 'var(--surface2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
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
          {/* Bouton "+" pour modifier */}
          <div
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 900,
              color: 'var(--bg)',
            }}
          >
            +
          </div>
        </button>
        <input
          ref={avatarRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleAvatarChange}
        />

        {/* Nom centré + badge Vérifié */}
        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 22,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            {user.first_name}
          </h1>
          {user.username && (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '2px 0 0', fontFamily: 'DM Sans, sans-serif' }}>
              @{user.username}
            </p>
          )}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: user.is_verified || user.is_premium ? 6 : 0 }}>
            {user.is_verified && (
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--green)',
                  border: '1px solid var(--green)',
                  borderRadius: 999,
                  padding: '3px 10px',
                }}
              >
                Vérifié ✓
              </span>
            )}
            {user.is_premium && (
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  borderRadius: 999,
                  padding: '3px 10px',
                }}
              >
                Premium ⭐
              </span>
            )}
          </div>
          {user.city && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>📍 {user.city}</p>
          )}
          {user.bio && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
              {user.bio}
            </p>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <span
              style={{
                display: 'block',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 800,
                fontSize: 28,
                color: 'var(--accent)',
              }}
            >
              {joinedEventsCount}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>sorties</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span
              style={{
                display: 'block',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 800,
                fontSize: 28,
                color: 'var(--accent)',
              }}
            >
              {badges.reduce((sum, b) => sum + (b.count || 0), 0)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>badges</span>
          </div>
        </div>

      </div>

      {/* ── Bannière email non vérifié ── */}
      {!user.is_email_verified && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{
            background: 'rgba(255,122,61,0.08)',
            border: '1px solid rgba(255,122,61,0.3)',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>📬</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--orange)', margin: 0 }}>
                  Email non vérifié
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>
                  Vérifie ta boîte mail et clique sur le lien envoyé lors de ton inscription.
                </p>
              </div>
            </div>
            <button
              onClick={handleResendVerification}
              disabled={resendStatus === 'sending' || resendStatus === 'sent'}
              style={{
                background: resendStatus === 'sent' ? 'rgba(61,219,130,0.15)' : 'rgba(255,122,61,0.15)',
                border: `1px solid ${resendStatus === 'sent' ? 'var(--green)' : 'rgba(255,122,61,0.4)'}`,
                color: resendStatus === 'sent' ? 'var(--green)' : 'var(--orange)',
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: resendStatus === 'sent' ? 'default' : 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                alignSelf: 'flex-start',
                opacity: resendStatus === 'sending' ? 0.6 : 1,
              }}
            >
              {resendStatus === 'sent' ? '✓ Email envoyé !' : resendStatus === 'sending' ? 'Envoi…' : 'Renvoyer l\'email de vérification'}
            </button>
          </div>
        </div>
      )}

      {/* ── Lien admin (visible uniquement pour les admins) ── */}
      {user.is_admin && (
        <div style={{ padding: '0 20px 16px' }}>
          <button
            onClick={() => navigate('/admin')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(232,255,71,0.06)', border: '1px solid rgba(232,255,71,0.2)',
              borderRadius: 14, padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <Shield size={18} color="var(--accent)" />
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>Dashboard Admin</p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>Gérer les utilisateurs et vérifications</p>
            </div>
            <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 18 }}>›</span>
          </button>
        </div>
      )}

      {/* ── Intérêts ── */}
      {interests.length > 0 && (
        <div style={{ padding: '0 20px 24px' }}>
          <SectionLabel>Centres d'intérêt</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {interests.map(i => {
              const cat = getCat(i.name?.toLowerCase())
              return (
                <span
                  key={i.id}
                  style={{
                    fontSize: 13,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 999,
                    padding: '5px 12px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {cat.emoji} {i.name}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ── CTA / statut vérification ── */}
      {!user.is_verified && (
        <div style={{ padding: '0 20px 24px' }}>
          {verifStatus === 'pending' ? (
            /* En attente de validation */
            <div style={{
              width: '100%', background: 'rgba(61,219,130,0.07)',
              border: '1.5px solid rgba(61,219,130,0.3)', borderRadius: 18,
              padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <span style={{ fontSize: 26, flexShrink: 0 }}>⏳</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)', margin: 0 }}>Demande envoyée</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Un modérateur vérifie ta pièce d'identité — résultat sous 24h
                </p>
              </div>
            </div>
          ) : verifStatus === 'rejected' ? (
            /* Refusé — peut réessayer */
            <button
              onClick={() => navigate('/verification')}
              style={{
                width: '100%', background: 'rgba(255,77,77,0.07)',
                border: '1.5px dashed rgba(255,77,77,0.4)', borderRadius: 18,
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 26, flexShrink: 0 }}>❌</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#FF4D4D', margin: 0 }}>Vérification refusée</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Appuie pour renvoyer ta demande</p>
              </div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 20 }}>›</span>
            </button>
          ) : (
            /* Pas encore de demande */
            <button
              onClick={() => navigate('/verification')}
              style={{
                width: '100%', background: 'rgba(232,255,71,0.08)',
                border: '1.5px dashed var(--accent)', borderRadius: 18,
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,255,71,0.13)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(232,255,71,0.08)'}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid var(--accent)', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                🪪
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', margin: 0 }}>Vérifier mon identité</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Obtiens le badge <span style={{ color: 'var(--green)', fontWeight: 600 }}>Vérifié ✓</span>
                </p>
              </div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 20 }}>›</span>
            </button>
          )}
        </div>
      )}

      {/* ── Badges ── */}
      {allBadges.length > 0 && (
        <div style={{ padding: '0 24px 28px' }}>
          <SectionLabel>Badges reçus</SectionLabel>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {allBadges.map(b => {
              const earned = badges.find(ub => ub.id === b.id)
              return (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    background: earned ? 'rgba(232,255,71,0.08)' : 'var(--surface2)',
                    border: `1.5px solid ${earned ? 'rgba(232,255,71,0.3)' : 'var(--border-color)'}`,
                    borderRadius: 999,
                    padding: '8px 14px',
                    opacity: earned ? 1 : 0.35,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{b.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: earned ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: 'DM Sans, sans-serif' }}>
                    {b.name}
                  </span>
                  {earned && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--bg)', borderRadius: 999, padding: '1px 6px', marginLeft: 2, fontFamily: 'Syne, sans-serif' }}>
                      {earned.count}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          {badges.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10 }}>
              Rejoins des sorties pour recevoir des badges !
            </p>
          )}
        </div>
      )}

      {/* ── Succès ── */}
      {achievements.length > 0 && (
        <div style={{ padding: '0 24px 28px' }}>
          <SectionLabel>Succès</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {achievements.map(a => (
              <div
                key={a.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: 'rgba(61,219,130,0.07)',
                  border: '1.5px solid rgba(61,219,130,0.25)',
                  borderRadius: 999, padding: '7px 14px',
                }}
              >
                <span style={{ fontSize: 16 }}>{a.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', fontFamily: 'DM Sans, sans-serif' }}>
                  {a.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Photos ── */}
      <div style={{ padding: '0 24px 24px' }}>
        <SectionLabel>Photos</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
          {/* Bouton ajouter (si < 9 photos) */}
          {photos.length < 9 && (
            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                aspectRatio: '1',
                background: 'var(--surface2)',
                border: '1.5px dashed var(--border-color)',
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <Plus size={22} color="var(--text-tertiary)" />
            </button>
          )}
          {/* Photos existantes */}
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              onClick={() => setViewerIndex(i)}
              style={{ position: 'relative', aspectRatio: '1', background: 'none', border: 'none', padding: 0, cursor: 'pointer', borderRadius: 10, overflow: 'hidden' }}
            >
              <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {photo.likes_count > 0 && (
                <div style={{ position: 'absolute', bottom: 5, right: 6, display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,0.5)', borderRadius: 999, padding: '2px 6px' }}>
                  <Heart size={10} color="white" />
                  <span style={{ fontSize: 10, color: 'white', fontWeight: 600 }}>{photo.likes_count}</span>
                </div>
              )}
            </button>
          ))}
        </div>
        {photos.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10 }}>
            Ajoute des photos à ton profil
          </p>
        )}
      </div>

      {/* ── Modal upload photo ── */}
      {showUploadModal && (
        <PhotoUploadModal
          onClose={() => setShowUploadModal(false)}
          onPublished={(newPhoto) => setPhotos(prev => [newPhoto, ...prev])}
        />
      )}

      {/* ── Photo viewer (propre profile) ── */}
      {viewerIndex !== null && (
        <OwnPhotoViewer
          photos={photos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onDelete={async (photoId) => {
            await handlePhotoDelete(photoId)
            setViewerIndex(null)
          }}
          onDescriptionSave={async (photoId, desc) => {
            await api.patch(`/photos/${photoId}/description`, { description: desc })
            setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, description: desc } : p))
          }}
        />
      )}

      {/* ── Sorties récentes ── */}
      <div style={{ padding: '0 20px 32px' }}>
        <SectionLabel>Sorties récentes</SectionLabel>
        {joinedEvents.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '28px 0',
              color: 'var(--text-tertiary)',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 32 }}>🌆</span>
            <p style={{ fontSize: 13 }}>Aucune sortie pour l'instant</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {joinedEvents.map(event => {
              const cat = getCat(event.category)
              return (
                <div
                  key={event.id}
                  style={{
                    background: 'var(--surface2)',
                    border: `1px solid ${cat.color}`,
                    borderRadius: 14,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{cat.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontFamily: 'Syne, sans-serif',
                        fontWeight: 700,
                        fontSize: 13,
                        color: 'var(--text)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {event.title}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                      {event.location_name}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, color: cat.color, fontWeight: 600, flexShrink: 0 }}>
                    ✓
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Viewer photo pour le propre profil (avec suppression + édition description)
function OwnPhotoViewer({ photos, initialIndex, onClose, onDelete, onDescriptionSave }) {
  const [index, setIndex] = useState(initialIndex)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descInput, setDescInput] = useState('')
  const photo = photos[index]

  useEffect(() => {
    setEditingDesc(false)
    setDescInput(photo?.description || '')
  }, [index, photo?.id])

  async function saveDesc() {
    await onDescriptionSave(photo.id, descInput.trim() || null)
    setEditingDesc(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.96)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{index + 1} / {photos.length}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', padding: 4 }}>
          <X size={24} />
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 0 }}>
        {index > 0 && (
          <button onClick={() => setIndex(i => i - 1)} style={{ position: 'absolute', left: 12, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
            <ChevronLeft size={22} />
          </button>
        )}
        <img src={photo.url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4, userSelect: 'none' }} />
        {index < photos.length - 1 && (
          <button onClick={() => setIndex(i => i + 1)} style={{ position: 'absolute', right: 12, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
            <ChevronRight size={22} />
          </button>
        )}
      </div>
      <div style={{ padding: '12px 20px 32px', flexShrink: 0 }}>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <button
            onClick={() => { setEditingDesc(true); setDescInput(photo.description || '') }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, padding: '8px 14px', color: 'white', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
          >
            <Pencil size={14} /> Description
          </button>
          <button
            onClick={() => onDelete(photo.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 10, padding: '8px 14px', color: '#ff6b6b', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
          >
            <Trash2 size={14} /> Supprimer
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            <Heart size={14} /> {photo.likes_count ?? 0}
          </div>
        </div>
        {/* Description edit */}
        {editingDesc ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              autoFocus
              value={descInput}
              onChange={e => setDescInput(e.target.value)}
              placeholder="Ajouter une description…"
              maxLength={150}
              style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px 12px', color: 'white', fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
              onKeyDown={e => { if (e.key === 'Enter') saveDesc() }}
            />
            <button onClick={saveDesc} style={{ background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Check size={16} color="var(--bg)" />
            </button>
          </div>
        ) : photo.description ? (
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.6 }}>{photo.description}</p>
        ) : null}
      </div>
    </div>
  )
}

// Label de section
function SectionLabel({ children }) {
  return (
    <p
      style={{
        fontSize: 10,
        fontFamily: 'Syne, sans-serif',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--text-tertiary)',
        marginBottom: 12,
      }}
    >
      {children}
    </p>
  )
}

