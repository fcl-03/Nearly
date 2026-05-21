import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { ArrowLeft } from 'lucide-react'
import L from 'leaflet'
import api from '../../services/api'
import { CATEGORIES } from '../../utils/categories'
import { useThemeStore } from '../../stores/themeStore'

const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_KEY

async function searchPlaces(query, biasLat, biasLon) {
  try {
    let url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${TOMTOM_KEY}&language=fr-FR&countrySet=FR&limit=6&typeahead=true`
    if (biasLat && biasLon) url += `&lat=${biasLat}&lon=${biasLon}&radius=50000`
    const r = await fetch(url)
    const data = await r.json()
    return (data.results || []).map(res => {
      const name = res.poi?.name
      const address = res.address?.freeformAddress
      const label = name ? `${name}, ${address}` : address
      return { label, lat: res.position.lat, lon: res.position.lon }
    })
  } catch { return [] }
}

function MapClickHandler({ onMove }) {
  useMapEvents({ click: e => onMove(e.latlng.lat, e.latlng.lng) })
  return null
}

// Corriger les icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function CreateSponsoredEventPage() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const tileUrl = theme === 'light'
    ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [eventType, setEventType] = useState('open')
  const [maxP, setMaxP] = useState(6)
  const [locationName, setLocationName] = useState('')
  const [lat, setLat] = useState(null)
  const [lon, setLon] = useState(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchTimer = useRef(null)

  // Position par défaut depuis le sessionStorage
  const defaultPos = (() => {
    try {
      const saved = sessionStorage.getItem('nearly_user_pos')
      return saved ? JSON.parse(saved) : [48.3, 2.3]
    } catch { return [48.3, 2.3] }
  })()

  const mapCenter = lat && lon ? [lat, lon] : defaultPos

  function handleLocationInput(v) {
    setLocationName(v)
    clearTimeout(searchTimer.current)
    if (v.trim().length < 2) { setSuggestions([]); return }
    searchTimer.current = setTimeout(async () => {
      const results = await searchPlaces(v, defaultPos[0], defaultPos[1])
      setSuggestions(results)
    }, 300)
  }

  function selectSuggestion(s) {
    setLocationName(s.label)
    setLat(s.lat)
    setLon(s.lon)
    setSuggestions([])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !category || !locationName.trim() || !lat || !date || !time) return
    setLoading(true)
    setError('')
    try {
      const starts_at = new Date(`${date}T${time}`).toISOString()
      await api.post('/business/me/events', {
        title: title.trim(),
        description: description.trim(),
        category,
        event_type: eventType,
        location_name: locationName.trim(),
        latitude: lat,
        longitude: lon,
        starts_at,
        max_participants: eventType === 'small_group' ? maxP : null,
      })
      navigate('/business')
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

  const labelStyle = {
    fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.1em',
    color: 'var(--text-tertiary)', display: 'block', marginBottom: 6,
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>

      {/* En-tête */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg)', borderBottom: '1px solid var(--border-color)',
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text)' }}>
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--text)', margin: 0 }}>
          Sortie sponsorisée
        </h1>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Titre */}
        <div>
          <label style={labelStyle}>Titre</label>
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            style={inputStyle} placeholder="Ex : Soirée dégustation au Petit Troyen"
            maxLength={60} required
          />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', float: 'right', marginTop: 4 }}>{title.length}/60</span>
        </div>

        {/* Catégorie */}
        <div>
          <label style={labelStyle}>Catégorie</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                style={{
                  background: category === c.key ? 'var(--accent)' : 'var(--surface2)',
                  color: category === c.key ? 'var(--on-accent)' : 'var(--text-secondary)',
                  border: 'none', borderRadius: 999, padding: '8px 14px',
                  fontSize: 13, fontWeight: category === c.key ? 700 : 400,
                  cursor: 'pointer', fontFamily: 'Syne, sans-serif',
                }}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Type */}
        <div>
          <label style={labelStyle}>Type de sortie</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { key: 'open', label: 'Ouverte (illimité)' },
              { key: 'small_group', label: 'Petit groupe (3-6)' },
            ].map(t => (
              <button
                key={t.key} type="button"
                onClick={() => setEventType(t.key)}
                style={{
                  flex: 1,
                  background: eventType === t.key ? 'var(--accent)' : 'var(--surface2)',
                  color: eventType === t.key ? 'var(--on-accent)' : 'var(--text-secondary)',
                  border: 'none', borderRadius: 11, padding: '12px',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Max participants (petit groupe) */}
        {eventType === 'small_group' && (
          <div>
            <label style={labelStyle}>Participants max</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <input
                type="range" min={3} max={6} value={maxP}
                onChange={e => setMaxP(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)', minWidth: 24, textAlign: 'center' }}>{maxP}</span>
            </div>
          </div>
        )}

        {/* Lieu */}
        <div style={{ position: 'relative' }}>
          <label style={labelStyle}>Lieu</label>
          <input
            type="text" value={locationName} onChange={e => handleLocationInput(e.target.value)}
            style={inputStyle} placeholder="Rechercher un lieu..."
            required
          />
          {suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'var(--surface)', border: '1px solid var(--border-color)',
              borderRadius: 11, marginTop: 4, overflow: 'hidden',
              maxHeight: 200, overflowY: 'auto',
            }}>
              {suggestions.map((s, i) => (
                <button
                  key={i} type="button"
                  onClick={() => selectSuggestion(s)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '10px 14px', background: 'none', border: 'none',
                    color: 'var(--text)', fontSize: 13, cursor: 'pointer',
                    borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-color)' : 'none',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mini carte */}
        {lat && lon && (
          <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border-color)', height: 140 }}>
            <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
              <TileLayer url={tileUrl} />
              <Marker position={[lat, lon]} />
              <MapClickHandler onMove={(newLat, newLon) => { setLat(newLat); setLon(newLon) }} />
            </MapContainer>
          </div>
        )}

        {/* Date et heure */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} required />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Heure</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} required />
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            value={description} onChange={e => setDescription(e.target.value)}
            style={{ ...inputStyle, resize: 'none', minHeight: 80 }}
            placeholder="Décris ta sortie (min 20 caractères)..."
            minLength={20} required
          />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', float: 'right', marginTop: 4 }}>{description.length}/500</span>
        </div>

        {/* Erreur */}
        {error && (
          <div style={{ background: 'rgba(255,122,61,0.1)', border: '1px solid rgba(255,122,61,0.2)', borderRadius: 11, padding: '12px 16px', fontSize: 14, color: 'var(--orange)' }}>
            {error}
          </div>
        )}

        {/* Bouton publier */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', background: 'var(--accent)', color: 'var(--on-accent)',
            border: 'none', borderRadius: 14, padding: '14px',
            fontWeight: 700, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'Syne, sans-serif',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Publication...' : 'Publier la sortie sponsorisée'}
        </button>
      </form>
    </div>
  )
}
