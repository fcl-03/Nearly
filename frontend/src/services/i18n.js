import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from '../locales/fr.json'
import en from '../locales/en.json'

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: navigator.language?.startsWith('en') ? 'en' : 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
})

// Synchroniser l'attribut lang du document avec la langue active
document.documentElement.lang = i18n.language
i18n.on('languageChanged', (lng) => { document.documentElement.lang = lng })

export default i18n
