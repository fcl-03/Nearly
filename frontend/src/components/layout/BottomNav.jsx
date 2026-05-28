import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Map, MessageCircle, Users, User } from 'lucide-react'
import api from '../../services/api'

// Navigation fixe en bas — Figma: BottomNav
const ITEMS = [
  { to: '/events',   label: 'Carte',    Icon: Map },
  { to: '/messages', label: 'Messages', Icon: MessageCircle },
  { to: '/friends',  label: 'Amis',     Icon: Users },
  { to: '/profile',  label: 'Profil',   Icon: User },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const [friendRequestsCount, setFriendRequestsCount] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)

  // Charger le nombre de demandes d'ami pour le badge
  useEffect(() => {
    function fetchCount() {
      api.get('/users/me/friend-requests/count')
        .then(({ data }) => setFriendRequestsCount(data.count ?? 0))
        .catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    window.addEventListener('friend-requests-updated', fetchCount)
    return () => {
      clearInterval(interval)
      window.removeEventListener('friend-requests-updated', fetchCount)
    }
  }, [])

  // Charger le nombre de notifications non lues pour le badge Carte
  useEffect(() => {
    function fetchNotifs() {
      api.get('/notifications/unread-count')
        .then(({ data }) => setUnreadNotifs(data.count ?? 0))
        .catch(() => {})
    }
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 30000)
    window.addEventListener('notifications-updated', fetchNotifs)
    return () => {
      clearInterval(interval)
      window.removeEventListener('notifications-updated', fetchNotifs)
    }
  }, [])

  // Charger le nombre de messages non lus (chats de groupe + DMs privés)
  useEffect(() => {
    function fetchUnread() {
      Promise.all([
        api.get('/events/unread-counts').then(({ data }) => Object.values(data).reduce((s, n) => s + n, 0)).catch(() => 0),
        api.get('/dm/unread-count').then(({ data }) => data.count || 0).catch(() => 0),
      ]).then(([groupUnread, dmUnread]) => {
        setUnreadMessages(groupUnread + dmUnread)
      })
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    // Rafraîchir immédiatement quand un message arrive via WS
    window.addEventListener('unread-messages-updated', fetchUnread)
    return () => {
      clearInterval(interval)
      window.removeEventListener('unread-messages-updated', fetchUnread)
    }
  }, [])

  return (
    <nav
      aria-label="Navigation principale"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'var(--bg-blur)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border-color)',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      }}
    >
      <div
        className="nearly-bottomnav-inner"
        style={{
          maxWidth: 430,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-around',
          height: 56,
          alignItems: 'center',
        }}
      >
        {ITEMS.map(({ to, label, Icon }) => {
          const active = pathname === to || pathname.startsWith(to + '/')
          const hasBadge = (to === '/events' && unreadNotifs > 0) || (to === '/friends' && friendRequestsCount > 0) || (to === '/messages' && unreadMessages > 0)
          const badgeCount = to === '/events' ? unreadNotifs : to === '/friends' ? friendRequestsCount : unreadMessages
          return (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                color: active ? 'var(--accent-text)' : 'var(--text-tertiary)',
                textDecoration: 'none',
                transition: 'color 0.15s',
                position: 'relative',
              }}
            >
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <Icon size={24} strokeWidth={2} />
                {hasBadge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -6,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 999,
                      background: 'var(--accent)',
                      color: 'var(--bg)',
                      fontSize: 9,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 3px',
                      fontFamily: 'DM Sans, sans-serif',
                      border: '1.5px solid var(--bg)',
                    }}
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: active ? 700 : 500,
                  letterSpacing: '0.04em',
                  textShadow: 'none',
                }}
              >
                {label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
