import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import api from '../../services/api'
import { getCat } from '../../utils/categories'
import Spinner from '../../components/ui/Spinner'

// Page de chat groupe — Figma: GroupChat
export default function ChatPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [event, setEvent] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [votedPolls, setVotedPolls] = useState({}) // pollId → 'keep' | 'delete'
  const wsRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Charger l'événement
  useEffect(() => {
    api.get(`/events/${id}`)
      .then(r => setEvent(r.data))
      .catch(() => navigate('/messages', { replace: true }))
  }, [id])

  // Marquer comme lu au retour arrière — on await avant navigate pour éviter
  // la race condition (MessagesPage chargerait les counts AVANT que mark-read soit traité)
  async function handleBack() {
    try {
      await api.post(`/events/${id}/mark-read`)
    } catch {}
    // Rafraîchir le badge de messages non lus dans la BottomNav
    window.dispatchEvent(new Event('unread-messages-updated'))
    navigate(-1)
  }

  // Connexion WebSocket au chat
  useEffect(() => {
    // Le cookie httpOnly est envoyé automatiquement lors du handshake WebSocket
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/events/${id}/chat`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = e => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'history') {
        setMessages(msg.messages ?? [])
      } else if (msg.type !== 'pong') {
        setMessages(prev => [...prev, msg])
      }
    }

    // Ping toutes les 25s pour maintenir la connexion
    const ping = setInterval(() => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping' }))
    }, 25000)

    return () => { clearInterval(ping); ws.close() }
  }, [id])

  // Scroll automatique vers le bas à chaque nouveau message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function sendMessage(e) {
    e?.preventDefault()
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== 1) return
    wsRef.current.send(JSON.stringify({ type: 'message', content: input.trim() }))
    setInput('')
    // Reset la hauteur du textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.focus()
    }
  }

  function handleKeyDown(e) {
    // Entrée seule = envoyer, Shift+Entrée = saut de ligne
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handleInputChange(e) {
    setInput(e.target.value)
    // Auto-grow du textarea
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  if (!event) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}>
        <Spinner />
      </div>
    )
  }

  // Vérifier si l'utilisateur est le créateur (il ne vote pas)
  const isCreator = user?.id === event.creator?.id

  const cat = getCat(event.category)
  const isEventPast = new Date(event.starts_at) < new Date()
  const daysUntilExpiry = isEventPast
    ? Math.max(0, 7 - Math.floor((Date.now() - new Date(event.starts_at)) / 86400000))
    : null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        zIndex: 100,
      }}
    >
      {/* ── En-tête ── */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--bg)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleBack}
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

        {/* Avatar catégorie + titre cliquable → détail de l'événement */}
        <button
          onClick={() => navigate(`/events/${id}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
        >
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
              flexShrink: 0,
            }}
          >
            {cat.emoji}
          </div>

          {/* Titre + nb participants */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
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
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
            {event.participants_count} participant{event.participants_count > 1 ? 's' : ''}
            {connected && (
              <span style={{ color: 'var(--green)', marginLeft: 8 }}>● En ligne</span>
            )}
          </p>
          </div>
        </button>
      </div>

      {/* ── Bannière "après sortie" ── */}
      {isEventPast && (
        <div
          style={{
            padding: '10px 20px',
            background: daysUntilExpiry <= 1 ? 'rgba(255,122,61,0.08)' : 'rgba(232,255,71,0.05)',
            borderBottom: `1px solid ${daysUntilExpiry <= 1 ? 'rgba(255,122,61,0.2)' : 'rgba(232,255,71,0.12)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14 }}>💬</span>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            <strong style={{ color: daysUntilExpiry <= 1 ? 'var(--orange)' : 'var(--text)' }}>
              Chat après sortie
            </strong>
            {' — '}
            {daysUntilExpiry === 0
              ? 'Ce chat sera supprimé aujourd\'hui.'
              : `Ce chat sera supprimé dans ${daysUntilExpiry} jour${daysUntilExpiry > 1 ? 's' : ''}.`
            }
          </p>
        </div>
      )}

      {/* ── Zone des messages ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {messages.length === 0 && (
          <p
            style={{
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 14,
              padding: '32px 0',
            }}
          >
            Sois le premier à écrire un message !
          </p>
        )}

        {messages.map((msg, i) => {
          // Message de vote de suppression
          const isVoteMsg = msg.type === 'vote' || (msg.content && msg.content.startsWith('__VOTE__:'))
          if (isVoteMsg) {
            const parts = (msg.content || '').split(':')
            const pollId = msg.poll_id || parts[1]
            const creatorName = msg.creator_name || parts[2] || '?'
            const alreadyVoted = votedPolls[pollId]
            return (
              <VoteCard
                key={msg.id || i}
                pollId={pollId}
                creatorName={creatorName}
                alreadyVoted={alreadyVoted}
                isCreator={isCreator}
                eventId={id}
                onVote={(pid, v) => setVotedPolls(prev => ({ ...prev, [pid]: v }))}
              />
            )
          }

          // Message système (entrée/sortie d'un membre)
          if (msg.type === 'system') {
            return (
              <p key={i} style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '4px 0' }}>
                {msg.content}
              </p>
            )
          }

          const senderId = msg.sender?.id
          const isMe = senderId === user?.id
          const senderName = msg.sender?.first_name || '?'
          const senderAvatar = msg.sender?.avatar_url
          const time = msg.created_at
            ? new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
            : ''

          // Regrouper les messages consécutifs du même expéditeur
          const prevMsg = messages[i - 1]
          const isFirstInGroup = !prevMsg || prevMsg.type === 'system' || prevMsg.sender?.id !== senderId

          return (
            <div
              key={msg.id || i}
              style={{
                display: 'flex',
                flexDirection: isMe ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: 8,
                marginTop: isFirstInGroup ? 8 : 2,
              }}
            >
              {/* Avatar (autres utilisateurs, premier message du groupe seulement) */}
              {!isMe && (
                <div style={{ width: 32, flexShrink: 0, alignSelf: 'flex-end' }}>
                  {isFirstInGroup && (
                    <button
                      onClick={() => navigate(`/users/${senderId}`)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      aria-label={`Voir le profil de ${senderName}`}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          background: `${cat.color}20`,
                          border: `1.5px solid ${cat.color}40`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 700,
                          color: cat.color,
                          flexShrink: 0,
                        }}
                      >
                        {senderAvatar
                          ? <img src={senderAvatar} alt={senderName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : senderName?.[0]?.toUpperCase() || '?'
                        }
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Contenu */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '72%', gap: 2 }}>
                {/* Nom (premier message du groupe, autres uniquement) */}
                {!isMe && isFirstInGroup && (
                  <button
                    onClick={() => navigate(`/users/${senderId}`)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: cat.color, paddingLeft: 4 }}>
                      {senderName}
                    </span>
                  </button>
                )}

                {/* Bulle */}
                <div
                  style={{
                    padding: '9px 14px',
                    borderRadius: isMe
                      ? '16px 4px 16px 16px'
                      : '4px 16px 16px 16px',
                    background: isMe ? 'var(--accent)' : 'var(--surface2)',
                    color: isMe ? 'var(--on-accent)' : 'var(--text)',
                    fontSize: 15,
                    lineHeight: 1.5,
                    fontWeight: isMe ? 500 : 400,
                    boxShadow: isMe ? '0 2px 8px color-mix(in srgb, var(--accent) 15%, transparent)' : 'none',
                  }}
                >
                  {msg.content}
                </div>

                {/* Heure */}
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', paddingLeft: 4, paddingRight: 4 }}>
                  {time}
                </span>
              </div>
            </div>
          )
        })}

        {/* Ancre pour le scroll automatique */}
        <div ref={bottomRef} />
      </div>

      {/* ── Zone de saisie ── */}
      <form
        onSubmit={sendMessage}
        style={{
          padding: '12px 20px 20px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg)',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            background: 'var(--surface2)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            padding: '4px 4px 4px 16px',
            gap: 8,
          }}
        >
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={inputRef}
              rows={1}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: 15,
                fontFamily: 'DM Sans, sans-serif',
                padding: '8px 0',
                resize: 'none',
                overflow: 'hidden',
                lineHeight: 1.5,
              }}
              placeholder="Votre message…"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              maxLength={500}
            />
            {input.length > 400 && (
              <span style={{
                position: 'absolute', right: 4, bottom: 2,
                fontSize: 10, color: input.length >= 490 ? 'var(--orange)' : 'var(--text-tertiary)',
                fontFamily: 'DM Sans, sans-serif', pointerEvents: 'none',
              }}>
                {input.length}/500
              </span>
            )}
          </div>
          {/* Bouton envoi circulaire avec icône lucide-react */}
          <button
            type="submit"
            disabled={!input.trim()}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: input.trim() ? 'var(--accent)' : 'var(--surface3)',
              color: input.trim() ? 'var(--bg)' : 'var(--text-tertiary)',
              border: 'none',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
            aria-label="Envoyer"
          >
            <Send size={16} strokeWidth={2} />
          </button>
        </div>
      </form>
    </div>
  )
}

// Carte de vote de suppression affichée dans le chat
function VoteCard({ pollId, creatorName, alreadyVoted, isCreator, eventId, onVote }) {
  const [loading, setLoading] = useState(false)

  async function castVote(v) {
    if (alreadyVoted || isCreator || loading) return
    setLoading(true)
    try {
      await api.post(`/events/${eventId}/vote`, { vote: v })
      onVote(pollId, v)
    } catch {}
    finally { setLoading(false) }
  }

  return (
    <div style={{
      margin: '8px 0',
      background: 'rgba(255,122,61,0.07)',
      border: '1px solid rgba(255,122,61,0.25)',
      borderRadius: 18,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🗳️</span>
        <div>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', margin: 0 }}>
            {creatorName} veut supprimer la sortie
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            Voulez-vous conserver cette sortie ?
          </p>
        </div>
      </div>

      {isCreator ? (
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', textAlign: 'center' }}>
          En attente des votes des participants…
        </p>
      ) : alreadyVoted ? (
        <div style={{
          textAlign: 'center', fontSize: 13, fontWeight: 700,
          color: alreadyVoted === 'keep' ? 'var(--green)' : 'var(--orange)',
          padding: '6px 0',
        }}>
          {alreadyVoted === 'keep' ? '✓ Tu as voté Oui (Garder)' : '✓ Tu as voté Non (Supprimer)'}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => castVote('keep')}
            disabled={loading}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 11, border: '1px solid rgba(61,219,130,0.4)',
              background: 'rgba(61,219,130,0.1)', color: 'var(--green)', fontWeight: 700,
              fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Oui, garder
          </button>
          <button
            onClick={() => castVote('delete')}
            disabled={loading}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 11, border: '1px solid rgba(255,122,61,0.4)',
              background: 'rgba(255,122,61,0.1)', color: 'var(--orange)', fontWeight: 700,
              fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Non, supprimer
          </button>
        </div>
      )}
    </div>
  )
}
