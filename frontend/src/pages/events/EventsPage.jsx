import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { Plus, Bell } from 'lucide-react'
import L from 'leaflet'
import api from '../../services/api'
import { getCat, formatTime } from '../../utils/categories'
import { useThemeStore } from '../../stores/themeStore'
import Spinner from '../../components/ui/Spinner'
import EventCard from './EventCard'
import AdCard from '../../components/ui/AdCard'

// Corriger les icônes par défaut de Leaflet avec webpack/vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Filtres de la page — toutes les catégories disponibles
const FILTERS = [
  { key: '',         label: 'Tout' },
  { key: 'ciné',     label: '🎬 Ciné' },
  { key: 'sport',    label: '⚽ Sport' },
  { key: 'bar',      label: '🍺 Bar' },
  { key: 'balade',   label: '🚶 Balade' },
  { key: 'musique',  label: '🎵 Musique' },
  { key: 'jeux',     label: '🎲 Jeux' },
  { key: 'expos',    label: '🎨 Expos' },
  { key: 'échecs',   label: '♟️ Échecs' },
  { key: 'autre',    label: '✨ Autre' },
]

// Créer une icône pin (bulle + flèche) pour les marqueurs de la carte
function createEventIcon(cat) {
  const html = `
    <div style="display:inline-flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.55))">
      <div style="
        background:${cat.color};
        color:#0B0D11;
        padding:6px 11px;
        border-radius:10px;
        font-size:17px;
        line-height:1;
        font-weight:700;
        white-space:nowrap;
      ">${cat.emoji}</div>
      <div style="
        width:0;height:0;
        border-left:8px solid transparent;
        border-right:8px solid transparent;
        border-top:10px solid ${cat.color};
        margin-top:-1px;
      "></div>
    </div>
  `
  return L.divIcon({
    className: '',
    html,
    // Ancre au bas de la flèche (centre horizontal, bas total)
    iconAnchor: [19, 46],
  })
}

// Composant pour adapter la vue aux points de la carte
function FitBounds({ events }) {
  const map = useMap()
  useEffect(() => {
    const pts = events
      .filter(e => e.latitude && e.longitude)
      .map(e => [e.latitude, e.longitude])
    if (pts.length > 0) {
      map.fitBounds(pts, { padding: [50, 50], maxZoom: 14 })
    }
  }, [events])
  return null
}

// Vérifier si un événement est aujourd'hui
function isToday(isoString) {
  const d = new Date(isoString)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

// Clé sessionStorage pour mémoriser la position entre navigations
const GEO_KEY = 'nearly_user_pos'
const CITY_KEY = 'nearly_user_city'

export default function EventsPage() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const tileUrl = theme === 'light'
    ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [activeFilter, setActiveFilter] = useState('')

  // Initialiser depuis sessionStorage si disponible (survit à la navigation)
  const [userPos, setUserPos] = useState(() => {
    try {
      const saved = sessionStorage.getItem(GEO_KEY)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [city, setCity] = useState(() => sessionStorage.getItem(CITY_KEY) || 'Ma position')
  // geoReady = true dès qu'on a une position OU que la géoloc a échoué/timeout
  const [geoReady, setGeoReady] = useState(() => !!sessionStorage.getItem(GEO_KEY))
  const [ads, setAds] = useState([])
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [mapHeight, setMapHeight] = useState(190) // min 190, max 380
  const mapHandleRef = useRef(null)
  const mapHeightRef = useRef(190) // ref pour lire la hauteur courante dans les listeners touch

  // Synchroniser le ref avec le state
  useEffect(() => { mapHeightRef.current = mapHeight }, [mapHeight])

  // Attacher le touch listener en non-passif pour bloquer le scroll/pull-to-refresh
  useEffect(() => {
    const el = mapHandleRef.current
    if (!el) return
    function onTouchStart(e) {
      e.preventDefault()
      const startY = e.touches[0].clientY
      const startH = mapHeightRef.current
      function onMove(ev) {
        ev.preventDefault()
        const delta = ev.touches[0].clientY - startY
        setMapHeight(Math.min(380, Math.max(190, startH + delta)))
      }
      function onEnd() {
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('touchend', onEnd)
      }
      window.addEventListener('touchmove', onMove, { passive: false })
      window.addEventListener('touchend', onEnd)
    }
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    return () => el.removeEventListener('touchstart', onTouchStart)
  }, [])

  // Charger les publicités natives
  useEffect(() => {
    api.get('/ads/feed').then(({ data }) => setAds(data)).catch(() => {})
  }, [])

  // Polling du badge de notifications toutes les 30s
  useEffect(() => {
    async function fetchCount() {
      try {
        const { data } = await api.get('/notifications/unread-count')
        setUnreadNotifs(data.count)
      } catch {}
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (category && category !== 'Ce soir') p.set('category', category)
      if (userPos) {
        p.set('lat', userPos[0])
        p.set('lon', userPos[1])
        p.set('radius_km', 50)
      }
      const { data } = await api.get(`/events?${p}`)
      setEvents(data)
    } catch {}
    finally { setLoading(false) }
  }, [category, userPos])

  // Fetch seulement quand la géoloc est prête (position connue ou refusée)
  useEffect(() => {
    if (geoReady) fetchEvents()
  }, [fetchEvents, geoReady])

  // Géolocalisation au montage — uniquement si pas déjà en cache
  useEffect(() => {
    if (sessionStorage.getItem(GEO_KEY)) return // déjà connu

    if (!navigator.geolocation) { setGeoReady(true); return }

    // Timeout de 5s si le navigateur ne répond pas
    const timeout = setTimeout(() => setGeoReady(true), 5000)

    navigator.geolocation.getCurrentPosition(
      async p => {
        clearTimeout(timeout)
        const pos = [p.coords.latitude, p.coords.longitude]
        setUserPos(pos)
        sessionStorage.setItem(GEO_KEY, JSON.stringify(pos))
        setGeoReady(true)
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos[0]}&lon=${pos[1]}&format=json`,
            { headers: { 'Accept-Language': 'fr' } }
          )
          const d = await r.json()
          const name = d.address?.city || d.address?.town || d.address?.village || 'Ma position'
          setCity(name)
          sessionStorage.setItem(CITY_KEY, name)
        } catch {}
      },
      () => {
        clearTimeout(timeout)
        setGeoReady(true) // géo refusée → fetch sans filtre
      }
    )

    return () => clearTimeout(timeout)
  }, [])

  // Filtrage côté client pour "Ce soir"
  const displayedEvents = activeFilter === 'Ce soir'
    ? events.filter(e => isToday(e.starts_at))
    : events

  const mapCenter = userPos
    ?? (events[0] ? [events[0].latitude, events[0].longitude] : [48.8566, 2.3522])

  function handleFilterClick(key) {
    setActiveFilter(key)
    // Les filtres catégorie sont envoyés à l'API, "Ce soir" est local
    if (key !== 'Ce soir') {
      setCategory(key)
    } else {
      setCategory('')
    }
  }

  function handleGeolocate() {
    navigator.geolocation?.getCurrentPosition(async p => {
      const pos = [p.coords.latitude, p.coords.longitude]
      setUserPos(pos)
      sessionStorage.setItem(GEO_KEY, JSON.stringify(pos))
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${pos[0]}&lon=${pos[1]}&format=json`,
          { headers: { 'Accept-Language': 'fr' } }
        )
        const d = await r.json()
        const name = d.address?.city || d.address?.town || d.address?.village || 'Ma position'
        setCity(name)
        sessionStorage.setItem(CITY_KEY, name)
      } catch {}
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ── En-tête ── */}
      <div style={{ padding: '24px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          {/* Logo */}
          <h1
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 28,
              color: 'var(--accent-text)',
              margin: 0,
              lineHeight: 1,
            }}
          >
            Nearly.
          </h1>

          {/* Cloche notifications */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => navigate('/notifications')}
              style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 4, display: 'flex' }}
            >
              <Bell size={22} />
              {unreadNotifs > 0 && (
                <span style={{
                  position: 'absolute', top: 0, right: 0,
                  background: '#FF4D4D',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'Syne, sans-serif',
                  minWidth: 16, height: 16,
                  borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px',
                  border: '2px solid var(--bg)',
                }}>
                  {unreadNotifs > 9 ? '9+' : unreadNotifs}
                </span>
              )}
            </button>

          {/* Chip localisation + bouton "Près de moi" */}
          <button
            onClick={handleGeolocate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--surface2)',
              borderRadius: 999,
              padding: '6px 14px',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text-secondary)',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            📍 {city}
          </button>
          </div>
        </div>

        {/* Filtres */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
          }}
        >
          {FILTERS.map(f => {
            const isActive = activeFilter === f.key
            return (
              <button
                key={f.key}
                onClick={() => handleFilterClick(f.key)}
                style={{
                  flexShrink: 0,
                  background: isActive ? 'var(--accent)' : 'var(--surface2)',
                  color: isActive ? 'var(--bg)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 400,
                  fontFamily: 'Syne, sans-serif',
                  fontSize: 13,
                  border: 'none',
                  borderRadius: 999,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Section carte (map) ── */}
      <div style={{ padding: '0 20px 16px' }}>
        <div
          style={{
            height: mapHeight,
            transition: 'height 0.05s',
            borderRadius: 18,
            background: 'linear-gradient(135deg, var(--surface2) 0%, var(--surface3) 100%)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Carte Leaflet réelle */}
          <MapContainer
            center={mapCenter}
            zoom={13}
            minZoom={3}
            maxBounds={[[-85, -180], [85, 180]]}
            maxBoundsViscosity={1.0}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer url={tileUrl} noWrap />
            <FitBounds events={displayedEvents} />
            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={50}
              iconCreateFunction={cluster => L.divIcon({
                className: '',
                html: `<div style="
                  background:${theme === 'light' ? '#0F1014' : '#E8FF47'};
                  color:${theme === 'light' ? '#FFFFFF' : '#0B0D11'};
                  width:36px;height:36px;
                  border-radius:50%;
                  display:flex;align-items:center;justify-content:center;
                  font-family:Syne,sans-serif;
                  font-weight:800;
                  font-size:14px;
                  filter:drop-shadow(0 4px 10px rgba(0,0,0,0.55));
                ">${cluster.getChildCount()}</div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18],
              })}
            >
              {displayedEvents
                .filter(e => e.latitude && e.longitude)
                .map(e => {
                  const cat = getCat(e.category)
                  const { time, label } = formatTime(e.starts_at)
                  return (
                    <Marker
                      key={e.id}
                      position={[e.latitude, e.longitude]}
                      icon={createEventIcon(cat)}
                      eventHandlers={{ click: () => navigate(`/events/${e.id}`) }}
                    >
                      <Popup>
                        <div style={{ fontFamily: 'DM Sans, sans-serif', minWidth: 130 }}>
                          <p style={{ fontWeight: 700, color: 'var(--on-accent)', marginBottom: 2 }}>{e.title}</p>
                          <p style={{ fontSize: 11, color: '#444' }}>{time} · {label}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
            </MarkerClusterGroup>
          </MapContainer>

          {/* Handle de redimensionnement de la map */}
          <div
            ref={mapHandleRef}
            onMouseDown={e => {
              e.preventDefault()
              const startY = e.clientY
              const startH = mapHeight
              function onMove(ev) {
                const delta = ev.clientY - startY
                setMapHeight(Math.min(380, Math.max(190, startH + delta)))
              }
              function onUp() {
                window.removeEventListener('mousemove', onMove)
                window.removeEventListener('mouseup', onUp)
              }
              window.addEventListener('mousemove', onMove)
              window.addEventListener('mouseup', onUp)
            }}
            style={{
              position: 'absolute',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 400,
              width: 60,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'ns-resize',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.5)' }} />
          </div>

          {/* Bouton FAB créer une sortie */}
          <button
            onClick={() => navigate('/events/new')}
            style={{
              position: 'absolute',
              bottom: 14,
              right: 14,
              zIndex: 400,
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--accent)',
              color: 'var(--bg)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(232,255,71,0.35)',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            aria-label="Créer une sortie"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ── Label "POUR TOI ✦" + compteur ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px 10px',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-tertiary)',
          }}
        >
          Pour toi ✦
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {loading ? '…' : `${displayedEvents.length} sortie${displayedEvents.length > 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── Liste des événements ── */}
      <div className="nearly-events-grid" style={{ flex: 1, padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <Spinner />
          </div>
        ) : displayedEvents.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '48px 0',
              color: 'var(--text-tertiary)',
              gridColumn: '1 / -1', // prend toute la largeur de la grille 2 colonnes en desktop
            }}
          >
            <span style={{ fontSize: 44, marginBottom: 12 }}>🌆</span>
            <p style={{ fontSize: 14, textAlign: 'center', lineHeight: 1.5 }}>
              Aucune sortie dans ce coin…<br />sois le premier !
            </p>
          </div>
        ) : (
          (() => {
            // Injecter une pub toutes les 5 sorties, en les intercalant
            const adFreq = 5
            let adIndex = 0
            const items = []
            displayedEvents.forEach((e, i) => {
              items.push(<EventCard key={e.id} event={e} onUpdate={fetchEvents} />)
              if (ads.length > 0 && (i + 1) % adFreq === 0) {
                items.push(
                  <AdCard key={`ad-${adIndex}`} ad={ads[adIndex % ads.length]} />
                )
                adIndex++
              }
            })
            return items
          })()
        )}
        {/* Une seule pub si très peu de sorties (< 5), placée après les sorties */}
        {ads.length > 0 && displayedEvents.length > 0 && displayedEvents.length < 5 && (
          <AdCard ad={ads[0]} />
        )}
      </div>
    </div>
  )
}
