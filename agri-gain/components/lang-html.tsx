"use client"

import { useEffect } from 'react'
import { useLanguage } from '@/contexts/language-context'

export function LangHtml() {
  const { language } = useLanguage()

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined' && language) {
      try {
        document.documentElement.lang = language === 'hi' ? 'hi' : 'en'
      } catch (error) {
        // Ignore errors setting lang attribute
      }
    }
  }, [language])

  return null
}

