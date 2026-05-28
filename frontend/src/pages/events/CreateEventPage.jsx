import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { ArrowLeft, Plus, Minus } from 'lucide-react'
import L from 'leaflet'
import api from '../../services/api'
import { CATEGORIES } from '../../utils/categories'
import { useThemeStore } from '../../stores/themeStore'

// Recherche de lieux via TomTom Fuzzy Search — POI propriétaire, fuzzy natif, biais géo
const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_KEY

async function searchPlaces(query, biasLat, biasLon) {
  try {
    let url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${TOMTOM_KEY}&language=fr-FR&countrySet=FR&limit=6&typeahead=true`
    if (biasLat && biasLon) url += `&lat=${biasLat}&lon=${biasLon}&radius=50000`
    const r = await fetch(url)
    const data = await r.json()
    return (data.results || []).map(res => {
      // Label : nom POI (si dispo) + adresse libre
      const name = res.poi?.name
      const address = res.address?.freeformAddress
      const label = name ? `${name}, ${address}` : address
      return { label, lat: res.position.lat, lon: res.position.lon }
    })
  } catch { return [] }
}

// Composant permettant de cliquer sur la carte pour déplacer le marqueur
function MapClickHandler({ onMove }) {
  useMapEvents({ click: e => onMove(e.latlng.lat, e.latlng.lng) })
  return null
}

// Types de sorties disponibles
const EVENT_TYPES = [
  { key: 'small_group', label: 'Petit groupe' },
  { key: 'open',        label: 'Ouvert' },
]

// Page de création d'un événement — Figma: CreateActivity
export default function CreateEventPage() {
  const navigate = useNavigate()
  const geocodeTimer = useRef(null)
  const { theme } = useThemeStore()
  const tileUrl = theme === 'light'
    ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    customCategory: '', // utilisé quand category === 'autre'
    location_name: '',
    date: '',
    time: '',
    max_participants: 4,
    event_type: 'small_group',
    requires_approval: false,
  })
  const [coords, setCoords] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const [pinMode, setPinMode] = useState(false) // mode "placer un pin manuellement"
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  // Mise à jour d'un champ du formulaire + effacement de l'erreur
  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => { const c = { ...e }; delete c[field]; return c })
  }

  // Recherche de suggestions 400ms après la dernière frappe
  const handleLocationInput = useCallback((value) => {
    set('location_name', value)
    setCoords(null)
    setSuggestions([])
    setPinMode(false)
    clearTimeout(geocodeTimer.current)
    if (value.length < 3) return
    geocodeTimer.current = setTimeout(async () => {
      setSearching(true)
      const pos = JSON.parse(sessionStorage.getItem('nearly_user_pos') || 'null')
      const results = await searchPlaces(value, pos?.[0], pos?.[1])
      setSuggestions(results)
      setSearching(false)
    }, 400)
  }, [])

  // Sélection d'une suggestion dans le dropdown
  function selectSuggestion(s) {
    setForm(f => ({ ...f, location_name: s.label }))
    setCoords({ lat: s.lat, lon: s.lon })
    setSuggestions([])
    setErrors(e => { const c = { ...e }; delete c.location_name; return c })
  }

  function validate() {
    const e = {}
    if (!form.title.trim()) e.title = 'Titre requis.'
    else if (form.title.trim().length > 60) e.title = 'Le titre ne peut pas dépasser 60 caractères.'
    if (!form.description.trim() || form.description.trim().length < 20) e.description = 'La description doit contenir au moins 20 caractères.'
    if (!form.category) e.category = 'Catégorie requise.'
    if (form.category === 'autre' && !form.customCategory.trim()) e.category = 'Précise la catégorie.'
    if (!form.location_name.trim()) e.location_name = 'Lieu requis.'
    if (!coords) e.location_name = 'Lieu introuvable sur la carte.'
    if (!form.date) e.date = 'Date requise.'
    if (!form.time) e.time = 'Heure requise.'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const starts_at = new Date(`${form.date}T${form.time}`).toISOString()
      const { data } = await api.post('/events', {
        title: form.title,
        description: form.description,
        category: finalCategory,
        event_type: form.event_type,
        location_name: form.location_name,
        latitude: coords.lat,
        longitude: coords.lon,
        starts_at,
        max_participants: form.event_type === 'open' ? null : parseInt(form.max_participants),
        requires_approval: form.requires_approval,
      })
      navigate(`/events/${data.id}`, { replace: true })
    } catch (err) {
      const detail = err.response?.data?.detail
      const s = err.response?.status
      if (s === 403) setErrors({ _global: detail || 'Tu dois vérifier ton identité pour créer une sortie.' })
      else if (s === 422) {
        // Erreurs de validation Pydantic — afficher le premier message utile
        const valErrors = err.response?.data?.detail
        if (Array.isArray(valErrors) && valErrors.length > 0) {
          const field = valErrors[0]?.loc?.slice(-1)[0]
          const msg = valErrors[0]?.msg
          if (field === 'description') setErrors({ _global: 'Description requise (minimum 20 caractères).' })
          else setErrors({ _global: `Champ invalide : ${field} — ${msg}` })
        } else {
          setErrors({ _global: detail || 'Données invalides.' })
        }
      }
      else setErrors({ _global: detail || 'Une erreur est survenue.' })
    } finally {
      setLoading(false)
    }
  }

  const minDate = new Date().toISOString().slice(0, 10)
  // La catégorie finale : custom si "autre" sélectionné, sinon la clé choisie
  const finalCategory = form.category === 'autre' ? form.customCategory.trim() : form.category
  const isValid = form.title && finalCategory && form.location_name && coords && form.date && form.time

  const inputStyle = {
    width: '100%',
    background: 'var(--surface2)',
    border: `1px solid var(--border-color)`,
    borderRadius: 11,
    padding: '12px 16px',
    color: 'var(--text)',
    fontSize: 15,
    fontFamily: 'DM Sans, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ── En-tête sticky ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border-color)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <button
          onClick={() => navigate('/events')}
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
        <h1
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 17,
            color: 'var(--text)',
            margin: 0,
            flex: 1,
            textAlign: 'center',
          }}
        >
          Créer une sortie
        </h1>
        <div style={{ width: 34 }} /> {/* Équilibre visuel */}
      </div>

      {/* ── Formulaire ── */}
      <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>

          {/* Titre */}
          <div>
            <FieldLabel>Titre *</FieldLabel>
            <div style={{ position: 'relative' }}>
              <input
                style={{
                  ...inputStyle,
                  borderColor: form.title ? 'var(--accent)' : 'var(--border-color)',
                }}
                value={form.title}
                onChange={e => set('title', e.target.value)}
                maxLength={60}
                onFocus={e => e.target.style.borderColor = 'var(--accent-border)'}
                onBlur={e => e.target.style.borderColor = form.title ? 'var(--accent)' : 'var(--border-color)'}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{form.title.length}/60</span>
            </div>
            {errors.title && <ErrorMsg>{errors.title}</ErrorMsg>}
          </div>

          {/* Catégorie */}
          <div>
            <FieldLabel>Catégorie *</FieldLabel>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
              }}
            >
              {CATEGORIES.map(cat => {
                const isSelected = form.category === cat.key
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => set('category', cat.key)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      borderRadius: 14,
                      padding: '10px 4px',
                      aspectRatio: '1',
                      background: isSelected ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--surface2)',
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{cat.emoji}</span>
                    <span
                      style={{
                        fontSize: 10,
                        color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                        fontFamily: 'Syne, sans-serif',
                        fontWeight: isSelected ? 700 : 400,
                      }}
                    >
                      {cat.label}
                    </span>
                  </button>
                )
              })}
            </div>
            {/* Champ libre si "Autre" sélectionné */}
            {form.category === 'autre' && (
              <input
                style={{
                  ...inputStyle,
                  marginTop: 10,
                  borderColor: form.customCategory ? 'var(--accent)' : 'var(--border-color)',
                }}
                value={form.customCategory}
                onChange={e => set('customCategory', e.target.value)}
                maxLength={30}
                autoFocus
                onFocus={e => e.target.style.borderColor = 'var(--accent-border)'}
                onBlur={e => e.target.style.borderColor = form.customCategory ? 'var(--accent)' : 'var(--border-color)'}
              />
            )}
            {errors.category && <ErrorMsg>{errors.category}</ErrorMsg>}
          </div>

          {/* Lieu */}
          <div>
            <FieldLabel>Lieu *</FieldLabel>
            <div style={{ position: 'relative' }}>
              <input
                style={{
                  ...inputStyle,
                  borderColor: coords ? 'var(--accent)' : form.location_name ? 'var(--accent-border)' : 'var(--border-color)',
                  paddingRight: 40,
                }}
                value={form.location_name}
                onChange={e => handleLocationInput(e.target.value)}
                onFocus={e => e.target.style.borderColor = 'var(--accent-border)'}
                onBlur={e => e.target.style.borderColor = coords ? 'var(--accent)' : 'var(--border-color)'}
                autoComplete="off"
              />
              {searching && (
                <div
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 16,
                    height: 16,
                    border: '2px solid var(--accent)',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
              )}

              {/* Dropdown suggestions */}
              {suggestions.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 11,
                    zIndex: 100,
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={() => selectSuggestion(s)}
                      style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-color)' : 'none',
                        padding: '10px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'var(--text)',
                        fontSize: 13,
                        lineHeight: 1.4,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ flexShrink: 0, marginTop: 1 }}>📍</span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.location_name && <ErrorMsg>{errors.location_name}</ErrorMsg>}

            {/* Bouton "Introuvable" — bascule vers le mode pin manuel */}
            {!coords && !searching && form.location_name.length >= 3 && suggestions.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  const pos = JSON.parse(sessionStorage.getItem('nearly_user_pos') || 'null')
                  if (pos) setCoords({ lat: pos[0], lon: pos[1] })
                  setPinMode(true)
                  setSuggestions([])
                }}
                style={{
                  marginTop: 6,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--accent)',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                Introuvable ? Placez le pin sur la carte →
              </button>
            )}

            {/* Mini carte — prévisualisation ou mode pin manuel */}
            <div
              style={{
                position: 'relative',
                marginTop: 10,
                borderRadius: 14,
                overflow: 'hidden',
                border: `1px solid ${pinMode ? 'var(--accent-border)' : 'var(--border-color)'}`,
                height: pinMode ? 220 : 140,
                transition: 'height 0.2s ease',
              }}
            >
              {coords ? (
                <>
                  <MapContainer
                    key={`${coords.lat}-${coords.lon}`}
                    center={[coords.lat, coords.lon]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={pinMode}
                    attributionControl={false}
                  >
                    <TileLayer url={tileUrl} />
                    <Marker position={[coords.lat, coords.lon]} />
                    <MapClickHandler onMove={(lat, lon) => {
                      setCoords({ lat, lon })
                      setErrors(e => { const c = { ...e }; delete c.location_name; return c })
                    }} />
                  </MapContainer>
                  {pinMode && (
                    <div style={{
                      position: 'absolute',
                      bottom: 8,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'var(--bg-blur)',
                      color: 'var(--accent-text)',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 12px',
                      borderRadius: 999,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      zIndex: 500,
                    }}>
                      Touchez la carte pour déplacer le pin
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'var(--surface2)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  <span style={{ fontSize: 28 }}>📍</span>
                  <span style={{ fontSize: 12 }}>Le lieu apparaîtra ici</span>
                </div>
              )}
            </div>

            {/* Confirmation du pin manuel */}
            {pinMode && coords && (
              <button
                type="button"
                onClick={() => setPinMode(false)}
                style={{
                  marginTop: 6,
                  background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                  borderRadius: 8,
                  padding: '8px 14px',
                  color: 'var(--accent)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                ✓ Valider la position
              </button>
            )}
          </div>

          {/* Date + Heure */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Date *</FieldLabel>
              <input
                type="date"
                min={minDate}
                style={{
                  ...inputStyle,
                  borderColor: form.date ? 'var(--accent)' : 'var(--border-color)',
                }}
                value={form.date}
                onChange={e => set('date', e.target.value)}
              />
              {errors.date && <ErrorMsg>{errors.date}</ErrorMsg>}
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>Heure *</FieldLabel>
              <input
                type="time"
                style={{
                  ...inputStyle,
                  borderColor: form.time ? 'var(--accent)' : 'var(--border-color)',
                }}
                value={form.time}
                onChange={e => set('time', e.target.value)}
              />
              {errors.time && <ErrorMsg>{errors.time}</ErrorMsg>}
            </div>
          </div>

          {/* Description */}
          <div>
            <FieldLabel>Description</FieldLabel>
            <textarea
              style={{
                ...inputStyle,
                resize: 'none',
                borderColor: errors.description ? 'var(--orange)' : form.description ? 'var(--accent)' : 'var(--border-color)',
              }}
              rows={3}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              onFocus={e => e.target.style.borderColor = 'var(--accent-border)'}
              onBlur={e => e.target.style.borderColor = form.description ? 'var(--accent)' : 'var(--border-color)'}
              maxLength={2000}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {errors.description
                ? <span style={{ fontSize: 12, color: 'var(--orange)' }}>{errors.description}</span>
                : <span />}
              <span style={{ fontSize: 11, color: form.description.length < 20 ? 'var(--orange)' : 'var(--text-tertiary)' }}>
                {form.description.length}/20 min
              </span>
            </div>
          </div>

          {/* Type de sortie */}
          <div>
            <FieldLabel>Type de sortie</FieldLabel>
            <div style={{ display: 'flex', gap: 10 }}>
              {EVENT_TYPES.map(t => {
                const isSelected = form.event_type === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => set('event_type', t.key)}
                    style={{
                      flex: 1,
                      padding: '12px 0',
                      borderRadius: 11,
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                      background: isSelected ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--surface2)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: 14,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            {form.event_type === 'open' && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                Pas de limite de participants — ouvert à tous.
              </p>
            )}
          </div>

          {/* Nombre de participants — masqué en mode "Ouvert" */}
          {form.event_type === 'small_group' && (
            <div>
              <FieldLabel>Taille du groupe (3–6 personnes)</FieldLabel>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 24,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 18,
                  padding: '20px 0',
                }}
              >
                <button
                  type="button"
                  onClick={() => set('max_participants', Math.max(3, form.max_participants - 1))}
                  disabled={form.max_participants <= 3}
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'var(--surface3)', border: '1px solid var(--border-color)',
                    color: form.max_participants <= 3 ? 'var(--text-tertiary)' : 'var(--text)',
                    cursor: form.max_participants <= 3 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Minus size={18} strokeWidth={2} />
                </button>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 52, color: 'var(--accent)', lineHeight: 1, minWidth: 60, textAlign: 'center' }}>
                  {form.max_participants}
                </span>
                <button
                  type="button"
                  onClick={() => set('max_participants', Math.min(6, form.max_participants + 1))}
                  disabled={form.max_participants >= 6}
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'var(--surface3)', border: '1px solid var(--border-color)',
                    color: form.max_participants >= 6 ? 'var(--text-tertiary)' : 'var(--text)',
                    cursor: form.max_participants >= 6 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Plus size={18} strokeWidth={2} />
                </button>
              </div>
            </div>
          )}

          {/* ── Toggle validation manuelle ── */}
          <div
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0 }}>
                Je valide chaque participant
              </p>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-tertiary)', margin: '3px 0 0', lineHeight: 1.4 }}>
                Les demandes te seront envoyées : tu choisis qui rejoint la sortie.
              </p>
            </div>
            <button
              type="button"
              onClick={() => set('requires_approval', !form.requires_approval)}
              role="switch"
              aria-checked={form.requires_approval}
              style={{
                position: 'relative',
                width: 44,
                height: 26,
                borderRadius: 99,
                background: form.requires_approval ? 'var(--accent)' : 'var(--surface1)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                flexShrink: 0,
                padding: 0,
                transition: 'background 0.15s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: form.requires_approval ? 20 : 2,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: form.requires_approval ? 'var(--bg)' : 'var(--text-tertiary)',
                  transition: 'left 0.15s, background 0.15s',
                }}
              />
            </button>
          </div>

          {/* Erreur globale */}
          {errors._global && (
            <div
              style={{
                background: 'rgba(255,122,61,0.1)',
                border: '1px solid rgba(255,122,61,0.2)',
                borderRadius: 11,
                padding: '12px 16px',
                color: 'var(--orange)',
                fontSize: 14,
              }}
            >
              {errors._global}
            </div>
          )}
        </div>

        {/* ── CTA fixe bas ── */}
        <div
          style={{
            padding: '14px 20px 20px',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg)',
          }}
        >
          <button
            type="submit"
            disabled={!isValid || loading}
            style={{
              width: '100%',
              background: isValid ? 'var(--accent)' : 'var(--surface2)',
              color: isValid ? 'var(--bg)' : 'var(--text-tertiary)',
              fontWeight: 700,
              fontSize: 15,
              fontFamily: 'DM Sans, sans-serif',
              padding: '14px 0',
              borderRadius: 11,
              border: 'none',
              cursor: isValid && !loading ? 'pointer' : 'not-allowed',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.15s',
            }}
          >
            {loading && (
              <span
                style={{
                  width: 16,
                  height: 16,
                  border: '2px solid color-mix(in srgb, var(--on-accent) 30%, transparent)',
                  borderTop: '2px solid var(--on-accent)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block',
                }}
              />
            )}
            Publier la sortie
          </button>
        </div>
      </form>
    </div>
  )
}

// Label de champ de formulaire
function FieldLabel({ children }) {
  return (
    <p
      style={{
        fontSize: 10,
        fontFamily: 'Syne, sans-serif',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--text-tertiary)',
        marginBottom: 8,
      }}
    >
      {children}
    </p>
  )
}

// Message d'erreur de champ
function ErrorMsg({ children }) {
  return (
    <p style={{ fontSize: 12, color: 'var(--orange)', marginTop: 4 }}>{children}</p>
  )
}
