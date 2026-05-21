import { useNavigate } from 'react-router-dom'
import { getCat, formatTime } from '../../utils/categories'

// Carte d'événement — Figma: ActivityCard
export default function EventCard({ event, onUpdate }) {
  const navigate = useNavigate()
  const cat = getCat(event.category)
  const { time, label } = formatTime(event.starts_at)
  const placesLeft = event.max_participants
    ? event.max_participants - event.participants_count
    : null
  const isPremiumCreator = event.creator?.is_premium

  // Couleur des places restantes selon disponibilité
  const spotsColor = event.is_full
    ? 'var(--text-tertiary)'
    : placesLeft === 1
    ? 'var(--orange)'
    : 'var(--green)'

  const displayedParticipants = (event.participants || []).slice(0, 4)

  const card = (
    <button
      onClick={() => navigate(`/events/${event.id}`)}
      className="press-scale"
      style={{
        width: '100%',
        textAlign: 'left',
        background: isPremiumCreator
          ? 'linear-gradient(135deg, var(--premium-bg) 0%, var(--surface) 60%)'
          : 'var(--surface)',
        border: `1px solid ${cat.color}35`,
        borderTop: `1px solid rgba(255,255,255,0.08)`,
        borderRadius: 20,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'pointer',
        position: 'relative',
        zIndex: 1,
        boxShadow: `0 0 0 1px ${cat.color}12, 0 8px 32px rgba(0,0,0,0.5), 0 0 24px ${cat.color}08`,
      }}
    >
      {/* Badge Premium en haut de la carte */}
      {isPremiumCreator && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: -4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#FFB800', fontFamily: 'Syne, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ⭐ Sortie Premium
          </span>
        </div>
      )}

      {/* En-tête : catégorie + badge heure */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: cat.color }}>
          {cat.emoji} {cat.label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: cat.color, background: `${cat.color}15`, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {time} · {label}
        </span>
      </div>

      {/* Titre */}
      <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)', lineHeight: 1.35, margin: 0 }}>
        {event.title}
      </h3>

      {/* Pied de carte : avatars + places */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {displayedParticipants.map((p, i) => (
              <div
                key={p.id}
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: `${cat.color}30`, border: `1.5px solid ${cat.color}`,
                  marginLeft: i === 0 ? 0 : -8, flexShrink: 0, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: cat.color,
                }}
              >
                {p.avatar_url
                  ? <img src={p.avatar_url} alt={p.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : p.first_name?.[0]?.toUpperCase()
                }
              </div>
            ))}
          </div>
          {event.participants_count > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>
              {event.participants_count} membre{event.participants_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {placesLeft !== null && (
          <span style={{ fontSize: 11, fontWeight: 600, color: spotsColor, background: `${spotsColor}20`, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {event.is_full ? 'Complet' : `${placesLeft} place${placesLeft > 1 ? 's' : ''}`}
          </span>
        )}
      </div>

      {/* Badge "Rejoint" */}
      {event.is_joined && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'rgba(232,255,71,0.1)', border: '1px solid rgba(232,255,71,0.2)', borderRadius: 999, padding: '3px 10px', alignSelf: 'flex-start' }}>
          ✓ Rejoint
        </div>
      )}
    </button>
  )

  if (!isPremiumCreator) return card

  // Wrapper animé pour les sorties premium : spotlight doré qui tourne autour du contour
  return (
    <>
      <style>{`
        @keyframes premiumSpin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes premiumGlow {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
      `}</style>
      <div style={{ position: 'relative', borderRadius: 22, padding: 2, animation: 'premiumGlow 2.5s ease-in-out infinite', boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(255,184,0,0.12)' }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', width: '220%', height: '220%',
            background: 'conic-gradient(transparent 0deg, transparent 250deg, rgba(255,184,0,0.6) 285deg, #FFE566 310deg, rgba(255,184,0,0.6) 335deg, transparent 360deg)',
            animation: 'premiumSpin 2.5s linear infinite',
            pointerEvents: 'none',
          }} />
        </div>
        {card}
      </div>
    </>
  )
}
