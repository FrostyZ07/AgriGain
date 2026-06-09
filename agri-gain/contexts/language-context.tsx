"use client"

import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react'
import { Language, translations } from '@/lib/translations'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Initialize with 'en' to avoid SSR hydration issues
  // Will be updated from localStorage on client mount
  const [language, setLanguageState] = useState<Language>('en')

  // Load language from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedLanguage = localStorage.getItem('language') as Language
        if (savedLanguage === 'en' || savedLanguage === 'hi') {
          setLanguageState(savedLanguage)
        }
      } catch (error) {
        // Ignore localStorage errors (e.g., in private browsing)
      }
    }
  }, [])

  // Save language to localStorage when it changes - memoized for stability
  const setLanguage = useCallback((lang: Language) => {
    if (lang === 'en' || lang === 'hi') {
      setLanguageState((currentLang) => {
        // Only update if actually different
        return currentLang !== lang ? lang : currentLang
      })
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('language', lang)
        } catch (error) {
          // Ignore localStorage errors
        }
      }
    }
  }, [])

  // Translation function - memoized based on language
  const t = useCallback((key: string): string => {
    try {
      const keys = key.split('.')
      let value: any = translations[language]
      
      for (const k of keys) {
        value = value?.[k]
        if (value === undefined) {
          // Fallback to English if translation missing
          value = translations.en
          for (const k2 of keys) {
            value = value?.[k2]
          }
          break
        }
      }
      
      return typeof value === 'string' ? value : key
    } catch (error) {
      return key
    }
  }, [language])

  // Context value - memoize based on language to ensure React detects changes
  const value: LanguageContextType = useMemo(() => ({
    language,
    setLanguage,
    t
  }), [language, setLanguage, t])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

