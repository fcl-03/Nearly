import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, UserCheck, UserX, Clock, MessageCircle, Heart, X, ChevronLeft, ChevronRight, Flag, ShieldOff, ShieldBan, MapPin } from 'lucide-react'
import api from '../../services/api'
import { getCat } from '../../utils/categories'
import Spinner from '../../components/ui/Spinner'
import SectionLabel from '../../components/ui/SectionLabel'
import SouvenirModal from '../../components/ui/SouvenirModal'

// Motifs de signalement
const REPORT_REASONS = [
  { key: 'inappropriate', label: 'Comportement inapproprié' },
  { key: 'fake', label: 'Faux profil / Usurpation' },
  { key: 'harassment', label: 'Harcèlement' },
  { key: 'offensive', label: 'Contenu offensant' },
  { key: 'spam', label: 'Spam' },
  { key: 'other', label: 'Autre' },
]

export default function UserProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportSent, setReportSent] = useState(false)

  const [photos, setPhotos] = useState([])
  const [badges, setBadges] = useState([])
  const [allBadges, setAllBadges] = useState([])
  const [badgesGiven, setBadgesGiven] = useState([])
  const [achievements, setAchievements] = useState([])
  const [badgeLoading, setBadgeLoading] = useState(null)

  // Photo viewer
  const [viewerIndex, setViewerIndex] = useState(null) // index de la photo ouverte
  const [eventsHistory, setEventsHistory] = useState([]) // souvenirs de cet utilisateur
  const [souvenirEventId, setSouvenirEventId] = useState(null) // récap souvenir ouvert

  useEffect(() => {
    api.get(`/users/${id}`).then(({ data }) => setProfile(data)).catch(() => navigate(-1)).finally(() => setLoading(false))
    api.get(`/users/${id}/photos`).then(({ data }) => setPhotos(data)).catch(() => {})
    api.get(`/users/${id}/badges`).then(({ data }) => setBadges(data)).catch(() => {})
    api.get('/badges').then(({ data }) => setAllBadges(data)).catch(() => {})
    api.get(`/users/${id}/badges-given-by-me`).then(({ data }) => setBadgesGiven(data)).catch(() => {})
    api.get(`/users/${id}/achievements`).then(({ data }) => setAchievements(data)).catch(() => {})
    api.get(`/users/${id}/events-history`).then(({ data }) => setEventsHistory(data)).catch(() => {})
  }, [id])

  const [friendError, setFriendError] = useState(null)

  async function handleFriendAction(action) {
    setActionLoading(true)
    setFriendError(null)
    try {
      let res
      if (action === 'send')   res = await api.post(`/users/${id}/friend-request`)
      if (action === 'accept') res = await api.post(`/users/${id}/friend-accept`)
      if (action === 'reject') res = await api.post(`/users/${id}/friend-reject`)
      if (action === 'remove') res = await api.delete(`/users/${id}/friend`)
      if (action === 'block')  res = await api.post(`/users/${id}/block`)
      if (action === 'unblock') res = await api.delete(`/users/${id}/block`)
      if (res?.data?.friendship_status) setProfile(p => ({ ...p, friendship_status: res.data.friendship_status }))
    } catch (err) {
      const detail = err.response?.data?.detail
      setFriendError(detail || 'Une erreur est survenue.')
    }
    finally { setActionLoading(false) }
  }

  async function handleToggleBadge(badgeId) {
    setBadgeLoading(badgeId)
    try {
      if (badgesGiven.includes(badgeId)) {
        await api.delete(`/users/${id}/badges/${badgeId}`)
        setBadgesGiven(prev => prev.filter(b => b !== badgeId))
        setBadges(prev => prev.map(b => b.id === badgeId ? { ...b, count: b.count - 1 } : b).filter(b => b.count > 0))
      } else {
        await api.post(`/users/${id}/badges`, { badge_id: badgeId })
        setBadgesGiven(prev => [...prev, badgeId])
        setBadges(prev => {
          const existing = prev.find(b => b.id === badgeId)
          if (existing) return prev.map(b => b.id === badgeId ? { ...b, count: b.count + 1 } : b)
          const badge = allBadges.find(b => b.id === badgeId)
          return badge ? [...prev, { ...badge, count: 1 }] : prev
        })
      }
    } catch (err) {
      if (err.response?.status === 403) alert('Vous devez avoir participé à une sortie ensemble pour donner un badge')
    } finally { setBadgeLoading(null) }
  }

  async function handleLike(photoId) {
    const { data } = await api.post(`/photos/${photoId}/like`)
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, liked_by_me: data.liked_by_me, likes_count: data.likes_count } : p))
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}><Spinner /></div>
  if (!profile) return null

  const joinedDate = new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const status = profile.friendship_status
  const totalBadges = badges.reduce((s, b) => s + b.count, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg)', borderBottom: '1px solid var(--border-color)', padding: '16px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 4 }} aria-label="Retour">
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text)', margin: 0, flex: 1 }}>
          {profile.first_name}
        </h1>
        {/* Bloquer / Débloquer */}
        {status === 'blocked' ? (
          <button
            onClick={() => handleFriendAction('unblock')}
            disabled={actionLoading}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF4D4D', display: 'flex', alignItems: 'center', padding: 4 }}
            aria-label="Débloquer"
            title="Débloquer"
          >
            <ShieldOff size={18} strokeWidth={2} />
          </button>
        ) : (
          <button
            onClick={() => { if (confirm('Bloquer cet utilisateur ? Il ne pourra plus te contacter ni voir ton profil.')) handleFriendAction('block') }}
            disabled={actionLoading}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', padding: 4 }}
            aria-label="Bloquer"
            title="Bloquer"
          >
            <ShieldBan size={18} strokeWidth={2} />
          </button>
        )}
        {/* Bouton signaler */}
        {!reportSent && (
          <button
            onClick={() => setShowReport(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', padding: 4 }}
            aria-label="Signaler"
          >
            <Flag size={18} strokeWidth={2} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 48 }}>

        {/* ── Header : avatar + identité ── */}
        <div style={{ padding: '24px 20px 0' }}>
          {/* Ligne avatar + identité */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Avatar (bordure verte si ami, accent sinon) */}
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                flexShrink: 0,
                background: 'var(--surface2)',
                border: `2.5px solid ${status === 'friends' ? 'var(--green)' : 'var(--accent)'}`,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                fontFamily: 'Syne, sans-serif',
                transition: 'border-color 0.3s',
              }}
            >
              {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profile.first_name?.[0]?.toUpperCase()}
            </div>

            {/* Identité : nom + badge + ville + ancienneté */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text)', margin: 0, lineHeight: 1.1 }}>
                  {profile.first_name}
                </h2>
                {profile.is_verified && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: 'var(--green)', background: 'rgba(61,219,130,0.12)', border: '1px solid rgba(61,219,130,0.35)', borderRadius: 999, padding: '3px 9px' }}>
                    Vérifié ✓
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                {profile.city && <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={13} /> {profile.city}</span>}
                {profile.is_premium && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: 'var(--accent-text)', background: 'rgba(232,255,71,0.12)', border: '1px solid var(--accent-border)', borderRadius: 999, padding: '2px 8px' }}>
                    Premium ⭐
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '5px 0 0' }}>Membre depuis {joinedDate}</p>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div style={{ marginTop: 20 }}>
              <SectionLabel mb={14}>Bio</SectionLabel>
              <p style={{ fontSize: 15, color: 'var(--text)', margin: 0, lineHeight: 1.55 }}>
                {profile.bio}
              </p>
            </div>
          )}

          {/* Stats — centrées, sans fond, séparées par des barres verticales */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28, marginTop: 24 }}>
            <StatItem value={profile.friends_count ?? 0} label="Amis" />
            <div style={{ width: 1, height: 36, background: 'var(--border-color)' }} />
            <StatItem value={profile.events_count ?? 0} label="Sorties" />
            <div style={{ width: 1, height: 36, background: 'var(--border-color)' }} />
            <StatItem value={totalBadges} label="Badges" />
          </div>

          {/* Boutons ami + MP */}
          {friendError && (
            <p style={{ fontSize: 13, color: 'var(--orange)', fontFamily: 'DM Sans, sans-serif', textAlign: 'center', margin: '20px 0 0' }}>
              {friendError}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: friendError ? 8 : 22 }}>
            <div style={{ flex: 1 }}>
              <FriendButton status={status} loading={actionLoading} onAction={handleFriendAction} />
            </div>
            {status === 'friends' && (
              <button onClick={() => navigate(`/dm/${id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>
                <MessageCircle size={15} />
                MP
              </button>
            )}
          </div>
        </div>

        {/* ── Badges cliquables ── */}
        {allBadges.length > 0 && (
          <div style={{ padding: '10px 24px 28px' }}>
            <SectionLabel mb={14}>Badges</SectionLabel>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {allBadges.map(b => {
                const earned = badges.find(ub => ub.id === b.id)
                const given = badgesGiven.includes(b.id)
                const isLoading = badgeLoading === b.id
                const highlight = given || earned
                return (
                  <button
                    key={b.id}
                    onClick={() => handleToggleBadge(b.id)}
                    disabled={!!badgeLoading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: highlight ? 'rgba(232,255,71,0.08)' : 'var(--surface2)',
                      border: `1px solid ${given ? 'rgba(232,255,71,0.5)' : (earned ? 'rgba(232,255,71,0.3)' : 'var(--border-color)')}`,
                      borderRadius: 999,
                      padding: '6px 11px',
                      cursor: badgeLoading ? 'not-allowed' : 'pointer',
                      opacity: (badgeLoading && !isLoading) ? 0.5 : (highlight ? 1 : 0.5),
                      boxShadow: highlight ? '0 0 12px rgba(232,255,71,0.25)' : 'none',
                      transition: 'all 0.15s',
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{b.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: highlight ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {isLoading ? '…' : b.name}
                    </span>
                    {earned && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--bg)', borderRadius: 999, padding: '0 5px', marginLeft: 1, fontFamily: 'Syne, sans-serif' }}>
                        {earned.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10 }}>
              Tap pour donner · re-tap pour retirer ·
            </p>
          </div>
        )}

        {/* ── Photos ── */}
        {photos.length > 0 && (
          <div style={{ padding: '0 24px 28px' }}>
            <SectionLabel mb={14}>Photos</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {photos.map((photo, i) => (
                <button
                  key={photo.id}
                  onClick={() => setViewerIndex(i)}
                  style={{ aspectRatio: '1', background: 'none', border: 'none', padding: 0, cursor: 'pointer', position: 'relative', borderRadius: 10, overflow: 'hidden' }}
                >
                  <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  {photo.likes_count > 0 && (
                    <div style={{ position: 'absolute', bottom: 5, right: 6, display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,0.5)', borderRadius: 999, padding: '2px 6px' }}>
                      <Heart size={10} fill={photo.liked_by_me ? '#ff4d6d' : 'none'} color={photo.liked_by_me ? '#ff4d6d' : 'white'} />
                      <span style={{ fontSize: 10, color: 'white', fontWeight: 600 }}>{photo.likes_count}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Intérêts ── */}
        {profile.interests?.length > 0 && (
          <div style={{ padding: '0 24px 28px' }}>
            <SectionLabel mb={14}>Centres d'intérêt</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profile.interests.map(interest => (
                <span key={interest.id} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 999, padding: '6px 14px' }}>
                  {interest.emoji} {interest.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Sorties (souvenirs de l'utilisateur) ── */}
        {eventsHistory.length > 0 && (
          <div style={{ padding: '0 0 28px' }}>
            <div style={{ padding: '0 24px' }}><SectionLabel mb={14}>Sorties récentes</SectionLabel></div>
            <div className="nearly-hscroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 24px 6px' }}>
              {eventsHistory.map(event => {
                const cat = getCat(event.category)
                return (
                  <button
                    key={event.id}
                    onClick={() => setSouvenirEventId(event.id)}
                    style={{
                      flex: '0 0 150px', width: 150, height: 78, position: 'relative',
                      background: event.cover_url ? 'var(--surface2)' : `linear-gradient(135deg, ${cat.color}45, ${cat.color}14)`,
                      border: `1px solid ${event.cover_url ? 'var(--border-color)' : cat.color + '33'}`,
                      borderRadius: 14, overflow: 'hidden', padding: 0, cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {event.cover_url && <img src={event.cover_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.05) 62%)' }} />
                    <span style={{ position: 'absolute', top: 7, right: 8, fontSize: 13 }}>{cat.emoji}</span>
                    <div style={{ position: 'absolute', left: 10, right: 10, bottom: 8 }}>
                      <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12.5, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.title}
                      </p>
                      <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.72)', margin: '2px 0 0' }}>
                        {new Date(event.starts_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Succès (en bas, discret) ── */}
        {achievements.length > 0 && (
          <div style={{ padding: '0 24px 28px' }}>
            <SectionLabel mb={14}>Succès</SectionLabel>
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

        {/* Bannière demande reçue */}
        {status === 'request_received' && (
          <div style={{ margin: '0 24px 28px', background: 'rgba(232,255,71,0.06)', border: '1px solid rgba(232,255,71,0.2)', borderRadius: 14, padding: '14px 16px', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={16} color="var(--accent-text)" style={{ flexShrink: 0 }} />
            <span><strong style={{ color: 'var(--accent)' }}>{profile.first_name}</strong> t'a envoyé une demande d'ami</span>
          </div>
        )}
      </div>

      {/* Photo viewer fullscreen */}
      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onLike={handleLike}
        />
      )}

      {/* Récap souvenir d'une sortie de cet utilisateur */}
      {souvenirEventId && (
        <SouvenirModal
          eventId={souvenirEventId}
          ownerId={id}
          ownerName={profile.first_name}
          onClose={() => setSouvenirEventId(null)}
        />
      )}

      {/* Modal signalement */}
      {showReport && (
        <ReportModal
          userId={id}
          onClose={() => setShowReport(false)}
          onSent={() => { setShowReport(false); setReportSent(true) }}
        />
      )}
    </div>
  )
}

// ── Photo viewer fullscreen ──
function PhotoViewer({ photos, initialIndex, onClose, onLike }) {
  const [index, setIndex] = useState(initialIndex)
  const photo = photos[index]

  function prev() { setIndex(i => Math.max(0, i - 1)) }
  function next() { setIndex(i => Math.min(photos.length - 1, i + 1)) }

  // Swipe sur mobile
  const touchStartX = useRef(null)

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(diff) > 50) {
      if (diff < 0) next()
      else prev()
    }
    touchStartX.current = null
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.96)', display: 'flex', flexDirection: 'column' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header viewer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{index + 1} / {photos.length}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', padding: 4 }}>
          <X size={24} />
        </button>
      </div>

      {/* Image + nav */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 0 }}>
        {index > 0 && (
          <button onClick={prev} style={{ position: 'absolute', left: 12, zIndex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
            <ChevronLeft size={22} />
          </button>
        )}
        <img
          src={photo.url}
          alt=""
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4, userSelect: 'none' }}
        />
        {index < photos.length - 1 && (
          <button onClick={next} style={{ position: 'absolute', right: 12, zIndex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* Footer viewer : like + description */}
      <div style={{ padding: '16px 20px 32px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: photo.description ? 12 : 0 }}>
          <button
            onClick={() => onLike(photo.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
          >
            <Heart
              size={28}
              fill={photo.liked_by_me ? '#ff4d6d' : 'none'}
              color={photo.liked_by_me ? '#ff4d6d' : 'white'}
              style={{ transition: 'all 0.15s' }}
            />
            <span style={{ fontSize: 15, fontWeight: 600, color: photo.liked_by_me ? '#ff4d6d' : 'rgba(255,255,255,0.8)' }}>
              {photo.likes_count > 0 ? photo.likes_count : ''}
            </span>
          </button>
        </div>
        {photo.description && (
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, margin: 0 }}>
            {photo.description}
          </p>
        )}
      </div>
    </div>
  )
}

function StatItem({ value, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <span style={{ display: 'block', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--accent-text)', lineHeight: 1 }}>{value}</span>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 7 }}>{label}</span>
    </div>
  )
}

// Bottom sheet de signalement
function ReportModal({ userId, onClose, onSent }) {
  const [selected, setSelected] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit() {
    if (!selected) return
    setSending(true)
    setError(null)
    try {
      await api.post('/reports', { reported_user_id: userId, reason: selected })
      onSent()
    } catch (err) {
      setError(err.response?.data?.detail || 'Une erreur est survenue.')
      setSending(false)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      {/* Sheet */}
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 600, zIndex: 201, background: 'var(--surface2)', borderRadius: '20px 20px 0 0', borderTop: '1px solid var(--border-color)', padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Poignée */}
        <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--border-color)', margin: '-4px auto 8px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--text)', margin: 0 }}>
            Signaler ce profil
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          Choisis le motif de ton signalement. Notre équipe examinera le contenu sous 24h.
        </p>

        {/* Motifs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {REPORT_REASONS.map(r => (
            <button
              key={r.key}
              onClick={() => setSelected(r.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: selected === r.key ? 'rgba(255,77,77,0.08)' : 'var(--bg)',
                border: `1.5px solid ${selected === r.key ? 'rgba(255,77,77,0.4)' : 'var(--border-color)'}`,
                borderRadius: 11, padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.1s',
              }}
            >
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: selected === r.key ? '#FF4D4D' : 'var(--text)', flex: 1, fontWeight: selected === r.key ? 600 : 400 }}>
                {r.label}
              </span>
              {selected === r.key && (
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#FF4D4D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              )}
            </button>
          ))}
        </div>

        {error && <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: '#FF4D4D', margin: 0, textAlign: 'center' }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!selected || sending}
          style={{
            width: '100%', background: selected ? 'rgba(255,77,77,0.12)' : 'var(--surface2)',
            border: `1.5px solid ${selected ? 'rgba(255,77,77,0.4)' : 'var(--border-color)'}`,
            borderRadius: 11, padding: '14px 0',
            color: selected ? '#FF4D4D' : 'var(--text-tertiary)',
            fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 15,
            cursor: !selected || sending ? 'not-allowed' : 'pointer',
            opacity: sending ? 0.7 : 1, transition: 'all 0.15s',
            marginTop: 4,
          }}
        >
          {sending ? 'Envoi…' : 'Envoyer le signalement'}
        </button>
      </div>
    </>
  )
}

function FriendButton({ status, loading, onAction }) {
  const base = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 12, padding: '11px 20px', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'all 0.15s' }
  if (status === 'none') return <button onClick={() => onAction('send')} style={{ ...base, background: 'var(--accent)', color: 'var(--bg)' }}><UserPlus size={16} />Ajouter en ami</button>
  if (status === 'request_sent') return <button onClick={() => onAction('reject')} style={{ ...base, background: 'var(--surface2)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}><Clock size={16} />Demande envoyée</button>
  if (status === 'request_received') return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => onAction('accept')} style={{ ...base, flex: 1, background: 'var(--accent)', color: 'var(--bg)' }}><UserCheck size={16} />Accepter</button>
      <button onClick={() => onAction('reject')} style={{ ...base, flex: 1, background: 'var(--surface2)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}><UserX size={16} />Refuser</button>
    </div>
  )
  if (status === 'friends') return <button onClick={() => onAction('remove')} style={{ ...base, background: 'var(--surface2)', color: 'var(--green)', border: '1px solid rgba(61,219,130,0.3)' }}><UserCheck size={16} />Amis</button>
  if (status === 'blocked') return <button disabled style={{ ...base, background: 'var(--surface2)', color: '#FF4D4D', border: '1px solid rgba(255,77,77,0.3)', cursor: 'not-allowed' }}><ShieldBan size={16} />Bloqué</button>
  // Fallback — traiter tout statut inconnu comme "none" pour ne pas cacher le bouton
  return <button onClick={() => onAction('send')} style={{ ...base, background: 'var(--accent)', color: 'var(--bg)' }}><UserPlus size={16} />Ajouter en ami</button>
}
