import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import { ArrowLeft, Clock, MapPin, UserPlus } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import api from '../../services/api'
import { getCat, formatTime } from '../../utils/categories'
import { useThemeStore } from '../../stores/themeStore'
import Spinner from '../../components/ui/Spinner'

// Page de détail d'un événement — Figma: ActivityDetails
export default function EventDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { theme } = useThemeStore()
  const tileUrl = theme === 'light'
    ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteVoteSent, setDeleteVoteSent] = useState(false)
  const [justJoined, setJustJoined] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [friends, setFriends] = useState([])
  const [selectedFriends, setSelectedFriends] = useState(new Set())
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteDone, setInviteDone] = useState(false)
  const [verifStatus, setVerifStatus] = useState(null) // null | 'pending' | 'rejected' | 'none'

  // Charger le statut de vérification si l'user n'est pas vérifié
  useEffect(() => {
    if (user && !user.is_verified) {
      api.get('/verification/status')
        .then(({ data }) => setVerifStatus(data.status || 'none'))
        .catch(() => setVerifStatus('none'))
    }
  }, [user?.is_verified])

  const fetchEvent = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${id}`)
      setEvent(data)
    } catch {
      navigate('/events', { replace: true })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchEvent() }, [fetchEvent])

  async function handleJoin() {
    setActionLoading(true)
    setShowConfirm(false)
    try {
      await api.post(`/events/${id}/join`)
      await fetchEvent()
      setJustJoined(true)
    } catch (err) {
      if (err.response?.status === 403) navigate('/verification')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleLeave() {
    setActionLoading(true)
    try {
      await api.post(`/events/${id}/leave`)
      await fetchEvent()
      setJustJoined(false)
    } catch {}
    finally { setActionLoading(false) }
  }

  async function handleDelete() {
    // Ouvrir la modale de confirmation appropriée
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    setDeleteLoading(true)
    try {
      const { data } = await api.post(`/events/${id}/request-deletion`)
      if (data.deleted) {
        // Suppression directe (aucun autre participant)
        navigate('/events')
      } else {
        // Vote lancé → fermer la modale et aller dans le chat
        setShowDeleteConfirm(false)
        setDeleteVoteSent(true)
        setTimeout(() => setDeleteVoteSent(false), 4000)
      }
    } catch {}
    finally { setDeleteLoading(false) }
  }

  async function openInvite() {
    setInviteDone(false)
    setSelectedFriends(new Set())
    if (friends.length === 0) {
      const { data } = await api.get('/users/me/friends').catch(() => ({ data: [] }))
      setFriends(data)
    }
    setShowInvite(true)
  }

  function toggleFriend(id) {
    setSelectedFriends(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function sendInvites() {
    if (selectedFriends.size === 0) return
    setInviteLoading(true)
    try {
      await api.post(`/events/${id}/invite`, { user_ids: [...selectedFriends] })
      setInviteDone(true)
      setTimeout(() => setShowInvite(false), 1200)
    } catch {}
    finally { setInviteLoading(false) }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <Spinner />
      </div>
    )
  }
  if (!event) return null

  const cat = getCat(event.category)
  const { time, label } = formatTime(event.starts_at)
  const isCreator = user?.id === event.creator?.id

  // Calcul du niveau de validation du profil
  const profileStep = !user?.data_consent ? 'charter'
    : !user?.is_verified ? 'identity'
    : 'ok'
  const placesLeft = event.max_participants
    ? event.max_participants - event.participants_count
    : null
  const fillPct = event.max_participants
    ? Math.round((event.participants_count / event.max_participants) * 100)
    : 100

  // Construire les slots de participants (remplis / libres)
  const slots = []
  for (let i = 0; i < event.participants_count; i++) slots.push(true)
  if (event.max_participants) {
    for (let i = event.participants_count; i < event.max_participants; i++) slots.push(false)
  }

  // Si profil non validé → page bloquée avec gate
  if (profileStep !== 'ok') {
    return <ProfileGate step={profileStep} verifStatus={verifStatus} event={event} cat={cat} navigate={navigate} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ── En-tête sticky ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border-color)',
          padding: '16px 20px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
          }}
          aria-label="Retour"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <span
          style={{
            fontSize: 11,
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: cat.color,
          }}
        >
          {cat.emoji} {cat.label}
        </span>
        <h1
          style={{
            flex: 1,
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--text)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.title}
        </h1>
      </div>

      {/* ── Contenu scrollable ── */}
      <div style={{ flex: 1, padding: '20px 20px 110px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Chips info : heure + lieu */}
        <div style={{ display: 'flex', gap: 10 }}>
          <InfoChip
            icon={<Clock size={16} strokeWidth={2} color={cat.color} />}
            label="Heure"
            value={`${time} · ${label}`}
            catColor={cat.color}
          />
          <InfoChip
            icon={<MapPin size={16} strokeWidth={2} color={cat.color} />}
            label="Lieu"
            value={event.location_name}
            catColor={cat.color}
          />
        </div>

        {/* Description */}
        {event.description && (
          <div
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border-color)',
              borderRadius: 18,
              padding: '16px 20px',
            }}
          >
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, fontStyle: 'italic' }}>
              "{event.description}"
            </p>
          </div>
        )}

        {/* Mini carte */}
        {event.latitude && event.longitude && (
          <div>
            <SectionLabel>Lieu</SectionLabel>
            <div
              style={{
                borderRadius: 18,
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                height: 100,
              }}
            >
              <MapContainer
                center={[event.latitude, event.longitude]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                attributionControl={false}
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
              >
                <TileLayer url={tileUrl} />
                <Marker position={[event.latitude, event.longitude]} />
              </MapContainer>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 6 }}>
              {event.location_name}
            </p>
          </div>
        )}

        {/* Participants */}
        <div>
          <SectionLabel>
            Participants ({event.participants_count}{event.max_participants ? `/${event.max_participants}` : ''})
          </SectionLabel>

          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 18, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Avatars réels + emplacements libres */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {(event.participants || []).map(p => (
                <button
                  key={p.id}
                  onClick={() => p.id === user?.id ? navigate('/profile') : navigate(`/users/${p.id}`)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 5,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: `${cat.color}20`,
                      border: `2px solid ${cat.color}`,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 700,
                      color: cat.color,
                      flexShrink: 0,
                    }}
                  >
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt={p.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : p.first_name?.[0]?.toUpperCase()
                    }
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', maxWidth: 48, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.first_name}
                    {p.is_verified && <span style={{ color: 'var(--green)' }}> ✓</span>}
                  </span>
                </button>
              ))}

              {/* Places libres restantes */}
              {event.max_participants && Array.from({ length: Math.max(0, event.max_participants - event.participants_count) }).map((_, i) => (
                <div key={`free-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--text-tertiary)' }}>
                    Libre
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>—</span>
                </div>
              ))}
            </div>

            {/* Barre de progression */}
            {event.max_participants && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Places restantes</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: event.is_full ? 'var(--orange)' : 'var(--green)' }}>
                    {event.is_full ? 'Complet' : `${placesLeft} place${placesLeft > 1 ? 's' : ''} disponible${placesLeft > 1 ? 's' : ''}`}
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${fillPct}%`, background: event.is_full ? 'var(--orange)' : 'var(--green)', borderRadius: 999, transition: 'width 0.7s ease' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Accès au chat si membre */}
        {event.is_joined && (
          <div>
            <SectionLabel>Groupe de discussion</SectionLabel>
            <button
              onClick={() => navigate(`/messages/${event.id}`)}
              style={{
                width: '100%',
                background: 'var(--surface2)',
                border: '1px solid var(--border-color)',
                borderRadius: 18,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(232,255,71,0.3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${cat.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                💬
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', margin: 0 }}>
                  Ouvrir le chat du groupe
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {event.participants_count} membres · Discussion en direct
                </p>
              </div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 20 }}>›</span>
            </button>
          </div>
        )}

        {/* ── Demandes en attente (créateur uniquement, si validation manuelle) ── */}
        {isCreator && event.requires_approval && (
          <PendingRequestsSection eventId={event.id} onChange={fetchEvent} />
        )}
      </div>

      {/* ── CTA fixe en bas ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 80,
          left: 0,
          right: 0,
          margin: '0 auto',
          padding: '12px 20px 16px',
          background: 'linear-gradient(to top, var(--bg) 70%, transparent)',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          {isCreator ? (
            <div style={{ display: 'flex', gap: 10 }}>
              {/* Inviter des amis */}
              <button
                onClick={openInvite}
                style={{
                  flex: 1,
                  background: 'rgba(232,255,71,0.08)',
                  border: '1px solid rgba(232,255,71,0.25)',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  fontSize: 13,
                  fontFamily: 'DM Sans, sans-serif',
                  padding: '10px 0',
                  borderRadius: 11,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <UserPlus size={15} />
                Inviter des amis
              </button>
              {event.deletion_poll ? (
                <button
                  onClick={() => navigate(`/messages/${event.id}`)}
                  style={{
                    flex: 1,
                    background: 'rgba(255,122,61,0.1)',
                    border: '1px solid rgba(255,122,61,0.3)',
                    color: 'var(--orange)',
                    fontWeight: 700,
                    fontSize: 13,
                    fontFamily: 'DM Sans, sans-serif',
                    padding: '10px 0',
                    borderRadius: 11,
                    cursor: 'pointer',
                  }}
                >
                  Vote en cours...
                </button>
              ) : (
                <button
                  onClick={handleDelete}
                  style={{
                    flex: 1,
                    background: 'rgba(255,122,61,0.1)',
                    border: '1px solid rgba(255,122,61,0.3)',
                    color: 'var(--orange)',
                    fontWeight: 700,
                    fontSize: 13,
                    fontFamily: 'DM Sans, sans-serif',
                    padding: '10px 0',
                    borderRadius: 11,
                    cursor: 'pointer',
                  }}
                >
                  Supprimer
                </button>
              )}
            </div>
          ) : event.is_joined ? (
            <button
              onClick={handleLeave}
              disabled={actionLoading}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                fontSize: 13,
                cursor: 'pointer',
                padding: '8px 0',
                fontFamily: 'DM Sans, sans-serif',
                width: '100%',
              }}
            >
              Quitter ce groupe
            </button>
          ) : event.join_status === 'pending' ? (
            <div
              style={{
                width: '100%',
                background: 'var(--surface2)',
                border: '1px solid var(--accent-border, var(--border-color))',
                color: 'var(--text)',
                fontSize: 14,
                fontFamily: 'DM Sans, sans-serif',
                padding: '14px 16px',
                borderRadius: 11,
                textAlign: 'center',
              }}
            >
              ⏳ Demande envoyée — en attente de validation
            </div>
          ) : event.join_status === 'rejected' ? (
            <div
              style={{
                width: '100%',
                background: 'rgba(255,122,61,0.1)',
                border: '1px solid rgba(255,122,61,0.3)',
                color: 'var(--orange, #FF7A3D)',
                fontSize: 14,
                fontFamily: 'DM Sans, sans-serif',
                padding: '14px 16px',
                borderRadius: 11,
                textAlign: 'center',
              }}
            >
              ✗ Ta demande n'a pas été retenue
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={event.is_full || actionLoading}
              style={{
                width: '100%',
                background: 'var(--accent)',
                color: 'var(--bg)',
                fontWeight: 700,
                fontSize: 15,
                fontFamily: 'DM Sans, sans-serif',
                padding: '14px 0',
                borderRadius: 11,
                border: 'none',
                cursor: event.is_full ? 'not-allowed' : 'pointer',
                opacity: event.is_full ? 0.45 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'opacity 0.15s, box-shadow 0.15s',
                boxShadow: event.is_full ? 'none' : '0 0 24px rgba(232,255,71,0.25), 0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {actionLoading && (
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
              {event.is_full
                ? 'Complet — plus de place'
                : event.requires_approval
                  ? 'Demander à rejoindre →'
                  : 'Rejoindre ce groupe →'}
            </button>
          )}
        </div>
      </div>

      {/* ── Toast succès join ── */}
      {justJoined && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 500,
            background: 'var(--green)',
            color: 'var(--on-accent)',
            fontWeight: 700,
            padding: '12px 24px',
            borderRadius: 18,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'bounce 0.5s ease',
            whiteSpace: 'nowrap',
          }}
        >
          🎉 Tu as rejoint le groupe !
          <button
            onClick={() => setJustJoined(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, marginLeft: 4 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Modal confirmation ── */}
      {showConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(6px)',
            }}
          />
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 400,
              background: 'var(--surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 24,
              padding: '28px 24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Barre de drag */}
            <div
              style={{
                width: 40,
                height: 4,
                background: 'var(--border-color)',
                borderRadius: 999,
                margin: '0 auto 20px',
              }}
            />
            <h2
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 800,
                fontSize: 22,
                marginBottom: 8,
                color: 'var(--text)',
              }}
            >
              Tu es sûr ?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
              Tu vas rejoindre <strong style={{ color: 'var(--text)' }}>{event.title}</strong>{' '}
              — {time}, {label}.<br />
              Tu auras accès au chat du groupe.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1,
                  background: 'var(--bg)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: 15,
                  padding: '13px 0',
                  borderRadius: 11,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleJoin}
                style={{
                  flex: 1,
                  background: 'var(--accent)',
                  border: 'none',
                  color: 'var(--bg)',
                  fontWeight: 700,
                  fontSize: 15,
                  padding: '13px 0',
                  borderRadius: 11,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'opacity 0.15s',
                }}
              >
                C'est parti ! {cat.emoji}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast vote lancé ── */}
      {deleteVoteSent && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 500, background: 'var(--orange)', color: '#fff',
          fontWeight: 700, padding: '12px 24px', borderRadius: 18,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', whiteSpace: 'nowrap',
        }}>
          🗳️ Vote envoyé dans le chat !
        </div>
      )}

      {/* ── Modale confirmation suppression ── */}
      {showDeleteConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} />
          <div
            style={{ position: 'relative', width: '100%', maxWidth: 400, background: 'var(--surface)', border: '1px solid rgba(255,122,61,0.3)', borderRadius: 24, padding: '28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, background: 'var(--border-color)', borderRadius: 999, margin: '0 auto 20px' }} />
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, marginBottom: 10, color: 'var(--text)' }}>
              Supprimer cette sortie ?
            </h2>
            {event.participants_count > 1 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
                Il y a déjà <strong style={{ color: 'var(--text)' }}>{event.participants_count - 1} participant{event.participants_count > 2 ? 's' : ''}</strong> dans ce groupe.<br />
                Un vote sera envoyé dans le chat. Si la majorité dit <strong style={{ color: 'var(--orange)' }}>Non</strong>, la sortie est supprimée. Si elle dit <strong style={{ color: 'var(--green)' }}>Oui</strong>, tu quittes seulement le groupe.
              </p>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
                Tu es le seul participant. La sortie sera supprimée définitivement.
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 15, padding: '13px 0', borderRadius: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteLoading}
                style={{ flex: 1, background: 'var(--orange)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 15, padding: '13px 0', borderRadius: 11, cursor: deleteLoading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: deleteLoading ? 0.7 : 1 }}
              >
                {deleteLoading ? '...' : event.participants_count > 1 ? 'Lancer le vote' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal invitation amis ── */}
      {showInvite && (
        <div
          onClick={() => setShowInvite(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              background: 'var(--surface1)',
              borderRadius: '22px 22px 0 0',
              padding: '20px 20px 40px',
              maxHeight: '75vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Poignée */}
            <div style={{ width: 36, height: 4, background: 'var(--border-color)', borderRadius: 99, margin: '0 auto 18px' }} />

            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--text)', margin: '0 0 16px' }}>
              Inviter des amis
            </p>

            {/* Liste d'amis */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {friends.length === 0 ? (
                <p style={{ fontSize: 14, color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: 24, fontFamily: 'DM Sans, sans-serif' }}>
                  Tu n'as pas encore d'amis
                </p>
              ) : friends.map(f => {
                const selected = selectedFriends.has(f.id)
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleFriend(f.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: selected ? 'rgba(232,255,71,0.08)' : 'var(--surface2)',
                      border: `1px solid ${selected ? 'rgba(232,255,71,0.4)' : 'var(--border-color)'}`,
                      borderRadius: 14, padding: '11px 14px',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg)', border: '2px solid var(--border-color)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {f.avatar_url
                        ? <img src={f.avatar_url} alt={f.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : f.first_name?.[0]?.toUpperCase()
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', margin: 0 }}>{f.first_name}</p>
                      {f.username && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '1px 0 0' }}>@{f.username}</p>}
                    </div>
                    {/* Checkbox */}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: selected ? 'var(--accent)' : 'transparent',
                      border: `2px solid ${selected ? 'var(--accent)' : 'var(--border-color)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}>
                      {selected && <span style={{ fontSize: 12, color: 'var(--on-accent)', fontWeight: 800 }}>✓</span>}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Bouton envoyer */}
            <button
              onClick={sendInvites}
              disabled={inviteLoading || inviteDone || selectedFriends.size === 0}
              style={{
                marginTop: 16,
                width: '100%',
                background: inviteDone ? 'var(--green)' : 'var(--accent)',
                border: 'none',
                borderRadius: 11,
                padding: '14px 0',
                fontSize: 15,
                fontWeight: 700,
                fontFamily: 'DM Sans, sans-serif',
                color: 'var(--on-accent)',
                cursor: (inviteLoading || inviteDone || selectedFriends.size === 0) ? 'not-allowed' : 'pointer',
                opacity: selectedFriends.size === 0 && !inviteDone ? 0.45 : 1,
                transition: 'background 0.2s, opacity 0.15s',
              }}
            >
              {inviteDone
                ? 'Invitations envoyées ✓'
                : inviteLoading
                  ? '...'
                  : selectedFriends.size > 0
                    ? `Inviter ${selectedFriends.size} ami${selectedFriends.size > 1 ? 's' : ''}`
                    : 'Sélectionne des amis'
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Chip d'info avec icône SVG (heure, lieu)
function InfoChip({ icon, label, value, catColor }) {
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--surface2)',
        border: '1px solid var(--border-color)',
        borderRadius: 18,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
      }}
    >
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: 9,
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-tertiary)',
            marginBottom: 2,
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

// Gate profil non validé — affiché à la place du détail de l'événement
function ProfileGate({ step, verifStatus, event, cat, navigate }) {
  const isCharter = step === 'charter'
  const isPending = verifStatus === 'pending'

  const steps = [
    {
      id: 'charter',
      label: 'Accepter la charte',
      done: !isCharter,
      cta: 'Lire et accepter',
      action: () => navigate('/charter'),
    },
    {
      id: 'identity',
      label: isPending ? 'Vérification en cours…' : 'Vérifier ton identité',
      done: false,
      pending: isPending,
      cta: isPending ? null : 'Soumettre ma vérification',
      action: isPending ? null : () => navigate('/verification'),
      disabled: isCharter,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* En-tête — toujours visible */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg)', borderBottom: '1px solid var(--border-color)', padding: '16px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span style={{ fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: cat.color }}>
          {cat.emoji} {cat.label}
        </span>
        <span style={{ flex: 1, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.title}
        </span>
      </div>

      {/* Contenu flouté en arrière-plan */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Aperçu flouté */}
        <div style={{ filter: 'blur(6px)', opacity: 0.35, padding: '20px', pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{ height: 180, background: 'var(--surface2)', borderRadius: 16, marginBottom: 16 }} />
          <div style={{ height: 20, background: 'var(--surface2)', borderRadius: 8, marginBottom: 10, width: '60%' }} />
          <div style={{ height: 14, background: 'var(--surface2)', borderRadius: 8, marginBottom: 8, width: '80%' }} />
          <div style={{ height: 14, background: 'var(--surface2)', borderRadius: 8, marginBottom: 8, width: '50%' }} />
          <div style={{ height: 80, background: 'var(--surface2)', borderRadius: 16, marginTop: 20 }} />
        </div>

        {/* Overlay gate */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 28px',
          background: 'var(--bg)',
          opacity: 0.97,
        }}>
          {/* Icône */}
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>

          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--text)', textAlign: 'center', margin: '0 0 8px', lineHeight: 1.3 }}>
            Profil non validé
          </h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 28px', lineHeight: 1.6 }}>
            Pour accéder aux sorties et interagir avec la communauté, tu dois compléter les étapes suivantes :
          </p>

          {/* Étapes */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {steps.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: s.done ? 'rgba(61,219,130,0.08)' : s.disabled ? 'rgba(255,255,255,0.03)' : 'rgba(232,255,71,0.07)',
                  border: `1px solid ${s.done ? 'rgba(61,219,130,0.25)' : s.disabled ? 'var(--border-color)' : 'rgba(232,255,71,0.2)'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: s.done ? 'var(--green)' : s.disabled ? 'var(--surface2)' : 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: 'var(--on-accent)',
                }}>
                  {s.done ? '✓' : i + 1}
                </div>
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600, color: s.disabled ? 'var(--text-tertiary)' : 'var(--text)', flex: 1 }}>
                  {s.label}
                </span>
                {s.done && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>Fait</span>}
                {s.pending && <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>En attente</span>}
              </div>
            ))}
          </div>

          {/* Message "en attente" si vérification en cours */}
          {isPending && !isCharter && (
            <div style={{
              width: '100%',
              background: 'rgba(232,255,71,0.07)',
              border: '1px solid rgba(232,255,71,0.2)',
              borderRadius: 11,
              padding: '14px 18px',
              textAlign: 'center',
            }}>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--accent)', margin: 0, lineHeight: 1.5 }}>
                Ta demande de vérification est en cours d'examen. Généralement traité sous 24h.
              </p>
            </div>
          )}

          {/* CTA de l'étape active (pas si en attente) */}
          {steps.filter(s => !s.done && !s.disabled && !s.pending && s.cta).map(s => (
            <button
              key={s.id}
              onClick={s.action}
              style={{
                width: '100%',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 11,
                padding: '14px 0',
                color: 'var(--on-accent)',
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              {s.cta} →
            </button>
          ))}
        </div>
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
        marginBottom: 10,
      }}
    >
      {children}
    </p>
  )
}

// ── Demandes en attente (créateur d'une sortie à validation manuelle) ─────
function PendingRequestsSection({ eventId, onChange }) {
  const navigate = useNavigate()
  const [pendings, setPendings] = useState(null)
  const [actionId, setActionId] = useState(null)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${eventId}/pending`)
      setPendings(data)
    } catch {
      setPendings([])
    }
  }, [eventId])

  useEffect(() => { load() }, [load])

  async function action(userId, type) {
    setActionId(userId)
    try {
      await api.post(`/events/${eventId}/pending/${userId}/${type}`)
      setPendings(prev => prev.filter(p => p.id !== userId))
      onChange?.() // rafraîchir l'event parent (compteur participants)
    } catch {} finally {
      setActionId(null)
    }
  }

  if (pendings === null) return null
  if (pendings.length === 0) {
    return (
      <div style={{ marginTop: 8 }}>
        <SectionLabel>Demandes en attente</SectionLabel>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
          Aucune demande en attente.
        </p>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8 }}>
      <SectionLabel>Demandes en attente ({pendings.length})</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pendings.map(u => (
          <div
            key={u.id}
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <button
              onClick={() => navigate(`/users/${u.id}`)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
              aria-label={`Voir le profil de ${u.first_name}`}
            >
              {u.avatar_url ? (
                <img src={u.avatar_url} alt={u.first_name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>
                  {u.first_name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                {u.first_name}
                {u.is_verified && <span style={{ color: 'var(--green)', fontSize: 11 }}>✓</span>}
              </p>
              {u.username && (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>@{u.username}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => action(u.id, 'approve')}
                disabled={actionId === u.id}
                style={{
                  background: 'var(--green)', color: 'var(--bg)', border: 'none',
                  borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 700,
                  fontFamily: 'DM Sans, sans-serif', cursor: actionId === u.id ? 'not-allowed' : 'pointer',
                  opacity: actionId === u.id ? 0.5 : 1,
                }}
              >
                Accepter
              </button>
              <button
                onClick={() => action(u.id, 'reject')}
                disabled={actionId === u.id}
                style={{
                  background: 'transparent', color: 'var(--orange, #FF7A3D)',
                  border: '1px solid rgba(255,122,61,0.3)',
                  borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600,
                  fontFamily: 'DM Sans, sans-serif', cursor: actionId === u.id ? 'not-allowed' : 'pointer',
                  opacity: actionId === u.id ? 0.5 : 1,
                }}
              >
                Refuser
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
