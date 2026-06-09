"use client"

import { Header } from "@/components/header"
import { WasteLoggerForm } from "@/components/waste-logger-form"
import { useLanguage } from "@/contexts/language-context"

export default function LogWastePage() {
  const { t } = useLanguage()
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">{t("logWaste.title")}</h1>
          <p className="text-muted-foreground">{t("logWaste.subtitle")}</p>
        </div>
        <WasteLoggerForm />
      </main>
    </div>
  )
}
