// Fond de carte CARTO (Positron en clair / Dark Matter en sombre).
// Depuis 2025, CARTO exige une clé API (paramètre ?key=) même pour les basemaps.
// Clé gratuite : https://carto.com/basemaps — à renseigner dans VITE_CARTO_KEY (.env).
const CARTO_KEY = import.meta.env.VITE_CARTO_KEY

/**
 * Retourne le template d'URL des tuiles CARTO pour un <TileLayer> Leaflet.
 * @param {string} theme - 'light' ou 'dark'
 * @returns {string} URL template (avec la clé API si disponible)
 */
export function getTileUrl(theme) {
  const style = theme === 'light' ? 'light_all' : 'dark_all'
  const base = `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`
  return CARTO_KEY ? `${base}?key=${CARTO_KEY}` : base
}
