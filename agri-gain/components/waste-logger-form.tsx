"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { StepIndicator } from "./step-indicator"
import { VisualSelector } from "./visual-selector"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle, AlertCircle, Info } from "lucide-react"
import { api, mapWasteType, mapUnit, handleApiError, type ApiError, type QuantificationInfo } from "@/lib/api"
import { useLanguage } from "@/contexts/language-context"

export function WasteLoggerForm() {
  const { t, language } = useLanguage()
  
  // Default fallback options - translated
  const DEFAULT_WASTE_TYPES = useMemo(() => [
    { id: "rice", label: t("wasteTypes.rice"), icon: "🌾" },
    { id: "sugarcane", label: t("wasteTypes.sugarcane"), icon: "🎋" },
    { id: "vegetable", label: t("wasteTypes.vegetable"), icon: "🥬" },
    { id: "fruit", label: t("wasteTypes.fruit"), icon: "🍎" },
    { id: "corn", label: t("wasteTypes.corn"), icon: "🌽" },
    { id: "wheat", label: t("wasteTypes.wheat"), icon: "🌾" },
    { id: "coconut", label: t("wasteTypes.coconut"), icon: "🥥" },
    { id: "cotton", label: t("wasteTypes.cotton"), icon: "🌾" },
    { id: "other", label: t("wasteTypes.other"), icon: "📦" },
  ], [t])

  const DEFAULT_UNITS = useMemo(() => [
    { id: "sacks", label: t("units.sacks"), icon: "🎒" },
    { id: "wheelbarrows", label: t("units.wheelbarrows"), icon: "🛒" },
    { id: "crates", label: t("units.crates"), icon: "📦" },
    { id: "baskets", label: t("units.baskets"), icon: "🧺" },
    { id: "bags", label: t("units.bags"), icon: "👜" },
    { id: "trucks", label: t("units.trucks"), icon: "🚛" },
  ], [t])
  // Form state
  const [currentStep, setCurrentStep] = useState(1)
  const [wasteType, setWasteType] = useState<string | null>(null)
  const [quantity, setQuantity] = useState("")
  const [unit, setUnit] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  
  // API state
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [wasteLogId, setWasteLogId] = useState<string | null>(null)
  const [estimatedKg, setEstimatedKg] = useState<number | null>(null)
  
  // Dynamic data from backend
  const [wasteTypes, setWasteTypes] = useState(DEFAULT_WASTE_TYPES)
  const [units, setUnits] = useState(DEFAULT_UNITS)
  const [quantificationInfo, setQuantificationInfo] = useState<QuantificationInfo | null>(null)
  
  // Load available waste types and units from backend
  useEffect(() => {
    const loadQuantificationData = async () => {
      setLoading(true)
      try {
        const info = await api.getQuantificationInfo()
        setQuantificationInfo(info)
        
        // Transform backend waste types to frontend format
        const backendWasteTypes = info.available_waste_types.map(type => {
          const displayName = type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
          const frontendId = type.replace('_husks', '').replace('_bagasse', '').replace('_trimmings', '').replace('_stalks', '').replace('_straw', '').replace('_leaves', '').replace('_seeds', '')
          
          return {
            id: frontendId,
            label: displayName,
            icon: getWasteIcon(type)
          }
        })
        
        const backendUnits = info.available_units.map(unit => ({
          id: unit,
          label: unit.charAt(0).toUpperCase() + unit.slice(1),
          icon: getUnitIcon(unit)
        }))
        
        setWasteTypes([...backendWasteTypes, ...DEFAULT_WASTE_TYPES.filter(dt => 
          !backendWasteTypes.some(bt => bt.id === dt.id)
        )])
        setUnits([...backendUnits, ...DEFAULT_UNITS.filter(du => 
          !backendUnits.some(bu => bu.id === du.id)
        )])
        
      } catch (err) {
        console.warn('Could not load quantification data, using defaults:', err)
        // Keep using default data - no need to show error for this
      } finally {
        setLoading(false)
      }
    }
    
    loadQuantificationData()
  }, [])

  const handleNext = () => {
    setError(null)
    
    if (currentStep === 1 && !wasteType) {
      setError(language === 'hi' ? 'कृपया अपशिष्ट प्रकार चुनें' : 'Please select a waste type')
      return
    }
    if (currentStep === 2) {
      if (!quantity || parseInt(quantity) <= 0) {
        setError(language === 'hi' ? 'कृपया एक वैध मात्रा दर्ज करें' : 'Please enter a valid quantity')
        return
      }
      if (!unit) {
        setError(language === 'hi' ? 'कृपया एक इकाई चुनें' : 'Please select a unit')
        return
      }
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    setError(null)
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    if (!wasteType || !unit || !quantity) {
      setError(language === 'hi' ? 'कृपया सभी आवश्यक फ़ील्ड भरें' : 'Please fill in all required fields')
      return
    }

    setSubmitting(true)
    setError(null)
    
    try {
      // Generate a user ID (in real app, this would come from auth)
      const userId = `user_${Date.now()}`
      
      const response = await api.logWaste({
        userId,
        waste_type: mapWasteType(wasteType),
        unit_name: mapUnit(unit),
        quantity: parseInt(quantity),
        notes: notes.trim() || undefined
      })
      
      if (response.success) {
        setSuccess(true)
        setWasteLogId(response.waste_log_id)
        setEstimatedKg(response.estimated_kg)
        
        // Auto-advance to next step or redirect after success
        setTimeout(() => {
          if (response.waste_log_id) {
            // Redirect to opportunities page with the waste log ID
            window.location.href = `/opportunities?wasteLogId=${response.waste_log_id}&userId=${userId}`
          }
        }, 3000)
      } else {
        setError(response.message || "Failed to log waste")
      }
    } catch (err) {
      const apiError = err as ApiError
      setError(handleApiError(apiError))
    } finally {
      setSubmitting(false)
    }
  }
  
  const resetForm = () => {
    setCurrentStep(1)
    setWasteType(null)
    setQuantity("")
    setUnit(null)
    setNotes("")
    setError(null)
    setSuccess(false)
    setWasteLogId(null)
    setEstimatedKg(null)
  }
  
  // Helper functions for icons
  const getWasteIcon = (wasteType: string): string => {
    const iconMap: Record<string, string> = {
      'rice_husks': '🌾',
      'sugarcane_bagasse': '🎋',
      'vegetable_trimmings': '🥬',
      'fruit_seeds': '🍎',
      'corn_stalks': '🌽',
      'wheat_straw': '🌾',
      'coconut_husks': '🥥',
      'cotton_stalks': '🌾',
      'banana_leaves': '🍌',
      'mixed_waste': '📦'
    }
    return iconMap[wasteType] || '📦'
  }
  
  const getUnitIcon = (unit: string): string => {
    const iconMap: Record<string, string> = {
      'sacks': '🎒',
      'wheelbarrows': '🛒',
      'crates': '📦',
      'baskets': '🧺',
      'bags': '👜',
      'trucks': '🚛'
    }
    return iconMap[unit] || '📦'
  }

  // Show loading state while fetching quantification data
  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <Card className="p-8 bg-card border-border">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-foreground">{t("common.loading")}</span>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <StepIndicator currentStep={currentStep} totalSteps={3} />

      <Card className="p-6 sm:p-8 bg-card border-border">
        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-destructive/50 text-destructive dark:border-destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Success State */}
        {success && wasteLogId && (
          <div className="space-y-4 animate-in fade-in">
            <Alert className="border-green-500/50 text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {t("logWaste.success")} {estimatedKg && `${t("logWaste.estimatedWeight")}: ${estimatedKg} kg`}
              </AlertDescription>
            </Alert>
            <div className="text-center">
              <p className="text-muted-foreground mb-4">{t("logWaste.redirecting")}</p>
              <Button onClick={resetForm} variant="outline">
                {t("logWaste.logAnother")}
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 1: Waste Type */}
        {!success && currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">{t("logWaste.step1")}</h2>
              <p className="text-muted-foreground">{t("logWaste.step1Desc")}</p>
              {quantificationInfo && (
                <div className="mt-2 text-sm text-muted-foreground">
                  <Info className="inline w-4 h-4 mr-1" />
                  {quantificationInfo.total_models} {t("logWaste.conversionModels")}
                </div>
              )}
            </div>
            <VisualSelector options={wasteTypes} selected={wasteType} onChange={setWasteType} />
          </div>
        )}

        {/* Step 2: Quantity */}
        {!success && currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">{t("logWaste.step2")}</h2>
              <p className="text-muted-foreground">{t("logWaste.step2Desc")}</p>
              {wasteType && (
                <div className="mt-2 flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">{language === 'hi' ? 'चयनित:' : 'Selected:'}</span>
                  <span className="text-sm font-medium text-foreground">
                    {wasteTypes.find(w => w.id === wasteType)?.label}
                  </span>
                  <span className="text-xl">{wasteTypes.find(w => w.id === wasteType)?.icon}</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t("logWaste.quantity")} *</label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={language === 'hi' ? 'मात्रा दर्ज करें' : 'Enter quantity'}
                  className="bg-background border-border"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-3">{t("logWaste.unit")} *</label>
                <VisualSelector options={units} selected={unit} onChange={setUnit} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Additional Details */}
        {!success && currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">{t("logWaste.step3")}</h2>
              <p className="text-muted-foreground">{t("logWaste.step3Desc")}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t("logWaste.notes")}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("logWaste.notesPlaceholder")}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
                disabled={submitting}
              />
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground mb-2">{t("logWaste.reviewTitle")}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{language === 'hi' ? 'अपशिष्ट प्रकार:' : 'Waste Type:'}</span>
                  <span className="ml-2 font-medium text-foreground">
                    {wasteTypes.find((w) => w.id === wasteType)?.label}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("logWaste.quantity")}:</span>
                  <span className="ml-2 font-medium text-foreground">
                    {quantity} {units.find((u) => u.id === unit)?.label}
                  </span>
                </div>
                {quantificationInfo && wasteType && unit && quantity && (
                  <div className="col-span-2 pt-2 border-t border-primary/30">
                    <span className="text-muted-foreground">{t("logWaste.estimatedWeight")}</span>
                    <span className="ml-2 font-bold text-primary">
                      {(() => {
                        const mappedWasteType = mapWasteType(wasteType)
                        const mappedUnit = mapUnit(unit)
                        const conversionKey = `${mappedWasteType}_${mappedUnit}`
                        const conversionFactor = quantificationInfo.conversion_factors[conversionKey]
                        return conversionFactor ? `~${(parseFloat(quantity) * conversionFactor).toFixed(1)} kg` : (language === 'hi' ? 'गणना...' : 'Calculating...')
                      })()} 
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        {!success && (
          <div className="flex gap-3 mt-8 pt-6 border-t border-border">
            <Button
              onClick={handleBack}
              variant="outline"
              className="flex-1 border-border text-foreground hover:bg-muted bg-transparent"
              disabled={currentStep === 1 || submitting}
            >
              {t("logWaste.back")}
            </Button>
            {currentStep < 3 ? (
              <Button 
                onClick={handleNext} 
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={submitting}
              >
                {t("logWaste.next")}
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={submitting || !wasteType || !unit || !quantity}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("logWaste.submitting")}
                  </>
                ) : (
                  t("logWaste.submit")
                )}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
