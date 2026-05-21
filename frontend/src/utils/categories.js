export const CATEGORIES = [
  { key: 'ciné',    label: 'Ciné',    emoji: '🎬', color: '#7C6FF7' },
  { key: 'sport',   label: 'Sport',   emoji: '⚽', color: '#3DDB82' },
  { key: 'bar',     label: 'Bar',     emoji: '🍺', color: '#FF7A3D' },
  { key: 'balade',  label: 'Balade',  emoji: '🚶', color: '#3DDB82' },
  { key: 'musique', label: 'Musique', emoji: '🎵', color: '#7C6FF7' },
  { key: 'jeux',    label: 'Jeux',    emoji: '🎲', color: '#FF7A3D' },
  { key: 'expos',   label: 'Expos',   emoji: '🎨', color: '#7C6FF7' },
  { key: 'échecs',  label: 'Échecs',  emoji: '♟️', color: '#C4D400' },
  { key: 'autre',   label: 'Autre',   emoji: '✨', color: '#858AA8' },
]

export const INTERESTS = [
  { emoji: '🎬', label: 'Ciné' },
  { emoji: '⚽', label: 'Sport' },
  { emoji: '🍺', label: 'Bar' },
  { emoji: '🚶', label: 'Balade' },
  { emoji: '🎵', label: 'Musique' },
  { emoji: '🎲', label: 'Jeux' },
  { emoji: '♟️', label: 'Échecs' },
  { emoji: '📚', label: 'Lecture' },
  { emoji: '🍳', label: 'Cuisine' },
  { emoji: '✈️', label: 'Voyage' },
  { emoji: '📸', label: 'Photo' },
  { emoji: '🎨', label: 'Expos' },
  { emoji: '⛰️', label: 'Randos' },
  { emoji: '🎭', label: 'Théâtre' },
  { emoji: '📖', label: 'Manga' },
  { emoji: '🚴', label: 'Vélo' },
  { emoji: '🧘', label: 'Yoga' },
]

export function getCat(key) {
  return CATEGORIES.find(c => c.key === key?.toLowerCase())
    || { emoji: '✨', label: key || 'Autre', color: '#858AA8' }
}

// Formate la date du dernier message (style messagerie)
export function formatLastMessage(isoString) {
  if (!isoString) return null
  const d = new Date(isoString)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)

  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `${diffMin} min`
  if (d >= todayStart) {
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    return `${h}h${m}`
  }
  if (d >= yesterdayStart) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function formatTime(isoString) {
  const d = new Date(isoString)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart.getTime() + 86400000)
  const dayAfterStart = new Date(tomorrowStart.getTime() + 86400000)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  const time = `${h}h${m !== '00' ? m : ''}`
  if (d >= todayStart && d < tomorrowStart) return { time, label: 'Ce soir' }
  if (d >= tomorrowStart && d < dayAfterStart) return { time, label: 'Demain' }
  return {
    time,
    label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
  }
}
