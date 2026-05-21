import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserCheck, UserX, Search, UserPlus } from 'lucide-react'
import api from '../../services/api'
import Spinner from '../../components/ui/Spinner'

// Page sociale — recherche, demandes d'ami + liste des amis
export default function FriendsPage() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState(null)
  const [friends, setFriends] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  // Recherche
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null) // null = pas de recherche active
  const [searching, setSearching] = useState(false)
  const [addLoading, setAddLoading] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    api.get('/users/me/friend-requests').then(({ data }) => setRequests(data)).catch(() => setRequests([]))
    api.get('/users/me/friends').then(({ data }) => setFriends(data)).catch(() => setFriends([]))
  }, [])

  // Recherche avec debounce 350ms
  useEffect(() => {
    clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2) {
      setSearchResults(null)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`)
        setSearchResults(data)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  async function handleAction(userId, action) {
    setActionLoading(userId)
    try {
      if (action === 'accept') {
        await api.post(`/users/${userId}/friend-accept`)
        const user = requests.find(u => u.id === userId)
        setRequests(prev => prev.filter(u => u.id !== userId))
        if (user) setFriends(prev => [{ ...user, friendship_status: 'friends' }, ...prev])
      }
      if (action === 'reject') {
        await api.post(`/users/${userId}/friend-reject`)
        setRequests(prev => prev.filter(u => u.id !== userId))
      }
      // Signaler à BottomNav de rafraîchir le badge immédiatement
      window.dispatchEvent(new CustomEvent('friend-requests-updated'))
    } catch {}
    finally { setActionLoading(null) }
  }

  const [addError, setAddError] = useState(null)

  async function handleAdd(userId) {
    setAddLoading(userId)
    setAddError(null)
    try {
      await api.post(`/users/${userId}/friend-request`)
      // Marquer comme "demande envoyée" dans les résultats
      setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, _sent: true } : u))
    } catch (err) {
      const detail = err.response?.data?.detail
      setAddError(detail || 'Erreur lors de l\'envoi de la demande.')
    }
    finally { setAddLoading(null) }
  }

  const loading = requests === null || friends === null
  const showSearch = query.trim().length >= 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border-color)',
        padding: '16px 20px 14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text)', margin: 0 }}>
            Amis
          </h1>
          {!loading && requests?.length > 0 && (
            <span style={{
              background: 'var(--accent)', color: 'var(--bg)',
              borderRadius: 999, fontSize: 11, fontWeight: 700,
              padding: '3px 10px', fontFamily: 'DM Sans, sans-serif',
            }}>
              {requests.length} demande{requests.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Barre de recherche */}
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)', pointerEvents: 'none',
            }}
          />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher par @username"
            style={{
              width: '100%',
              background: 'var(--surface2)',
              border: '1px solid var(--border-color)',
              borderRadius: 11,
              padding: '10px 14px 10px 36px',
              fontSize: 14,
              color: 'var(--text)',
              fontFamily: 'DM Sans, sans-serif',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 64 }}>
          <Spinner />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>

          {/* ── Résultats de recherche (affiché en plus, pas à la place) ── */}
          {showSearch && (
            <section style={{ padding: '16px 20px' }}>
              <SectionLabel>Résultats</SectionLabel>
              {addError && (
                <p style={{ fontSize: 13, color: 'var(--orange)', marginBottom: 10, fontFamily: 'DM Sans, sans-serif' }}>
                  {addError}
                </p>
              )}
              {searching ? (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
                  <Spinner />
                </div>
              ) : searchResults?.length === 0 ? (
                <p style={{ fontSize: 14, color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: 24 }}>
                  Aucun résultat pour « {query.replace(/^@/, '')} »
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {searchResults?.map(u => (
                    <SearchResultCard
                      key={u.id}
                      user={u}
                      loading={addLoading === u.id}
                      onVisit={() => navigate(`/users/${u.id}`)}
                      onAdd={() => handleAdd(u.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Demandes reçues ── */}
          {requests.length > 0 && (
            <section style={{ padding: '20px 20px 8px' }}>
              <SectionLabel>Demandes reçues</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {requests.map(user => (
                  <RequestCard
                    key={user.id}
                    user={user}
                    loading={actionLoading === user.id}
                    onAction={(action) => handleAction(user.id, action)}
                    onVisit={() => navigate(`/users/${user.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Liste d'amis ── */}
          <section style={{ padding: `${requests.length > 0 || showSearch ? 16 : 20}px 20px 8px` }}>
            {friends.length > 0 && <SectionLabel>{friends.length} ami{friends.length > 1 ? 's' : ''}</SectionLabel>}
            {friends.length === 0 && requests.length === 0 && !showSearch ? (
              <EmptyState />
            ) : friends.length === 0 ? null : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {friends.map(user => (
                  <FriendCard
                    key={user.id}
                    user={user}
                    onVisit={() => navigate(`/users/${user.id}`)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

// Résultat de recherche avec bouton "Ajouter"
function SearchResultCard({ user, loading, onVisit, onAdd }) {
  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border-color)',
      borderRadius: 18,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <button onClick={onVisit} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
        <Avatar user={user} size={48} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <button onClick={onVisit} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
            {user.first_name}
            {user.is_verified && <span style={{ color: 'var(--green)', fontSize: 11 }}>✓</span>}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>@{user.username}</p>
        </button>
      </div>
      {user._sent ? (
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'DM Sans, sans-serif' }}>Envoyé</span>
      ) : (
        <button
          onClick={onAdd}
          disabled={loading}
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
            border: 'none',
            borderRadius: 10,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'DM Sans, sans-serif',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexShrink: 0,
          }}
        >
          <UserPlus size={14} />
          Ajouter
        </button>
      )}
    </div>
  )
}

// Carte de demande d'ami
function RequestCard({ user, loading, onAction, onVisit }) {
  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid rgba(232,255,71,0.15)',
      borderRadius: 18,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <button onClick={onVisit} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
        <Avatar user={user} size={50} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <button onClick={onVisit} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'block', width: '100%' }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            {user.first_name}
            {user.is_verified && <span style={{ color: 'var(--green)', fontSize: 11 }}>✓</span>}
          </p>
          {user.username && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>@{user.username}</p>}
          {user.city && !user.username && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>📍 {user.city}</p>}
        </button>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, opacity: loading ? 0.5 : 1 }}>
          <button onClick={() => onAction('accept')} disabled={loading} style={{ flex: 1, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 10, padding: '7px 0', fontSize: 12, fontWeight: 700, fontFamily: 'DM Sans, sans-serif', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <UserCheck size={14} /> Accepter
          </button>
          <button onClick={() => onAction('reject')} disabled={loading} style={{ flex: 1, background: 'var(--surface2)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '7px 0', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <UserX size={14} /> Refuser
          </button>
        </div>
      </div>
    </div>
  )
}

// Carte d'ami
function FriendCard({ user, onVisit }) {
  return (
    <button onClick={onVisit} style={{ background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
      <Avatar user={user} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          {user.first_name}
          {user.is_verified && <span style={{ color: 'var(--green)', fontSize: 11 }}>✓</span>}
        </p>
        {user.username
          ? <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>@{user.username}</p>
          : user.city && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>📍 {user.city}</p>
        }
      </div>
      <span style={{ color: 'var(--text-tertiary)', fontSize: 18, flexShrink: 0 }}>›</span>
    </button>
  )
}

function Avatar({ user, size }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--bg)', border: '2px solid var(--border-color)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.38), fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
      {user.avatar_url
        ? <img src={user.avatar_url} alt={user.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : user.first_name?.[0]?.toUpperCase()
      }
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 48, gap: 12 }}>
      <span style={{ fontSize: 44 }}>👥</span>
      <p style={{ fontSize: 16, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--text)', textAlign: 'center', margin: 0 }}>
        Pas encore d'amis
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', margin: 0, maxWidth: 240, lineHeight: 1.6 }}>
        Tape un @username dans la barre de recherche pour trouver quelqu'un
      </p>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
      {children}
    </p>
  )
}
