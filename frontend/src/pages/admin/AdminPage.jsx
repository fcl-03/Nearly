import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { Navigate, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Shield, Flag, Users, FileCheck, BarChart2, Calendar, Trash2 } from 'lucide-react'
import api from '../../services/api'
import Spinner from '../../components/ui/Spinner'

const TABS = [
  { key: 'stats',    label: 'Stats',         Icon: BarChart2 },
  { key: 'events',   label: 'Sorties',       Icon: Calendar },
  { key: 'reports',  label: 'Signalements',  Icon: Flag },
  { key: 'verifs',   label: 'Vérifications', Icon: FileCheck },
  { key: 'users',    label: 'Utilisateurs',  Icon: Users },
]

export default function AdminPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState('stats')
  if (!user?.is_admin) return <Navigate to="/events" replace />

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* En-tête */}
      <div className="nearly-content-box" style={{ padding: '24px 16px 0', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Shield size={22} color="var(--accent)" />
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--accent)', margin: 0 }}>
            Dashboard Admin
          </h1>
        </div>
      </div>

      {/* Onglets */}
      <div className="nearly-content-box" style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-color)', padding: '0 16px', margin: '0 auto', overflowX: 'auto' }}>
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px',
              background: 'none', border: 'none',
              borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === key ? 'var(--accent)' : 'var(--text-tertiary)',
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12,
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="nearly-content-box" style={{ padding: '20px 16px', margin: '0 auto' }}>
        {tab === 'stats'   && <StatsSection />}
        {tab === 'events'  && <EventsSection />}
        {tab === 'reports' && <ReportsSection />}
        {tab === 'verifs'  && <VerificationsSection />}
        {tab === 'users'   && <UsersSection />}
      </div>
    </div>
  )
}

// ── Stats ──────────────────────────────────────────────────────

function StatsSection() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {})
  }, [])

  if (!stats) return <Loader />

  const kpis = [
    { label: 'Utilisateurs',       value: stats.total_users },
    { label: 'Emails vérifiés',    value: stats.email_verified_users },
    { label: 'Identités vérifiées',value: stats.identity_verified_users },
    { label: 'Bannis',             value: stats.banned_users },
    { label: 'Sorties actives',    value: stats.active_events },
    { label: 'Total sorties',      value: stats.total_events },
    { label: 'Messages',           value: stats.total_messages },
    { label: 'Signalements',       value: stats.pending_reports,       alert: stats.pending_reports > 0 },
    { label: 'Vérifs en attente',  value: stats.pending_verifications, alert: stats.pending_verifications > 0 },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
      {kpis.map(k => (
        <div key={k.label} style={{ background: 'var(--surface)', border: `1px solid ${k.alert ? 'rgba(255,122,61,0.4)' : 'var(--border-color)'}`, borderRadius: 14, padding: '12px 10px' }}>
          <p style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: k.alert ? 'var(--orange)' : 'var(--accent)' }}>{k.value ?? '—'}</p>
          <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3 }}>{k.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Signalements ───────────────────────────────────────────────

const REASON_LABELS = {
  inappropriate: 'Comportement inapproprié',
  fake: 'Faux profil / Usurpation',
  harassment: 'Harcèlement',
  spam: 'Spam',
  other: 'Autre',
}

function ReportsSection() {
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState(null)
  const [showResolved, setShowResolved] = useState(false)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/admin/reports?is_resolved=${showResolved}`)
      setReports(data)
    } catch {}
    finally { setLoading(false) }
  }, [showResolved])

  useEffect(() => { fetchReports() }, [fetchReports])

  async function resolve(id) {
    setActionId(id)
    try { await api.post(`/admin/reports/${id}/resolve`); fetchReports() }
    catch {} finally { setActionId(null) }
  }

  return (
    <div>
      {/* Toggle en attente / résolus */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[false, true].map(v => (
          <button
            key={String(v)}
            onClick={() => setShowResolved(v)}
            style={{
              padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700,
              background: showResolved === v ? 'var(--accent)' : 'var(--surface2)',
              color: showResolved === v ? 'var(--bg)' : 'var(--text-secondary)',
            }}
          >
            {v ? 'Résolus' : 'En attente'}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : reports.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '12px 0' }}>
          {showResolved ? 'Aucun signalement résolu.' : 'Aucun signalement en attente. ✓'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reports.map(r => (
            <div key={r.id} style={{ background: 'var(--surface)', border: `1px solid ${showResolved ? 'var(--border-color)' : 'rgba(255,122,61,0.3)'}`, borderRadius: 14, padding: '14px' }}>
              {/* Motif */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Flag size={13} color="var(--orange)" />
                <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--orange)' }}>
                  {REASON_LABELS[r.reason] || r.reason}
                </span>
              </div>

              {/* Signaleur → signalé */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                {/* Signaleur */}
                <button
                  onClick={() => navigate(`/users/${r.reporter_id}`)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {r.reporter_name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>Signaleur</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reporter_name}</p>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 'auto' }}>↗</span>
                </button>

                <span style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>→</span>

                {/* Signalé */}
                {r.reported_user_id ? (
                  <button
                    onClick={() => navigate(`/users/${r.reported_user_id}`)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,122,61,0.06)', border: '1px solid rgba(255,122,61,0.25)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,122,61,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--orange)', flexShrink: 0 }}>
                      {r.reported_user_name?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>Signalé</p>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--orange)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reported_user_name}</p>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--orange)', marginLeft: 'auto' }}>↗</span>
                  </button>
                ) : (
                  <div style={{ flex: 1, background: 'rgba(255,122,61,0.06)', border: '1px solid rgba(255,122,61,0.25)', borderRadius: 10, padding: '8px 10px' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>Sortie signalée</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--orange)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reported_event_title}</p>
                  </div>
                )}
              </div>

              {/* Bouton résoudre */}
              {!showResolved && (
                <button
                  onClick={() => resolve(r.id)}
                  disabled={actionId === r.id}
                  style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '9px 0', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', opacity: actionId === r.id ? 0.5 : 1 }}
                >
                  {actionId === r.id ? 'Résolution…' : '✓ Marquer comme résolu'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Vérifications d'identité ───────────────────────────────────

// ── Sorties ──────────────────────────────────────────────────────

function EventsSection() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try { const { data } = await api.get('/admin/events'); setEvents(data) }
    catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  async function forceDelete(id) {
    if (!confirm('Supprimer cette sortie ? Cette action est irréversible.')) return
    setDeleting(id)
    try { await api.delete(`/admin/events/${id}`); fetchEvents() }
    catch {} finally { setDeleting(null) }
  }

  return (
    <div>
      {loading ? <Loader /> : events.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '12px 0' }}>Aucune sortie.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map(e => (
            <div key={e.id} style={{ background: 'var(--surface)', border: `1px solid ${e.is_active ? 'var(--border-color)' : 'rgba(255,122,61,0.3)'}`, borderRadius: 12, padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <button onClick={() => navigate(`/events/${e.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0 }}>
                    {e.title} <span style={{ fontSize: 11, color: 'var(--accent)' }}>↗</span>
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                    {e.category} · {e.creator_name} · {e.participants_count} participant{e.participants_count > 1 ? 's' : ''}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                    {e.location_name} · {new Date(e.starts_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {!e.is_active && <Badge color="danger">désactivée</Badge>}
                  {e.is_active && (
                    <button
                      onClick={() => forceDelete(e.id)}
                      disabled={deleting === e.id}
                      style={{
                        background: 'rgba(255,122,61,0.1)',
                        border: '1px solid rgba(255,122,61,0.3)',
                        borderRadius: 8,
                        padding: '6px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color: 'var(--orange)',
                        fontSize: 11,
                        fontWeight: 700,
                        opacity: deleting === e.id ? 0.5 : 1,
                      }}
                    >
                      <Trash2 size={12} /> Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Vérifications ─────────────────────────────────────────────────

function VerificationsSection() {
  const navigate = useNavigate()
  const [verifs, setVerifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState(null)

  const fetchVerifs = useCallback(async () => {
    setLoading(true)
    try { const { data } = await api.get('/admin/verifications'); setVerifs(data) }
    catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchVerifs() }, [fetchVerifs])

  async function review(id, action) {
    setActionId(id)
    try { await api.post(`/admin/verifications/${id}/review`, { action }); fetchVerifs() }
    catch {} finally { setActionId(null) }
  }

  const pending = verifs.filter(v => v.status === 'pending')

  return (
    <div>
      {pending.length > 0 && (
        <div style={{ background: 'rgba(232,255,71,0.06)', border: '1px solid rgba(232,255,71,0.2)', borderRadius: 11, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
          {pending.length} vérification{pending.length > 1 ? 's' : ''} en attente de traitement
        </div>
      )}

      {loading ? <Loader /> : verifs.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '12px 0' }}>Aucune vérification pour le moment.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {verifs.map(v => (
            <div key={v.id} style={{ background: 'var(--surface)', border: `1px solid ${v.status === 'pending' ? 'var(--border-color)' : v.status === 'approved' ? 'rgba(61,219,130,0.3)' : 'rgba(255,122,61,0.3)'}`, borderRadius: 14, padding: '14px' }}>
              {/* Utilisateur */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <button onClick={() => navigate(`/users/${v.user_id}`)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, flex: 1, textAlign: 'left' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface2)', border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {v.user_avatar_url
                      ? <img src={v.user_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (v.user_name?.[0] || '?').toUpperCase()
                    }
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0 }}>
                      {v.user_name || 'Utilisateur'} <span style={{ fontSize: 11, color: 'var(--accent)' }}>↗ profil</span>
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{v.user_email}</p>
                  </div>
                </button>
                <StatusBadge status={v.status} />
              </div>

              {/* Photos */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <PhotoPreview url={v.selfie_url} label="Selfie" />
                <PhotoPreview url={v.id_card_url} label="Pièce d'identité" />
              </div>

              {v.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => review(v.id, 'approve')} disabled={actionId === v.id} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--green)', color: 'var(--bg)', border: 'none', borderRadius: 11, padding: '10px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: actionId === v.id ? 0.5 : 1 }}>
                    <CheckCircle size={15} /> Approuver
                  </button>
                  <button onClick={() => review(v.id, 'reject')} disabled={actionId === v.id} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--orange)', color: 'var(--bg)', border: 'none', borderRadius: 11, padding: '10px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: actionId === v.id ? 0.5 : 1 }}>
                    <XCircle size={15} /> Rejeter
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Utilisateurs ───────────────────────────────────────────────

function UsersSection() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try { const { data } = await api.get(`/admin/users?search=${search}`); setUsers(data) }
    catch {} finally { setLoading(false) }
  }, [search])

  useEffect(() => { fetchUsers() }, [])

  async function ban(id)    { await api.post(`/admin/users/${id}/ban`, {});    fetchUsers() }
  async function unban(id)  { await api.post(`/admin/users/${id}/unban`, {});  fetchUsers() }
  async function promote(id){ await api.post(`/admin/users/${id}/promote`, {}); fetchUsers() }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 11, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
          placeholder="Rechercher par email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchUsers()}
        />
        <button onClick={fetchUsers} style={{ background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 11, padding: '9px 14px', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
          Chercher
        </button>
      </div>

      {loading ? <Loader /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map(u => (
            <div key={u.id} style={{ background: 'var(--surface)', border: `1px solid ${u.is_banned ? 'rgba(255,122,61,0.3)' : 'var(--border-color)'}`, borderRadius: 12, padding: '12px 12px' }}>
              {/* Infos utilisateur + lien profil */}
              <button
                onClick={() => navigate(`/users/${u.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left', marginBottom: 10 }}
              >
                <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface2)', border: '1.5px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : u.first_name?.[0]?.toUpperCase()
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                    {u.first_name} {u.username && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>@{u.username}</span>}
                    <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 6 }}>↗</span>
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                </div>
              </button>

              {/* Badges */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {u.is_admin    && <Badge color="accent">admin</Badge>}
                {u.is_banned   && <Badge color="danger">banni</Badge>}
                {u.is_premium  && <Badge color="accent">premium ⭐</Badge>}
                {u.is_email_verified && <Badge color="green">email ✓</Badge>}
                {u.is_verified && <Badge color="green">id ✓</Badge>}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6 }}>
                {!u.is_admin && (
                  <button onClick={() => promote(u.id)} style={actionBtn('var(--accent)', 'var(--bg)')}>Admin</button>
                )}
                {u.is_banned ? (
                  <button onClick={() => unban(u.id)} style={actionBtn('var(--surface2)', 'var(--text)')}>Débannir</button>
                ) : (
                  <button onClick={() => ban(u.id)} style={actionBtn('var(--orange)', 'var(--bg)')}>Bannir</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Composants utilitaires ─────────────────────────────────────

function PhotoPreview({ url, label }) {
  if (!url) return (
    <div style={{ flex: 1, height: 100, borderRadius: 10, border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>Non fourni</p>
    </div>
  )
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{ flex: 1 }}>
      <img src={url} alt={label} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border-color)' }} />
      <p style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 4 }}>{label}</p>
    </a>
  )
}

function StatusBadge({ status }) {
  const map = { pending: ['var(--accent)', 'En attente'], approved: ['var(--green)', 'Approuvé'], rejected: ['var(--orange)', 'Rejeté'] }
  const [color, label] = map[status] || ['var(--text-tertiary)', status]
  return <span style={{ fontSize: 11, fontWeight: 700, color, background: color + '20', borderRadius: 99, padding: '3px 8px', flexShrink: 0 }}>{label}</span>
}

function Badge({ children, color }) {
  const colors = { accent: ['var(--accent)', 'rgba(232,255,71,0.1)'], danger: ['var(--orange)', 'rgba(255,122,61,0.1)'], green: ['var(--green)', 'rgba(61,219,130,0.1)'] }
  const [c, bg] = colors[color] || ['var(--text)', 'transparent']
  return <span style={{ fontSize: 10, fontWeight: 600, color: c, background: bg, borderRadius: 99, padding: '2px 7px', border: `1px solid ${c}40` }}>{children}</span>
}

function actionBtn(bg, color) {
  return { background: bg, color, border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
}

function Loader() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner /></div>
}
