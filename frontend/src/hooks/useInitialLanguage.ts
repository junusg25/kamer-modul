import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import apiService from '../services/api'

// Global flag to prevent multiple simultaneous language loads
let isLanguageLoading = false

export const useInitialLanguage = () => {
  const { i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    const loadLanguageFromServer = async () => {
      // Skip language loading on login page or if already loading
      if (location.pathname === '/login' || isLanguageLoading) {
        setLoading(false)
        return
      }
      
      isLanguageLoading = true
      
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
      } finally {
        isLanguageLoading = false
        setLoading(false)
      }
    }

    // Only load if i18n is ready and we haven't loaded yet
    if (i18n.isInitialized && loading) {
      loadLanguageFromServer()
    }
  }, [i18n, loading, location.pathname])

  return { loading }
}
