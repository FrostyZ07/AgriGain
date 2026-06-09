"use client"

import { LanguageProvider } from '@/contexts/language-context'
import { LangHtml } from '@/components/lang-html'
import { ReactNode } from 'react'

export function LanguageProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <LangHtml />
      {children}
    </LanguageProvider>
  )
}

