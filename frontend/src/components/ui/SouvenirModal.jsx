import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, MapPin, CalendarDays, Users } from 'lucide-react'
import api from '../../services/api'
import { getCat } from '../../utils/categories'
import Spinner from './Spinner'

// Date + heure complètes d'une sortie souvenir
function formatFull(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const date = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const cap = date.charAt(0).toUpperCase() + date.slice(1)
  return `${cap} · ${time}`
}

// Résumé "X a fait cette sortie avec N autres personnes"
function summaryText(count, ownerName) {
  const others = Math.max(0, (count || 0) - 1)
  const subject = ownerName ? `${ownerName} a fait` : 'Tu as fait'
  if (others === 0) return `${subject} cette sortie`
  return `${subject} cette sortie avec ${others} autre${others > 1 ? 's' : ''} personne${others > 1 ? 's' : ''}`
}

// Récap "souvenir" d'une sortie passée — plein écran scrollable
export default function SouvenirModal({ eventId, ownerId, ownerName, onClose }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = ownerId ? `?owner_id=${ownerId}` : ''
    api.get(`/events/${eventId}/souvenir${q}`)
      .then(({ data }) => setData(data))
      .catch(() => onClose())
      .finally(() => setLoading(false))
  }, [eventId, ownerId])

  const cat = data ? getCat(data.category) : null

  function visitUser(id) {
    onClose()
    navigate(`/users/${id}`)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '14px 16px', flexShrink: 0, position: 'absolute', top: 0, right: 0, zIndex: 2 }}>
        <button onClick={onClose} aria-label="Fermer" style={{ background: 'rgba(0,0,0,0.45)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 8, borderRadius: 999 }}>
          <X size={22} />
        </button>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
      ) : !data ? null : (
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>
          {/* Cover */}
          <div style={{ position: 'relative', height: 240, background: data.cover_url ? 'var(--surface2)' : `linear-gradient(135deg, ${cat.color}45, ${cat.color}14)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {data.cover_url
              ? <img src={data.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 64 }}>{cat.emoji}</span>}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg), transparent 45%)' }} />
          </div>

          {/* Contenu */}
          <div style={{ padding: '4px 20px 0', marginTop: -8 }}>
            <span style={{ fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: cat.color, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {cat.emoji} {cat.label}
            </span>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text)', margin: '8px 0 0', lineHeight: 1.15 }}>
              {data.title}
            </h1>

            {/* Méta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              <Meta icon={<CalendarDays size={16} />} text={formatFull(data.starts_at)} />
              <Meta icon={<MapPin size={16} />} text={data.location_name} />
              <Meta icon={<Users size={16} />} text={summaryText(data.participants_count, ownerName)} />
            </div>

            {/* Participants */}
            {data.participants?.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <p style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 14 }}>
                  Qui était là
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  {data.participants.map(p => (
                    <button key={p.id} onClick={() => visitUser(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 60 }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--surface2)', border: '2px solid var(--border-color)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Syne, sans-serif' }}>
                        {p.avatar_url ? <img src={p.avatar_url} alt={p.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.first_name?.[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Sans, sans-serif', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.first_name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {data.description && (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 24 }}>
                {data.description}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Meta({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 13.5 }}>
      <span style={{ display: 'flex', color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span>{text}</span>
    </div>
  )
}
