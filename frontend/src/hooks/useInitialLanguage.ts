import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'

export const useInitialLanguage = () => {
  const { i18n } = useTranslation()

  useEffect(() => {
    const loadLanguageFromServer = async () => {
      try {
        const response = await apiService.request('/system-settings/app_language', { 
          method: 'GET' 
        })
        const language = response?.data?.value || 'en'
        
        // Only change language if it's different from current
        if (i18n.language !== language) {
          await i18n.changeLanguage(language)
        }
      } catch (error) {
        console.error('Error loading language from server:', error)
        // Fallback to default language
        if (i18n.language !== 'en') {
          await i18n.changeLanguage('en')
        }
      }
    }

    loadLanguageFromServer()
  }, [i18n])

  return { loading: !i18n.isInitialized }
}
