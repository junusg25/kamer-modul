import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import Backend from 'i18next-http-backend'

// Initialize i18n with HTTP backend for dynamic loading
i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: 'bs', // default language
    fallbackLng: 'bs',
    ns: ['common', 'settings'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false // React already does escaping
    },
    detection: {
      // Disable automatic language detection since we'll control it via admin settings
      order: [],
      caches: [],
    },
    backend: {
      // Load translation files from the public folder
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    }
  })

export default i18n
