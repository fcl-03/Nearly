import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import api from '../../services/api'
import Spinner from '../../components/ui/Spinner'

// Page de chat privé (DM) — polling REST
export default function DMChatPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [partner, setPartner] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const isAtBottomRef = useRef(true)

  // Charger le profil du partenaire
  useEffect(() => {
    api.get(`/users/${userId}`)
      .then(({ data }) => setPartner(data))
      .catch(() => navigate('/messages', { replace: true }))
  }, [userId])

  // Charger l'historique initial + marquer comme lu
  useEffect(() => {
    api.get(`/dm/${userId}/messages`)
      .then(({ data }) => setMessages(data))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
    api.post(`/dm/${userId}/mark-read`).catch(() => {})
  }, [userId])

  // Polling toutes les 3s pour les nouveaux messages
  useEffect(() => {
    const interval = setInterval(() => {
      api.get(`/dm/${userId}/messages`)
        .then(({ data }) => {
          setMessages(prev => {
            // Ne mettre à jour que si de nouveaux messages sont arrivés
            if (data.length !== prev.length) return data
            return prev
          })
          // Marquer comme lu automatiquement
          api.post(`/dm/${userId}/mark-read`).catch(() => {})
        })
        .catch(() => {})
    }, 3000)
    return () => clearInterval(interval)
  }, [userId])

  // Scroll vers le bas quand les messages changent
  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Marquer comme lu au retour
  async function handleBack() {
    try { await api.post(`/dm/${userId}/mark-read`) } catch {}
    navigate(-1)
  }

  async function sendMessage(e) {
    e?.preventDefault()
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    try {
      const { data: msg } = await api.post(`/dm/${userId}/messages`, { content })
      setMessages(prev => [...prev, msg])
      isAtBottomRef.current = true
    } catch (err) {
      console.error('[DM SEND]', err)
      setInput(content) // Remettre le texte en cas d'erreur
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handleInputChange(e) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  function handleScroll(e) {
    const el = e.currentTarget
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  }

  if (!partner) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}>
        <Spinner />
      </div>
    )
  }

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
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 4 }}
          aria-label="Retour"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>

        {/* Avatar + nom du partenaire → son profil */}
        <button
          onClick={() => navigate(`/users/${userId}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              overflow: 'hidden',
              background: 'var(--surface2)',
              border: '1.5px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
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
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              {partner.first_name}
              {partner.is_verified && <span style={{ color: 'var(--green)', fontSize: 12 }}>✓</span>}
            </p>
            {partner.city && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>📍 {partner.city}</p>}
          </div>
        </button>
      </div>

      {/* ── Zone des messages ── */}
      <div
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {loadingHistory ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 32 }}>
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, padding: '32px 0' }}>
            Dis bonjour à {partner.first_name} ! 👋
          </p>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender_id === user?.id
            const time = msg.created_at
              ? new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              : ''

            // Regrouper les messages consécutifs du même expéditeur
            const prevMsg = messages[i - 1]
            const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                  gap: 8,
                  marginTop: isFirstInGroup ? 8 : 2,
                }}
              >
                {/* Avatar partenaire (premier de son groupe) */}
                {!isMe && (
                  <div style={{ width: 28, flexShrink: 0, alignSelf: 'flex-end' }}>
                    {isFirstInGroup && (
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          background: 'var(--surface2)',
                          border: '1.5px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {partner.avatar_url
                          ? <img src={partner.avatar_url} alt={partner.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : partner.first_name?.[0]?.toUpperCase()
                        }
                      </div>
                    )}
                  </div>
                )}

                {/* Bulle + heure */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '72%', gap: 2 }}>
                  <div
                    style={{
                      padding: '9px 14px',
                      borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      background: isMe ? 'var(--accent)' : 'var(--surface2)',
                      color: isMe ? 'var(--on-accent)' : 'var(--text)',
                      fontSize: 15,
                      lineHeight: 1.5,
                      fontWeight: isMe ? 500 : 400,
                      boxShadow: isMe ? '0 2px 8px color-mix(in srgb, var(--accent) 15%, transparent)' : 'none',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.content}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', paddingLeft: 4, paddingRight: 4 }}>
                    {time}{isMe && msg.is_read && <span style={{ marginLeft: 4, color: 'var(--green)' }}>✓✓</span>}
                  </span>
                </div>
              </div>
            )
          })
        )}
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
          <textarea
            ref={inputRef}
            rows={1}
            style={{
              flex: 1,
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
            placeholder={`Message à ${partner.first_name}…`}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: input.trim() && !sending ? 'var(--accent)' : 'var(--surface3)',
              color: input.trim() && !sending ? 'var(--bg)' : 'var(--text-tertiary)',
              border: 'none',
              cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
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
