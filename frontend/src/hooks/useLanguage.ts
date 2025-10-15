import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'

export const useLanguage = () => {
  const { i18n } = useTranslation()
  const [currentLanguage, setCurrentLanguage] = useState<string>('en')
  const [loading, setLoading] = useState(true)

  // Load current language from server
  useEffect(() => {
    loadCurrentLanguage()
  }, [])

  const loadCurrentLanguage = async () => {
    try {
      setLoading(true)
      const response = await apiService.request('/system-settings/app_language', { method: 'GET' })
      const language = response?.value || 'en'
      setCurrentLanguage(language)
      i18n.changeLanguage(language)
    } catch (error) {
      console.error('Error loading current language:', error)
      // Fallback to default
      setCurrentLanguage('en')
      i18n.changeLanguage('en')
    } finally {
      setLoading(false)
    }
  }

  const changeLanguage = async (language: string) => {
    try {
      // Update on server
      await apiService.request('/system-settings/app_language', {
        method: 'POST',
        body: JSON.stringify({ value: language })
      })
      
      // Update locally
      setCurrentLanguage(language)
      i18n.changeLanguage(language)
      
      return true
    } catch (error) {
      console.error('Error changing language:', error)
      return false
    }
  }

  const getAvailableLanguages = () => [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'bs', name: 'Bosanski', flag: '🇧🇦' }
  ]

  return {
    currentLanguage,
    loading,
    changeLanguage,
    getAvailableLanguages,
    isEnglish: currentLanguage === 'en',
    isBosnian: currentLanguage === 'bs'
  }
}
