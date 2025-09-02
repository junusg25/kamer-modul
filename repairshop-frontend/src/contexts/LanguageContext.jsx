import React, { createContext, useContext, useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { t, tPlural } from '../utils/translations'
import { tBs, tPluralBs } from '../utils/translations-bs'

const LanguageContext = createContext()

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    // Get language from localStorage or default to 'en'
    return localStorage.getItem('language') || 'en'
  })

  // Save language preference to localStorage
  useEffect(() => {
    localStorage.setItem('language', currentLanguage)
  }, [currentLanguage])

  // Translation function that switches based on current language
  const translate = (key, params = {}) => {
    if (currentLanguage === 'bs') {
      return tBs(key, params)
    }
    return t(key, params)
  }

  // Pluralization function that switches based on current language
  const translatePlural = (key, count, params = {}) => {
    if (currentLanguage === 'bs') {
      return tPluralBs(key, count, params)
    }
    return tPlural(key, count, params)
  }

  // Date formatting function - DD.MM.YYYY format
  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
      return format(date, 'dd.MM.yyyy')
    } catch (error) {
      console.error('Error formatting date:', error)
      return '-'
    }
  }

  // Time formatting function - 24-hour format (HH:mm)
  const formatTime = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
      return format(date, 'HH:mm')
    } catch (error) {
      console.error('Error formatting time:', error)
      return '-'
    }
  }

  // DateTime formatting function - DD.MM.YYYY HH:mm format
  const formatDateTime = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
      return format(date, 'dd.MM.yyyy HH:mm')
    } catch (error) {
      console.error('Error formatting datetime:', error)
      return '-'
    }
  }

  // Date only formatting function - DD.MM.YYYY format (alias for formatDate)
  const formatDateOnly = formatDate

  // Time only formatting function - HH:mm format (alias for formatTime)
  const formatTimeOnly = formatTime

  // Convert DD.MM.YYYY format to YYYY-MM-DD for HTML5 date inputs
  const formatDateForInput = (dateString) => {
    if (!dateString) return ''
    try {
      const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
      return format(date, 'yyyy-MM-dd')
    } catch (error) {
      console.error('Error formatting date for input:', error)
      return ''
    }
  }

  // Convert DD.MM.YYYY HH:mm format to YYYY-MM-DDTHH:mm for HTML5 datetime-local inputs
  const formatDateTimeForInput = (dateString) => {
    if (!dateString) return ''
    try {
      const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
      return format(date, "yyyy-MM-dd'T'HH:mm")
    } catch (error) {
      console.error('Error formatting datetime for input:', error)
      return ''
    }
  }

  // Parse DD.MM.YYYY format back to Date object
  const parseFormattedDate = (formattedDate) => {
    if (!formattedDate) return null
    try {
      // Parse DD.MM.YYYY format
      const [day, month, year] = formattedDate.split('.')
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    } catch (error) {
      console.error('Error parsing formatted date:', error)
      return null
    }
  }

  // Parse DD.MM.YYYY HH:mm format back to Date object
  const parseFormattedDateTime = (formattedDateTime) => {
    if (!formattedDateTime) return null
    try {
      // Parse DD.MM.YYYY HH:mm format
      const [datePart, timePart] = formattedDateTime.split(' ')
      const [day, month, year] = datePart.split('.')
      const [hour, minute] = timePart.split(':')
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute))
    } catch (error) {
      console.error('Error parsing formatted datetime:', error)
      return null
    }
  }

  // Change language function
  const changeLanguage = (language) => {
    setCurrentLanguage(language)
  }

  // Get available languages
  const getAvailableLanguages = () => [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'bs', name: 'Bosanski', flag: '🇧🇦' }
  ]

  // Get current language info
  const getCurrentLanguageInfo = () => {
    return getAvailableLanguages().find(lang => lang.code === currentLanguage)
  }

  const value = {
    currentLanguage,
    changeLanguage,
    translate,
    translatePlural,
    formatDate,
    formatTime,
    formatDateTime,
    formatDateOnly,
    formatTimeOnly,
    formatDateForInput,
    formatDateTimeForInput,
    parseFormattedDate,
    parseFormattedDateTime,
    getAvailableLanguages,
    getCurrentLanguageInfo,
    isBosnian: currentLanguage === 'bs',
    isEnglish: currentLanguage === 'en'
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export default LanguageProvider
