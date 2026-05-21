import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import api from '../../services/api'

// Icône et couleur selon le type de notification
function notifMeta(type) {
  switch (type) {
    case 'friend_request':   return { emoji: '👋', color: '#7C6FF7' }
    case 'friend_accepted':  return { emoji: '🤝', color: '#3DDB82' }
    case 'badge_received':   return { emoji: '🏅', color: '#E8FF47' }
    case 'event_joined':     return { emoji: '🎉', color: '#FF7A3D' }
    case 'event_invite':     return { emoji: '📩', color: '#E8FF47' }
    case 'new_dm':           return { emoji: '💬', color: '#7C6FF7' }
    default:                 return { emoji: '🔔', color: '#858AA8' }
  }
}

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60)  return "À l'instant"
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`
  return new Date(isoString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/notifications')
        setNotifs(data)
        // Marquer toutes comme lues en arrière-plan
        api.patch('/notifications/read-all')
          .then(() => window.dispatchEvent(new Event('notifications-updated')))
          .catch(() => {})
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [])

  function handleTap(notif) {
    switch (notif.type) {
      case 'friend_request':
      case 'friend_accepted':
        if (notif.actor?.id) navigate(`/users/${notif.actor.id}`)
        break
      case 'badge_received':
        if (notif.actor?.id) navigate(`/users/${notif.actor.id}`)
        break
      case 'event_joined':
        if (notif.related_id) navigate(`/events/${notif.related_id}`)
        break
      case 'event_invite':
        if (notif.related_id) navigate(`/events/${notif.related_id}`)
        break
      case 'new_dm':
        if (notif.actor?.id) navigate(`/dm/${notif.actor.id}`)
        break
    }
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 0, display: 'flex' }}
        >
          <ArrowLeft size={22} />
        </button>
        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: 20,
          color: 'var(--text-primary)',
          margin: 0,
        }}>
          Notifications
        </h1>
      </div>

      {/* Contenu */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : notifs.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'DM Sans, sans-serif', fontSize: 15 }}>
            Aucune notification pour l'instant
          </p>
        </div>
      ) : (
        <div>
          {notifs.map(notif => {
            const { emoji, color } = notifMeta(notif.type)
            return (
              <button
                key={notif.id}
                onClick={() => handleTap(notif)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 20px',
                  background: notif.is_read ? 'transparent' : 'color-mix(in srgb, var(--accent) 4%, transparent)',
                  border: 'none',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {/* Avatar acteur ou icône */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {notif.actor?.avatar_url ? (
                    <img
                      src={notif.actor.avatar_url}
                      alt=""
                      style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: 46, height: 46, borderRadius: '50%',
                      background: 'var(--surface2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>
                      {notif.actor?.first_name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  {/* Badge type */}
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 20, height: 20, borderRadius: '50%',
                    background: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11,
                    border: '2px solid var(--bg)',
                  }}>
                    {emoji}
                  </div>
                </div>

                {/* Texte */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 14,
                    color: 'var(--text-primary)',
                    margin: 0,
                    fontWeight: notif.is_read ? 400 : 600,
                    lineHeight: 1.4,
                  }}>
                    {notif.content}
                  </p>
                  <p style={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    margin: '2px 0 0',
                  }}>
                    {timeAgo(notif.created_at)}
                  </p>
                </div>

                {/* Point non-lu */}
                {!notif.is_read && (
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--accent)',
                    flexShrink: 0,
                  }} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
