import { useState } from 'react'
import api from '../../services/api'
import { CATEGORIES } from '../../utils/categories'

// Convertit une date ISO en valeur pour <input type="datetime-local"> (heure locale)
function toLocalInput(iso) {
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const field = {
  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border-color)',
  borderRadius: 11, padding: '11px 14px', color: 'var(--text)', fontFamily: 'DM Sans, sans-serif',
  outline: 'none', boxSizing: 'border-box',
}
const lbl = { fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans, sans-serif', marginBottom: 4, display: 'block' }

// Modale d'édition d'une sortie (créateur, dans les 12h — le backend fait foi).
// Champs éditables : titre, description, catégorie, date. (Le lieu et le nombre
// de participants ne sont pas éditables ici.)
export default function EditEventModal({ event, onClose, onSaved }) {
  const [title, setTitle] = useState(event.title || '')
  const [description, setDescription] = useState(event.description || '')
  const [category, setCategory] = useState(event.category || '')
  const [startsAt, setStartsAt] = useState(toLocalInput(event.starts_at))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setError('')
    if (title.trim().length < 3) { setError('Le titre doit faire au moins 3 caractères.'); return }
    if (description.trim().length < 5) { setError('La description doit faire au moins 5 caractères.'); return }
    setSaving(true)
    try {
      const { data } = await api.put(`/events/${event.id}`, {
        title: title.trim(),
        description: description.trim(),
        category,
        starts_at: new Date(startsAt).toISOString(),
      })
      onSaved?.(data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Impossible de modifier la sortie.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '24px 20px', maxHeight: '88vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--text)', margin: 0 }}>Modifier la sortie</h2>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Les participants déjà inscrits seront prévenus. Modifiable jusqu'à 12h après la création.</p>

        <div>
          <label style={lbl}>Titre</label>
          <input style={field} value={title} onChange={e => setTitle(e.target.value)} maxLength={60} />
        </div>

        <div>
          <label style={lbl}>Description</label>
          <textarea style={{ ...field, minHeight: 80, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} />
        </div>

        <div>
          <label style={lbl}>Catégorie</label>
          {/* Même grille d'icônes que la page « Créer une sortie » (cohérence visuelle) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {CATEGORIES.map(cat => {
              const isSelected = category === cat.key
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 6, borderRadius: 14, padding: '10px 4px', aspectRatio: '1',
                    background: isSelected ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--surface2)',
                    border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{cat.emoji}</span>
                  <span style={{ fontSize: 10, color: isSelected ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: 'Syne, sans-serif', fontWeight: isSelected ? 700 : 400 }}>
                    {cat.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label style={lbl}>Date et heure</label>
          <input type="datetime-local" style={field} value={startsAt} onChange={e => setStartsAt(e.target.value)} />
        </div>

        {error && <p style={{ color: 'var(--orange)', fontSize: 13, margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '13px 0', borderRadius: 11, border: '1px solid var(--border-color)', background: 'none', color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '13px 0', borderRadius: 11, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontFamily: 'Syne, sans-serif', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}
