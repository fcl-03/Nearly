import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Plus, BarChart3, Calendar, Users, ChevronRight } from 'lucide-react'
import api from '../../services/api'
import Spinner from '../../components/ui/Spinner'

// Plans B2B avec leurs prix et limites
const PLANS = {
  starter: { label: 'Starter', price: '49 €/mois', color: 'var(--blue)', limit: '3 sorties sponsorisées' },
  pro: { label: 'Pro', price: '99 €/mois', color: 'var(--violet)', limit: '10 sorties + stats' },
  exclusif: { label: 'Exclusif', price: '199 €/mois', color: '#FFB800', limit: 'Illimité + badge partenaire' },
}

export default function BusinessDashboardPage() {
  const navigate = useNavigate()
  const [account, setAccount] = useState(null)
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [noAccount, setNoAccount] = useState(false)

  // Chargement du compte business
  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/business/me')
        setAccount(data)

        // Charger les sorties sponsorisées
        const eventsRes = await api.get('/business/me/events')
        setEvents(eventsRes.data)

        // Charger les stats si plan Pro ou Exclusif
        if (data.plan !== 'starter') {
          try {
            const statsRes = await api.get('/business/me/stats')
            setStats(statsRes.data)
          } catch {}
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setNoAccount(true)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <Spinner />
      </div>
    )
  }

  // Pas de compte business → proposer la création
  if (noAccount) {
    return <CreateBusinessPrompt navigate={navigate} />
  }

  const plan = PLANS[account.plan] || PLANS.starter
  const spotsUsed = account.sponsored_events_used
  const spotsLimit = account.sponsored_events_limit
  const spotsRemaining = spotsLimit ? spotsLimit - spotsUsed : null

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>

      {/* En-tête */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg)', borderBottom: '1px solid var(--border-color)',
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text)' }}
        >
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--text)', margin: 0 }}>
          Mon établissement
        </h1>
      </div>

      <div style={{ padding: '20px 20px 60px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Card établissement */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 18, padding: '20px',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'var(--surface2)', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {account.logo_url
              ? <img src={account.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Building2 size={24} color="var(--text-tertiary)" />
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text)', margin: 0 }}>
              {account.business_name}
            </p>
            {account.city && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                📍 {account.city}
              </p>
            )}
            <span style={{
              display: 'inline-block', marginTop: 6,
              fontSize: 10, fontWeight: 700, fontFamily: 'Syne, sans-serif',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: plan.color, background: `${plan.color}18`,
              border: `1px solid ${plan.color}35`,
              borderRadius: 999, padding: '3px 10px',
            }}>
              {plan.label} — {plan.price}
            </span>
          </div>
          <button
            onClick={() => navigate('/business/edit')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Stats rapides (Pro / Exclusif) */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatCard icon={<Calendar size={18} />} label="Sorties" value={stats.total_sponsored_events} color="var(--accent)" />
            <StatCard icon={<Users size={18} />} label="Participants" value={stats.total_participants} color="var(--green)" />
            <StatCard icon={<BarChart3 size={18} />} label="Cette semaine" value={stats.events_this_week} color="var(--violet)" />
            <StatCard icon={<Building2 size={18} />} label="Impressions" value={stats.total_impressions} color="var(--blue)" />
          </div>
        )}

        {/* Quota de sorties sponsorisées */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 18, padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Sorties sponsorisées
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: plan.color }}>
              {spotsRemaining !== null ? `${spotsUsed}/${spotsLimit}` : `${spotsUsed} (illimité)`}
            </span>
          </div>
          {spotsLimit && (
            <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (spotsUsed / spotsLimit) * 100)}%`,
                background: plan.color,
                borderRadius: 999,
                transition: 'width 0.5s ease',
              }} />
            </div>
          )}
        </div>

        {/* Bouton créer une sortie sponsorisée */}
        <button
          onClick={() => navigate('/business/events/new')}
          disabled={spotsLimit !== null && spotsUsed >= spotsLimit}
          style={{
            width: '100%',
            background: 'var(--accent)', color: 'var(--on-accent)',
            border: 'none', borderRadius: 14, padding: '14px',
            fontWeight: 700, fontSize: 15, cursor: 'pointer',
            fontFamily: 'Syne, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: (spotsLimit !== null && spotsUsed >= spotsLimit) ? 0.45 : 1,
          }}
        >
          <Plus size={18} strokeWidth={2.5} />
          Nouvelle sortie sponsorisée
        </button>

        {/* Liste des sorties sponsorisées */}
        <div>
          <p style={{
            fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--text-tertiary)', marginBottom: 10,
          }}>
            Mes sorties ({events.length})
          </p>

          {events.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>
              Aucune sortie sponsorisée pour le moment
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {events.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => navigate(`/events/${ev.event_id}`)}
                  style={{
                    width: '100%', textAlign: 'left',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 14, padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0 }}>
                      {ev.event_title}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                      {ev.event_category} · {ev.participants_count} participant{ev.participants_count > 1 ? 's' : ''}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: ev.event_is_active ? 'var(--green)' : 'var(--text-tertiary)',
                    background: ev.event_is_active ? 'rgba(61,219,130,0.1)' : 'var(--surface2)',
                    borderRadius: 999, padding: '3px 10px',
                    flexShrink: 0,
                  }}>
                    {ev.event_is_active ? 'Active' : 'Terminée'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Card de statistique
function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-color)',
      borderRadius: 14, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--text)', margin: 0 }}>
          {value}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
          {label}
        </p>
      </div>
    </div>
  )
}

// Écran quand l'utilisateur n'a pas encore de compte business
function CreateBusinessPrompt({ navigate }) {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e) {
    e.preventDefault()
    if (name.trim().length < 2) return
    setLoading(true)
    setError('')
    try {
      await api.post('/business', { business_name: name.trim(), city: city.trim() || undefined })
      window.location.reload()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', background: 'var(--surface2)',
    border: '1px solid var(--border-color)',
    borderRadius: 11, padding: '13px 16px',
    color: 'var(--text)', fontSize: 15,
    fontFamily: 'DM Sans, sans-serif',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏪</div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text)', margin: '0 0 8px' }}>
            Compte Entreprise
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Mets en avant ton établissement et attire des clients via Nearly.
          </p>
        </div>

        {/* Offres */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {Object.entries(PLANS).map(([key, p]) => (
            <div key={key} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 14, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: p.color, flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                  {p.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
                  {p.limit}
                </span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: p.color }}>
                {p.price}
              </span>
            </div>
          ))}
        </div>

        {/* Formulaire de création */}
        <form onSubmit={handleCreate} style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 18, padding: '24px 20px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: 0 }}>
            Créer mon compte
          </p>

          <div>
            <label style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>
              Nom de l'établissement
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
              placeholder="Ex : Le Petit Troyen"
              required
              minLength={2}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>
              Ville
            </label>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              style={inputStyle}
              placeholder="Ex : Troyes"
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(255,122,61,0.1)', border: '1px solid rgba(255,122,61,0.2)', borderRadius: 11, padding: '10px 14px', fontSize: 13, color: 'var(--orange)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || name.trim().length < 2}
            style={{
              width: '100%', background: 'var(--accent)', color: 'var(--on-accent)',
              border: 'none', borderRadius: 11, padding: '14px',
              fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Syne, sans-serif',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Création...' : 'Commencer avec Starter (49 €/mois)'}
          </button>

          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', margin: 0 }}>
            Tu pourras upgrader ton plan à tout moment.
          </p>
        </form>

        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'block', margin: '16px auto 0',
            background: 'none', border: 'none',
            color: 'var(--text-tertiary)', fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Retour
        </button>
      </div>
    </div>
  )
}
