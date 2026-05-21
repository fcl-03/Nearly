import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { getCat, formatTime, formatLastMessage } from '../../utils/categories'
import Spinner from '../../components/ui/Spinner'

// Page des messages — sorties actives + messages privés (DM)
export default function MessagesPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('active') // active | dm

  const [events, setEvents] = useState([])
  const [unreadCounts, setUnreadCounts] = useState({})
  const [eventsLoading, setEventsLoading] = useState(true)

  const [dmConvos, setDmConvos] = useState([])
  const [dmLoading, setDmLoading] = useState(false)
  const [dmUnread, setDmUnread] = useState(0)

  // Chargement initial : events + unread counts
  useEffect(() => {
    Promise.all([
      api.get('/events/joined'),
      api.get('/events/unread-counts'),
    ])
      .then(([eventsRes, unreadRes]) => {
        setEvents(eventsRes.data)
        setUnreadCounts(unreadRes.data)
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false))
  }, [])

  // Polling events + unread toutes les 15s
  useEffect(() => {
    const interval = setInterval(() => {
      Promise.all([
        api.get('/events/joined'),
        api.get('/events/unread-counts'),
      ])
        .then(([eventsRes, unreadRes]) => {
          setEvents(eventsRes.data)
          setUnreadCounts(unreadRes.data)
        })
        .catch(() => {})
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  // Charger les DMs quand on passe sur l'onglet MP (ou au démarrage pour le badge)
  useEffect(() => {
    api.get('/dm/unread-count').then(({ data }) => setDmUnread(data.count ?? 0)).catch(() => {})
  }, [])

  useEffect(() => {
    if (tab !== 'dm') return
    setDmLoading(true)
    api.get('/dm/conversations')
      .then(({ data }) => setDmConvos(data))
      .catch(() => {})
      .finally(() => setDmLoading(false))
  }, [tab])

  // Polling DMs toutes les 10s quand l'onglet est actif
  useEffect(() => {
    if (tab !== 'dm') return
    const interval = setInterval(() => {
      api.get('/dm/conversations').then(({ data }) => setDmConvos(data)).catch(() => {})
    }, 10000)
    return () => clearInterval(interval)
  }, [tab])

  // Trier : actives en premier (par date croissante), passées ensuite (par date décroissante)
  const sortedEvents = [...events].sort((a, b) => {
    const aActive = new Date(a.starts_at) >= new Date()
    const bActive = new Date(b.starts_at) >= new Date()
    if (aActive && !bActive) return -1
    if (!aActive && bActive) return 1
    if (aActive) return new Date(a.starts_at) - new Date(b.starts_at)
    return new Date(b.starts_at) - new Date(a.starts_at)
  })

  // Compter les non-lus events
  const totalEventUnread = Object.values(unreadCounts).reduce((s, n) => s + n, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ── En-tête ── */}
      <div style={{ padding: '36px 20px 16px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 24, color: 'var(--text)', margin: 0 }}>
          Messages
        </h1>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid var(--border-color)', marginBottom: 8 }}>
        <TabBtn
          active={tab === 'active'}
          onClick={() => setTab('active')}
          badge={totalEventUnread > 0 ? totalEventUnread : null}
        >
          Sorties
        </TabBtn>
        <TabBtn
          active={tab === 'dm'}
          onClick={() => setTab('dm')}
          badge={dmUnread > 0 ? dmUnread : null}
        >
          Messages privés
        </TabBtn>
      </div>

      {/* ── Contenu ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'active' && (
          eventsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <Spinner />
            </div>
          ) : sortedEvents.length === 0 ? (
            <EmptyState icon="💬" text="Rejoins une sortie pour démarrer un chat" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 20px' }}>
              {sortedEvents.map(event => {
                const isPast = new Date(event.starts_at) < new Date()
                return (
                  <EventConversationRow
                    key={event.id}
                    event={event}
                    unread={unreadCounts[event.id] || 0}
                    onClick={() => navigate(`/messages/${event.id}`)}
                    isPast={isPast}
                  />
                )
              })}
            </div>
          )
        )}

        {tab === 'dm' && (
          dmLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <Spinner />
            </div>
          ) : dmConvos.length === 0 ? (
            <EmptyState icon="✉️" text="Ajoute des amis pour leur envoyer des messages privés" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 20px' }}>
              {dmConvos.map(convo => (
                <DMConversationRow
                  key={convo.partner.id}
                  convo={convo}
                  onClick={() => navigate(`/dm/${convo.partner.id}`)}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

// Onglet
function TabBtn({ active, onClick, children, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px 0',
        background: 'none',
        border: 'none',
        borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        color: active ? 'var(--accent)' : 'var(--text-tertiary)',
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 14,
        fontWeight: active ? 700 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
        marginBottom: -1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {children}
      {badge && (
        <span
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            padding: '1px 6px',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

// Ligne conversation de sortie
function EventConversationRow({ event, unread, onClick, isPast }) {
  const cat = getCat(event.category)
  const { time, label } = formatTime(event.starts_at)
  const isActive = new Date(event.starts_at) >= new Date()
  const lastMsgTime = formatLastMessage(event.last_message_at)

  // Calcul du nombre de jours restants avant suppression du chat (7 jours après la sortie)
  const daysLeft = isPast
    ? Math.max(0, 7 - Math.floor((Date.now() - new Date(event.starts_at)) / 86400000))
    : null

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        background: 'var(--surface2)',
        border: 'none',
        borderRadius: 18,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: `${cat.color}15`,
            border: `1.5px solid ${cat.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}
        >
          {cat.emoji}
        </div>
        {isActive && (
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', border: '2px solid var(--surface2)' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 11, color: cat.color, fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>{cat.label}</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {event.participants_count} membre{event.participants_count > 1 ? 's' : ''}</span>
        </div>
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
          {event.title}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lastMsgTime ? `Dernier msg · ${lastMsgTime}` : `${time} · ${label}`}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        {unread > 0 && (
          <div style={{ minWidth: 20, height: 20, borderRadius: 999, background: 'var(--accent)', color: 'var(--bg)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
            {unread > 99 ? '99+' : unread}
          </div>
        )}
        {daysLeft !== null && (
          <span style={{
            fontSize: 10,
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 600,
            color: daysLeft <= 1 ? 'var(--orange)' : 'var(--text-tertiary)',
            whiteSpace: 'nowrap',
          }}>
            {daysLeft === 0 ? 'Expire aujourd\'hui' : `Expire dans ${daysLeft}j`}
          </span>
        )}
      </div>
    </button>
  )
}

// Ligne conversation DM
function DMConversationRow({ convo, onClick }) {
  const { partner, last_message, last_message_at, unread_count } = convo
  const lastMsgTime = formatLastMessage(last_message_at)

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        background: 'var(--surface2)',
        border: 'none',
        borderRadius: 18,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
    >
      {/* Avatar */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--bg)',
          border: '2px solid var(--border-color)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          flexShrink: 0,
        }}
      >
        {partner.avatar_url
          ? <img src={partner.avatar_url} alt={partner.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : partner.first_name?.[0]?.toUpperCase()
        }
      </div>

      {/* Infos */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
            {partner.first_name}
            {partner.is_verified && <span style={{ color: 'var(--green)', fontSize: 11 }}>✓</span>}
          </p>
          {lastMsgTime && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>· {lastMsgTime}</span>}
        </div>
        <p style={{ fontSize: 12, color: unread_count > 0 ? 'var(--text)' : 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: unread_count > 0 ? 600 : 400 }}>
          {last_message}
        </p>
      </div>

      {/* Badge non lus */}
      {unread_count > 0 && (
        <div style={{ flexShrink: 0, minWidth: 20, height: 20, borderRadius: 999, background: 'var(--accent)', color: 'var(--bg)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
          {unread_count > 99 ? '99+' : unread_count}
        </div>
      )}
    </button>
  )
}

// État vide générique
function EmptyState({ icon, text }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', color: 'var(--text-tertiary)', gap: 12 }}>
      <span style={{ fontSize: 44 }}>{icon}</span>
      <p style={{ fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>{text}</p>
    </div>
  )
}
