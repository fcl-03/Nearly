import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserCheck, UserX, Search, UserPlus, UserMinus, Flag, MoreVertical, MessageCircle, ShieldBan, User as UserIcon, Users, Inbox, Compass, Ban, MapPin } from 'lucide-react'
import api from '../../services/api'
import Spinner from '../../components/ui/Spinner'
import SectionLabel from '../../components/ui/SectionLabel'

// Formate la dernière activité en libellé relatif court
function formatLastActive(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 2) return { online: true, label: 'En ligne' }
  if (min < 60) return { online: false, label: `il y a ${min} min` }
  const h = Math.floor(min / 60)
  if (h < 24) return { online: false, label: `il y a ${h} h` }
  const d = Math.floor(h / 24)
  if (d < 7) return { online: false, label: `il y a ${d} j` }
  const w = Math.floor(d / 7)
  if (w < 5) return { online: false, label: `il y a ${w} sem` }
  return { online: false, label: new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }
}

// Page sociale — onglets Liste d'amis / Demandes / Découvrir + recherche
export default function FriendsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('friends') // friends | requests | discover
  const [requests, setRequests] = useState(null)
  const [friends, setFriends] = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  // Recherche
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [addLoading, setAddLoading] = useState(null)
  const [addError, setAddError] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    api.get('/users/me/friend-requests').then(({ data }) => setRequests(data)).catch(() => setRequests([]))
    api.get('/users/me/friends').then(({ data }) => setFriends(data)).catch(() => setFriends([]))
    api.get('/users/me/suggestions').then(({ data }) => setSuggestions(data)).catch(() => setSuggestions([]))
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

  // ── Demandes : accepter / refuser ──
  async function handleRequestAction(userId, action) {
    setActionLoading(userId)
    try {
      if (action === 'accept') {
        await api.post(`/users/${userId}/friend-accept`)
        const user = requests.find(u => u.id === userId)
        setRequests(prev => prev.filter(u => u.id !== userId))
        if (user) setFriends(prev => [{ ...user, friendship_status: 'friends' }, ...(prev || [])])
      }
      if (action === 'reject') {
        await api.post(`/users/${userId}/friend-reject`)
        setRequests(prev => prev.filter(u => u.id !== userId))
      }
      window.dispatchEvent(new CustomEvent('friend-requests-updated'))
    } catch { /* erreur silencieuse */ }
    finally { setActionLoading(null) }
  }

  // ── Ajouter en ami (recherche / découvrir / suggestions) ──
  async function handleAdd(userId) {
    setAddLoading(userId)
    setAddError(null)
    try {
      await api.post(`/users/${userId}/friend-request`)
      const markSent = list => list?.map(u => u.id === userId ? { ...u, _sent: true } : u)
      setSearchResults(markSent)
      setSuggestions(markSent)
    } catch (err) {
      setAddError(err.response?.data?.detail || 'Erreur lors de l\'envoi de la demande.')
    }
    finally { setAddLoading(null) }
  }

  async function handleUnblock(userId) {
    setAddLoading(userId)
    try {
      await api.delete(`/users/${userId}/block`)
      setSearchResults(prev => prev?.map(u => u.id === userId ? { ...u, friendship_status: 'none' } : u))
    } catch { /* erreur silencieuse */ }
    finally { setAddLoading(null) }
  }

  // ── Actions du menu ⋮ sur une carte d'ami ──
  async function handleRemoveFriend(userId) {
    if (!confirm('Retirer cet ami ?')) return
    try {
      await api.delete(`/users/${userId}/friend`)
      setFriends(prev => prev.filter(u => u.id !== userId))
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur.')
    }
  }

  async function handleBlock(userId) {
    if (!confirm('Bloquer cet utilisateur ? Il ne pourra plus te contacter ni voir ton profil.')) return
    try {
      await api.post(`/users/${userId}/block`)
      setFriends(prev => prev.filter(u => u.id !== userId))
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur.')
    }
  }

  async function handleReport(userId) {
    if (!confirm('Signaler cet utilisateur ?')) return
    try {
      await api.post('/reports', { reported_user_id: userId, reason: 'Signalement depuis la liste d\'amis' })
      alert('Signalement envoyé.')
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors du signalement.')
    }
  }

  const loading = requests === null || friends === null
  const showSearch = query.trim().length >= 2
  const reqCount = requests?.length ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ── Header : titre + recherche ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border-color)',
        padding: '30px 20px 0',
      }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text)', margin: '0 0 12px' }}>
          Amis
        </h1>

        {/* Barre de recherche */}
        <div style={{ position: 'relative', marginBottom: 4 }}>
          <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher par @pseudo ou nom"
            type="search"
            name="friend-search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            style={{
              width: '100%', background: 'var(--surface2)', border: '1px solid var(--border-color)',
              borderRadius: 11, padding: '10px 14px 10px 36px', fontSize: 14, color: 'var(--text)',
              fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Onglets */}
        {!showSearch && (
          <div className="nearly-hscroll" style={{ display: 'flex', marginTop: 8, overflowX: 'auto' }}>
            <Tab label="Liste d'amis" count={friends?.length} active={tab === 'friends'} onClick={() => setTab('friends')} />
            <Tab label="Demandes" count={reqCount} highlight={reqCount > 0} active={tab === 'requests'} onClick={() => setTab('requests')} />
            <Tab label="Découvrir" active={tab === 'discover'} onClick={() => setTab('discover')} />
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 64 }}><Spinner /></div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>

          {/* ── Mode recherche ── */}
          {showSearch ? (
            <section style={{ padding: '16px 20px' }}>
              <SectionLabel>Résultats</SectionLabel>
              {addError && <p style={{ fontSize: 13, color: 'var(--orange)', marginBottom: 10, fontFamily: 'DM Sans, sans-serif' }}>{addError}</p>}
              {searching ? (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20 }}><Spinner /></div>
              ) : searchResults?.length === 0 ? (
                <p style={{ fontSize: 14, color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: 24 }}>
                  Aucun résultat pour « {query.replace(/^@/, '')} »
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {searchResults?.map(u => (
                    <SearchResultCard
                      key={u.id} user={u} loading={addLoading === u.id}
                      onVisit={() => navigate(`/users/${u.id}`)}
                      onAdd={() => handleAdd(u.id)}
                      onUnblock={() => handleUnblock(u.id)}
                      onReport={() => handleReport(u.id)}
                    />
                  ))}
                </div>
              )}
            </section>

          /* ── Onglet : Liste d'amis ── */
          ) : tab === 'friends' ? (
            <>
              {/* Carrousel suggestions */}
              {suggestions?.length > 0 && (
                <section style={{ padding: '18px 0 0' }}>
                  <div style={{ padding: '0 20px' }}><SectionLabel>Suggestions</SectionLabel></div>
                  <div className="nearly-hscroll" style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '4px 20px 14px' }}>
                    {suggestions.slice(0, 12).map(u => (
                      <SuggestionAvatar
                        key={u.id} user={u} loading={addLoading === u.id}
                        onClick={() => navigate(`/users/${u.id}`)}
                        onAdd={() => handleAdd(u.id)}
                      />
                    ))}
                  </div>
                  {/* Ligne de séparation */}
                  <div style={{ height: 1, background: 'var(--border-color)', margin: '0 20px' }} />
                </section>
              )}

              {/* Liste d'amis */}
              <section style={{ padding: '12px 20px 8px' }}>
                {friends.length > 0 && <SectionLabel>{friends.length} ami{friends.length > 1 ? 's' : ''}</SectionLabel>}
                {friends.length === 0 ? (
                  <EmptyFriends onDiscover={() => setTab('discover')} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {friends.map(user => (
                      <FriendCard
                        key={user.id} user={user}
                        onVisit={() => navigate(`/users/${user.id}`)}
                        onMessage={() => navigate(`/dm/${user.id}`)}
                        onRemove={() => handleRemoveFriend(user.id)}
                        onBlock={() => handleBlock(user.id)}
                        onReport={() => handleReport(user.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>

          /* ── Onglet : Demandes ── */
          ) : tab === 'requests' ? (
            <section style={{ padding: '20px 20px 8px' }}>
              {reqCount === 0 ? (
                <EmptyMessage icon={<Inbox size={36} />} title="Aucune demande" text="Les demandes d'ami reçues apparaîtront ici." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {requests.map(user => (
                    <RequestCard
                      key={user.id} user={user} loading={actionLoading === user.id}
                      onAction={(action) => handleRequestAction(user.id, action)}
                      onVisit={() => navigate(`/users/${user.id}`)}
                    />
                  ))}
                </div>
              )}
            </section>

          /* ── Onglet : Découvrir ── */
          ) : (
            <section style={{ padding: '20px 20px 8px' }}>
              <SectionLabel>Dans ta ville</SectionLabel>
              {addError && <p style={{ fontSize: 13, color: 'var(--orange)', marginBottom: 10, fontFamily: 'DM Sans, sans-serif' }}>{addError}</p>}
              {suggestions === null ? (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20 }}><Spinner /></div>
              ) : suggestions.length === 0 ? (
                <EmptyMessage icon={<Compass size={36} />} title="Personne pour l'instant" text="On te suggérera des membres vérifiés de ta ville. Vérifie que ta ville est renseignée dans ton profil." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {suggestions.map(u => (
                    <SearchResultCard
                      key={u.id} user={u} loading={addLoading === u.id} showActivity
                      onVisit={() => navigate(`/users/${u.id}`)}
                      onAdd={() => handleAdd(u.id)}
                      onUnblock={() => handleUnblock(u.id)}
                      onReport={() => handleReport(u.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ── Onglet ──
function Tab({ label, count, active, highlight, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '8px 0 12px', marginRight: 20, flexShrink: 0, whiteSpace: 'nowrap',
        fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        color: active ? 'var(--accent-text)' : 'var(--text-tertiary)',
        borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'color 0.15s',
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 800, fontFamily: 'DM Sans, sans-serif',
          background: highlight ? 'var(--accent)' : 'var(--surface2)',
          color: highlight ? 'var(--bg)' : 'var(--text-secondary)',
          borderRadius: 999, padding: '1px 6px', minWidth: 16, textAlign: 'center',
        }}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── Avatar de suggestion (carrousel) avec bouton + ajouter rapide ──
function SuggestionAvatar({ user, onClick, onAdd, loading }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 80, flexShrink: 0 }}>
      <div style={{ position: 'relative' }}>
        <button onClick={onClick} aria-label={`Voir ${user.first_name}`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block' }}>
          <Avatar user={user} size={76} />
        </button>
        {/* Bouton + ajouter rapide (ou ✓ si déjà envoyé) */}
        {user._sent ? (
          <span style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--green)', border: '3px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--bg)', fontWeight: 900 }}>✓</span>
        ) : (
          <button
            onClick={onAdd}
            disabled={loading}
            aria-label={`Ajouter ${user.first_name}`}
            style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', border: '3px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, padding: 0 }}
          >
            <UserPlus size={13} color="var(--bg)" strokeWidth={2.8} />
          </button>
        )}
      </div>
      <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {user.first_name}
      </button>
    </div>
  )
}

// ── Carte d'ami (avec menu ⋮) ──
function FriendCard({ user, onVisit, onMessage, onRemove, onBlock, onReport }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const activity = formatLastActive(user.last_active_at)
  return (
    <div style={{ position: 'relative', background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <button onClick={onVisit} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
        <Avatar user={user} size={48} />
      </button>
      <button onClick={onVisit} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          {user.first_name}
          {user.is_verified && <span style={{ color: 'var(--green)', fontSize: 11 }}>✓</span>}
        </p>
        {user.username && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>@{user.username}</p>}
        {activity && (
          <p style={{ fontSize: 11, color: activity.online ? 'var(--green)' : 'var(--text-tertiary)', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
            {activity.online && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />}
            {activity.online ? 'En ligne' : `Dernière activité ${activity.label}`}
          </p>
        )}
      </button>

      {/* Menu ⋮ */}
      <button onClick={() => setMenuOpen(o => !o)} aria-label="Actions" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 4, flexShrink: 0 }}>
        <MoreVertical size={18} />
      </button>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: 48, right: 12, zIndex: 41, background: 'var(--surface1, var(--bg))', border: '1px solid var(--border-color)', borderRadius: 12, padding: 6, minWidth: 180, boxShadow: '0 8px 28px rgba(0,0,0,0.4)' }}>
            <MenuItem icon={<UserIcon size={15} />} label="Voir le profil" onClick={() => { setMenuOpen(false); onVisit() }} />
            <MenuItem icon={<MessageCircle size={15} />} label="Envoyer un message" onClick={() => { setMenuOpen(false); onMessage() }} />
            <MenuItem icon={<UserMinus size={15} />} label="Retirer l'ami" onClick={() => { setMenuOpen(false); onRemove() }} />
            <MenuItem icon={<ShieldBan size={15} />} label="Bloquer" danger onClick={() => { setMenuOpen(false); onBlock() }} />
            <MenuItem icon={<Flag size={15} />} label="Signaler" danger onClick={() => { setMenuOpen(false); onReport() }} />
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        padding: '9px 10px', borderRadius: 8, fontFamily: 'DM Sans, sans-serif',
        fontSize: 13, fontWeight: 500, color: danger ? '#FF4D4D' : 'var(--text)',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <span style={{ display: 'flex', color: danger ? '#FF4D4D' : 'var(--text-secondary)' }}>{icon}</span>
      {label}
    </button>
  )
}

// ── Résultat de recherche / suggestion avec bouton "Ajouter" ──
function SearchResultCard({ user, loading, onVisit, onAdd, onUnblock, onReport, showActivity }) {
  const isBlocked = user.friendship_status === 'blocked'
  const activity = showActivity ? formatLastActive(user.last_active_at) : null

  if (isBlocked) {
    return (
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.75 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface1, var(--bg))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-tertiary)' }}><Ban size={20} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>{user.first_name}</p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0', fontStyle: 'italic' }}>Utilisateur bloqué</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onUnblock} disabled={loading} title="Débloquer" style={{ background: 'var(--surface1, var(--bg))', color: 'var(--text)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 5 }}>
            <UserMinus size={13} /> Débloquer
          </button>
          <button onClick={onReport} title="Signaler" style={{ background: 'transparent', color: 'var(--orange)', border: '1px solid rgba(255,122,61,0.3)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Flag size={13} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={onVisit} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
        <Avatar user={user} size={48} />
      </button>
      <button onClick={onVisit} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          {user.first_name}
          {user.is_verified && <span style={{ color: 'var(--green)', fontSize: 11 }}>✓</span>}
        </p>
        {user.username && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>@{user.username}</p>}
        {activity && (
          <p style={{ fontSize: 11, color: activity.online ? 'var(--green)' : 'var(--text-tertiary)', margin: '3px 0 0' }}>
            {activity.online ? 'En ligne' : `Actif ${activity.label}`}
          </p>
        )}
      </button>
      {user._sent ? (
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>Envoyé</span>
      ) : (
        <button onClick={onAdd} disabled={loading} style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'DM Sans, sans-serif', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <UserPlus size={14} /> Ajouter
        </button>
      )}
    </div>
  )
}

// ── Carte de demande d'ami ──
function RequestCard({ user, loading, onAction, onVisit }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid rgba(232,255,71,0.15)', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
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
          {user.city && !user.username && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={11} /> {user.city}</p>}
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

function Avatar({ user, size }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--bg)', border: '2px solid var(--border-color)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.38), fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0, fontFamily: 'Syne, sans-serif' }}>
      {user.avatar_url
        ? <img src={user.avatar_url} alt={user.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : user.first_name?.[0]?.toUpperCase()}
    </div>
  )
}

function EmptyFriends({ onDiscover }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40, gap: 12 }}>
      <Users size={40} color="var(--text-tertiary)" strokeWidth={1.6} />
      <p style={{ fontSize: 16, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--text)', textAlign: 'center', margin: 0 }}>Pas encore d'amis</p>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', margin: 0, maxWidth: 240, lineHeight: 1.6 }}>
        Découvre des membres vérifiés de ta ville ou cherche un @username.
      </p>
      <button onClick={onDiscover} style={{ marginTop: 4, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 11, padding: '10px 18px', fontSize: 13, fontWeight: 700, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
        Découvrir des membres
      </button>
    </div>
  )
}

function EmptyMessage({ icon, title, text }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40, gap: 12 }}>
      <span style={{ color: 'var(--text-tertiary)', display: 'flex' }}>{icon}</span>
      <p style={{ fontSize: 15, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--text)', textAlign: 'center', margin: 0 }}>{title}</p>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', margin: 0, maxWidth: 260, lineHeight: 1.6 }}>{text}</p>
    </div>
  )
}

