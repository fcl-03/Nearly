import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, UserCheck, UserX } from 'lucide-react'
import api from '../../services/api'
import Spinner from '../../components/ui/Spinner'

// Page de gestion des demandes d'ami reçues
export default function FriendRequestsPage() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState(null) // null = chargement
  const [actionLoading, setActionLoading] = useState(null) // id de l'utilisateur en cours

  useEffect(() => {
    api.get('/users/me/friend-requests')
      .then(({ data }) => setRequests(data))
      .catch(() => setRequests([]))
  }, [])

  async function handleAction(userId, action) {
    setActionLoading(userId)
    try {
      if (action === 'accept') await api.post(`/users/${userId}/friend-accept`)
      if (action === 'reject') await api.post(`/users/${userId}/friend-reject`)
      // Supprimer de la liste après l'action
      setRequests(prev => prev.filter(u => u.id !== userId))
    } catch (err) {
      console.error('[FRIEND_REQUEST]', err)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* En-tête */}
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
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 4 }}
          aria-label="Retour"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text)', margin: 0, flex: 1 }}>
          Demandes d'ami
        </h1>
        {requests && requests.length > 0 && (
          <span
            style={{
              background: 'var(--accent)',
              color: 'var(--bg)',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {requests.length}
          </span>
        )}
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, padding: '16px 20px 40px' }}>
        {requests === null ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
            <Spinner />
          </div>
        ) : requests.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 64, gap: 12 }}>
            <span style={{ fontSize: 40 }}>👋</span>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center' }}>
              Aucune demande en attente
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
              Les nouvelles demandes d'ami apparaîtront ici
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        )}
      </div>
    </div>
  )
}

// Carte de demande d'ami
function RequestCard({ user, loading, onAction, onVisit }) {
  return (
    <div
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border-color)',
        borderRadius: 18,
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {/* Avatar cliquable → profil */}
      <button
        onClick={onVisit}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
        aria-label={`Voir le profil de ${user.first_name}`}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--bg)',
            border: '2px solid var(--border-color)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text-secondary)',
          }}
        >
          {user.avatar_url
            ? <img src={user.avatar_url} alt={user.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : user.first_name?.[0]?.toUpperCase()
          }
        </div>
      </button>

      {/* Nom + ville */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          onClick={onVisit}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
        >
          <p
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 15,
              color: 'var(--text)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {user.first_name}
            {user.is_verified && <span style={{ color: 'var(--green)', fontSize: 12 }}>✓</span>}
          </p>
          {user.city && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>📍 {user.city}</p>
          )}
        </button>
      </div>

      {/* Boutons accepter / refuser */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, opacity: loading ? 0.5 : 1 }}>
        <button
          onClick={() => onAction('accept')}
          disabled={loading}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'rgba(61,219,130,0.12)',
            border: '1.5px solid var(--green)',
            color: 'var(--green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
          aria-label="Accepter"
        >
          <UserCheck size={18} />
        </button>
        <button
          onClick={() => onAction('reject')}
          disabled={loading}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'rgba(255,122,61,0.1)',
            border: '1.5px solid rgba(255,122,61,0.4)',
            color: 'var(--orange)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
          aria-label="Refuser"
        >
          <UserX size={18} />
        </button>
      </div>
    </div>
  )
}
