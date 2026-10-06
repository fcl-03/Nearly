import { useState, useEffect, useCallback } from 'react'
import { Trash2, Plus } from 'lucide-react'
import api from '../../services/api'
import Spinner from '../../components/ui/Spinner'

const EMPTY = {
  title: '',
  description: '',
  image_url: '',
  link_url: '',
  cta_label: 'En savoir plus',
  target_city: '',
  expires_at: '',
}

const inputStyle = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--border-color)',
  borderRadius: 11,
  padding: '11px 14px',
  color: 'var(--text)',
  fontFamily: 'DM Sans, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = { fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans, sans-serif', marginBottom: 4, display: 'block' }

// Dashboard admin — gestion des publicités natives (régie directe)
export default function AdsSection() {
  const [ads, setAds] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api.get('/ads/admin')
      .then(({ data }) => setAds(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    if (!form.title.trim() || !form.link_url.trim()) {
      setError('Le titre et le lien sont obligatoires.')
      return
    }
    setSaving(true)
    try {
      await api.post('/ads/admin', {
        title: form.title.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        link_url: form.link_url.trim(),
        cta_label: form.cta_label.trim() || 'En savoir plus',
        target_city: form.target_city.trim() || null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      })
      setForm(EMPTY)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la création.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAd(id) {
    try { await api.patch(`/ads/admin/${id}/toggle`); load() } catch {}
  }

  async function deleteAd(id) {
    if (!window.confirm('Supprimer cette publicité ?')) return
    try { await api.delete(`/ads/admin/${id}`); load() } catch {}
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Formulaire de création ── */}
      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Nouvelle publicité
        </h2>

        <div>
          <label style={labelStyle}>Titre *</label>
          <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Happy hour au Bar du Coin" maxLength={120} />
        </div>

        <div>
          <label style={labelStyle}>Description</label>
          <input style={inputStyle} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Une courte accroche (optionnel)" />
        </div>

        <div>
          <label style={labelStyle}>Lien de destination *</label>
          <input style={inputStyle} value={form.link_url} onChange={e => set('link_url', e.target.value)} placeholder="https://..." maxLength={500} />
        </div>

        <div>
          <label style={labelStyle}>Image (URL)</label>
          <input style={inputStyle} value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://.../visuel.jpg (optionnel)" maxLength={500} />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Texte du bouton</label>
            <input style={inputStyle} value={form.cta_label} onChange={e => set('cta_label', e.target.value)} maxLength={40} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Ville ciblée</label>
            <input style={inputStyle} value={form.target_city} onChange={e => set('target_city', e.target.value)} placeholder="Toutes si vide" />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Expiration (optionnel)</label>
          <input type="date" style={inputStyle} value={form.expires_at} onChange={e => set('expires_at', e.target.value)} />
        </div>

        {error && <p style={{ color: 'var(--orange)', fontSize: 13, margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'var(--accent)', color: 'var(--on-accent)',
            border: 'none', borderRadius: 11, padding: '12px 0',
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          }}
        >
          <Plus size={16} /> {saving ? 'Création…' : 'Créer la publicité'}
        </button>
      </form>

      {/* ── Liste des pubs ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Publicités ({ads.length})
        </h2>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
        ) : ads.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Aucune publicité pour l'instant.</p>
        ) : ads.map(ad => {
          const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0'
          return (
            <div key={ad.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0 }}>{ad.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    {ad.target_city ? `📍 ${ad.target_city}` : 'Toutes les villes'}
                  </p>
                </div>
                <button onClick={() => deleteAd(ad.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--orange)', padding: 2, flexShrink: 0 }} aria-label="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>👁️ {ad.impressions} vues</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🖱️ {ad.clicks} clics</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>CTR {ctr}%</span>
              </div>

              <button
                onClick={() => toggleAd(ad.id)}
                style={{
                  marginTop: 10,
                  background: ad.is_active ? 'color-mix(in srgb, var(--green) 15%, transparent)' : 'var(--surface3)',
                  color: ad.is_active ? 'var(--green)' : 'var(--text-tertiary)',
                  border: 'none', borderRadius: 999, padding: '5px 12px',
                  fontSize: 12, fontWeight: 700, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
                }}
              >
                {ad.is_active ? '● Active' : '○ Inactive'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
