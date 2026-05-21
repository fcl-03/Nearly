import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import 'leaflet/dist/leaflet.css'
import './index.css'
import './stores/themeStore' // initialise le thème dès le chargement
import App from './App.jsx'

// Initialisation Sentry (monitoring d'erreurs en production)
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
