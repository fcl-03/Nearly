import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Envoie les cookies httpOnly automatiquement
})

// Gérer l'expiration du token — tentative de refresh automatique via cookie
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    // Ne jamais tenter de refresh sur les endpoints d'auth eux-mêmes :
    // un 401 de /auth/login (mauvais mot de passe) déclencherait refresh → échec
    // → logout + reload de la page, effaçant le message d'erreur du formulaire.
    const isAuthRoute = original?.url?.startsWith('/auth/')
    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true
      try {
        // Le refresh token est dans un cookie httpOnly — le backend le lit automatiquement
        await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true })
        // Nouveau access_token placé dans le cookie par le backend — on rejoue la requête
        return api(original)
      } catch {
        useAuthStore.getState().logout()
        // Éviter une boucle de reload si on est déjà sur la page de login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default api
