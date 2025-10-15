import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import enCommon from '../locales/en/common.json'
import enSettings from '../locales/en/settings.json'
import bsCommon from '../locales/bs/common.json'
import bsSettings from '../locales/bs/settings.json'

const resources = {
  en: {
    common: enCommon,
    settings: enSettings,
  },
  bs: {
    common: bsCommon,
    settings: bsSettings,
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    ns: ['common', 'settings'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false // React already does escaping
    },
    detection: {
      // Disable automatic language detection since we'll control it via admin settings
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    }
  })

export default i18n
