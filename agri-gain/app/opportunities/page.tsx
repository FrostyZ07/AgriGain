"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { OpportunityCard } from "@/components/opportunity-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { Loader2, RefreshCw, AlertCircle, CheckCircle, Info, Clock, Database, Zap } from "lucide-react"
import { FaSearch } from "react-icons/fa"
import { api, handleApiError, formatOpportunityText, parseStructuredOpportunities, type ApiError, type OpportunitiesResponse, type HowToGuide } from "@/lib/api"
import { useLanguage } from "@/contexts/language-context"

interface ProcessedOpportunity {
  id: string
  title: string
  description: string
  wasteType: string
  difficulty: "Easy" | "Medium" | "Hard"
  category: "on_farm_use" | "local_sale" | "process_and_sell"
  icon: string
  revenue?: string
}

// Fallback static opportunities for when backend is unavailable
const FALLBACK_OPPORTUNITIES: ProcessedOpportunity[] = [
  {
    id: "fallback_1",
    title: "Rice Husk Briquettes",
    description: "Convert rice husks into high-energy briquettes for fuel and heating applications.",
    wasteType: "Rice Husks",
    difficulty: "Medium" as const,
    category: "process_and_sell",
    icon: "🔥",
    revenue: "₹5,000 - ₹15,000/month"
  },
  {
    id: "fallback_2",
    title: "Sugarcane Bagasse Pulp",
    description: "Process bagasse into pulp for paper and packaging manufacturing.",
    wasteType: "Sugarcane Bagasse",
    difficulty: "Hard" as const,
    category: "process_and_sell",
    icon: "📄",
    revenue: "₹8,000 - ₹20,000/month"
  },
  {
    id: "fallback_3",
    title: "Vegetable Compost",
    description: "Create nutrient-rich compost from vegetable trimmings for organic farming.",
    wasteType: "Vegetable Trimmings",
    difficulty: "Easy" as const,
    category: "on_farm_use",
    icon: "🌱",
    revenue: "₹2,000 - ₹8,000/month"
  }
]

function OpportunitiesPageContent() {
  const searchParams = useSearchParams()
  const wasteLogId = searchParams.get('wasteLogId')
  const userId = searchParams.get('userId')
  const { t, language } = useLanguage()
  
  // UI state
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  
  // Backend state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiOpportunities, setAiOpportunities] = useState<OpportunitiesResponse | null>(null)
  const [processedOpportunities, setProcessedOpportunities] = useState<ProcessedOpportunity[]>([])
  const [guides, setGuides] = useState<HowToGuide[]>([])
  const [showingFallback, setShowingFallback] = useState(false)
  const [attemptedPersonalized, setAttemptedPersonalized] = useState(false)
  
  // Load AI-generated opportunities if waste log ID is provided
  useEffect(() => {
    const loadAiOpportunities = async () => {
      if (!wasteLogId || !userId) {
        console.log('No waste log ID provided, showing general opportunities')
        setProcessedOpportunities(FALLBACK_OPPORTUNITIES)
        setShowingFallback(true)
        setAttemptedPersonalized(false)
        return
      }
      
      setLoading(true)
      setError(null)
      setAttemptedPersonalized(true)
      
      try {
        const response = await api.getOpportunities({ userId, waste_log_id: wasteLogId })
        setAiOpportunities(response)
        
        // Process AI response into structured opportunities
        const processed = processAiOpportunities(response)
        if (processed.length === 0) {
          setProcessedOpportunities(FALLBACK_OPPORTUNITIES)
          setShowingFallback(true)
        } else {
          setProcessedOpportunities(processed)
          setShowingFallback(false)
        }
        
      } catch (err) {
        console.error('Failed to load AI opportunities:', err)
        const apiError = err as ApiError
        
        // Only show error for database issues if we actually have waste log data to process
        // For general browsing, just fall back to static opportunities silently
        const errorMessage = handleApiError(apiError)
        if (errorMessage.includes('Database service') || errorMessage.includes('Service temporarily unavailable')) {
          console.warn('Database not available for personalized opportunities, showing general opportunities')
          // Don't set error for database issues - just use fallback
        } else {
          // Show error for other types of failures
          setError(errorMessage)
        }
        
        // Fallback to static opportunities
        setProcessedOpportunities(FALLBACK_OPPORTUNITIES)
        setShowingFallback(true)
      } finally {
        setLoading(false)
      }
    }
    
    loadAiOpportunities()
  }, [wasteLogId, userId])
  
  // Load available guides
  useEffect(() => {
    const loadGuides = async () => {
      try {
        const guidesResponse = await api.getGuides()
        if (guidesResponse.guides) {
          const fullGuides = await Promise.all(
            guidesResponse.guides.slice(0, 5).map(async (guide) => {
              if (guide.guide_id) {
                try {
                  return await api.getGuide(guide.guide_id)
                } catch {
                  return null
                }
              }
              return null
            })
          )
          setGuides(fullGuides.filter(Boolean) as HowToGuide[])
        }
      } catch (err) {
        console.warn('Could not load guides:', err)
      }
    }
    
    loadGuides()
  }, [])
  
  // Process AI opportunities into structured format
  const processAiOpportunities = (response: OpportunitiesResponse): ProcessedOpportunity[] => {
    const opportunities: ProcessedOpportunity[] = []
    
    // If we have structured opportunities, use them
    if (response.structured_opportunities) {
      const { on_farm_use, local_sale, process_and_sell } = response.structured_opportunities
      
      on_farm_use.forEach((opp, index) => {
        opportunities.push({
          id: `on_farm_${index}`,
          title: extractTitle(opp),
          description: extractDescription(opp),
          wasteType: response.waste_info?.waste_type || 'Agricultural Waste',
          difficulty: 'Easy',
          category: 'on_farm_use',
          icon: getCategoryIcon('on_farm_use')
        })
      })
      
      local_sale.forEach((opp, index) => {
        opportunities.push({
          id: `local_sale_${index}`,
          title: extractTitle(opp),
          description: extractDescription(opp),
          wasteType: response.waste_info?.waste_type || 'Agricultural Waste',
          difficulty: 'Medium',
          category: 'local_sale',
          icon: getCategoryIcon('local_sale')
        })
      })
      
      process_and_sell.forEach((opp, index) => {
        opportunities.push({
          id: `process_sell_${index}`,
          title: extractTitle(opp),
          description: extractDescription(opp),
          wasteType: response.waste_info?.waste_type || 'Agricultural Waste',
          difficulty: 'Hard',
          category: 'process_and_sell',
          icon: getCategoryIcon('process_and_sell')
        })
      })

      if (opportunities.length === 0 && response.opportunities_text && !isAiErrorText(response.opportunities_text)) {
        return opportunitiesFromRawText(response)
      }
    } else {
      // Parse from raw text if structured data isn't available
      const structured = parseStructuredOpportunities(response.opportunities_text)
      const hasParsed =
        structured.on_farm_use.length + structured.local_sale.length + structured.process_and_sell.length > 0
      if (hasParsed) {
        return processAiOpportunities({ ...response, structured_opportunities: structured })
      }
      if (response.opportunities_text && !isAiErrorText(response.opportunities_text)) {
        return opportunitiesFromRawText(response)
      }
    }
    
    return opportunities
  }

  const isAiErrorText = (text: string): boolean => {
    const lower = text.toLowerCase()
    return (
      lower.startsWith('error generating') ||
      lower.includes('ai generation unavailable') ||
      lower.includes('ai generation timed out') ||
      lower.includes('unable to generate opportunities') ||
      lower.includes('an error occurred while generating')
    )
  }

  const opportunitiesFromRawText = (response: OpportunitiesResponse): ProcessedOpportunity[] => {
    const text = formatOpportunityText(response.opportunities_text)
    const wasteType = (response.waste_info?.waste_type || 'agricultural waste').replace(/_/g, ' ')
    return [
      {
        id: 'ai_summary',
        title: `Opportunities for ${wasteType}`,
        description: text.length > 200 ? text.slice(0, 200) + '...' : text,
        wasteType: response.waste_info?.waste_type || 'Agricultural Waste',
        difficulty: 'Medium',
        category: 'process_and_sell',
        icon: '💡',
      },
    ]
  }
  
  // Helper functions
  const extractTitle = (opportunity: string): string => {
    const lines = opportunity.split('\n')
    const firstLine = lines[0].trim()
    // Remove bullet points and numbering
    return firstLine.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').slice(0, 50) + (firstLine.length > 50 ? '...' : '')
  }
  
  const extractDescription = (opportunity: string): string => {
    return opportunity.length > 150 ? opportunity.slice(0, 150) + '...' : opportunity
  }
  
  const getCategoryIcon = (category: string): string => {
    const icons = {
      'on_farm_use': '🌱',
      'local_sale': '🏪', 
      'process_and_sell': '🏭'
    }
    return icons[category as keyof typeof icons] || '📦'
  }
  
  const retryLoad = () => {
    if (wasteLogId && userId) {
      window.location.reload()
    }
  }

  const filteredOpportunities = processedOpportunities.filter((opp) => {
    const matchesSearch =
      opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.wasteType.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDifficulty = !selectedDifficulty || opp.difficulty === selectedDifficulty
    const matchesCategory = !selectedCategory || opp.category === selectedCategory

    return matchesSearch && matchesDifficulty && matchesCategory
  })

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                {wasteLogId ? t("opportunities.personalizedTitle") : t("opportunities.generalTitle")}
              </h1>
              <p className="text-muted-foreground">
                {wasteLogId 
                  ? t("opportunities.personalizedSubtitle")
                  : t("opportunities.generalSubtitle")
                }
              </p>
            </div>
            {wasteLogId && (
              <Button onClick={retryLoad} variant="outline" className="shrink-0">
                <RefreshCw className="w-4 h-4 mr-2" />
                {t("opportunities.refresh")}
              </Button>
            )}
          </div>
          
          {/* Backend Status Indicators */}
          {aiOpportunities && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                {aiOpportunities.sources_used} {t("opportunities.sourcesAnalyzed")}
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                {aiOpportunities.queries_generated} {t("opportunities.queriesGenerated")}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t("opportunities.processedIn")} {aiOpportunities.processing_time_ms}ms
              </div>
            </div>
          )}
          
          {showingFallback && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                {wasteLogId && userId && attemptedPersonalized
                  ? t("opportunities.personalizedUnavailable")
                  : t("opportunities.showingGeneral")
                }
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Error Alert - Only show for actual errors, not database unavailability */}
        {error && (
          <Alert className="mb-6 border-destructive/50 text-destructive dark:border-destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {wasteLogId && userId && !error.includes('Database service') && (
                <Button onClick={retryLoad} variant="outline" size="sm" className="ml-4">
                  Try Again
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Loading State */}
        {loading && (
          <Card className="p-8 mb-6">
            <div className="flex items-center justify-center space-x-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-foreground">{t("common.loading")}</span>
            </div>
          </Card>
        )}

        {/* Quantitative Metrics Dashboard */}
        {!loading && aiOpportunities && aiOpportunities.calculations && (
          <div className="mb-10 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              {t("opportunities.quantitativeAnalysis") || "Quantitative Estimates"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Estimated Waste */}
              <Card className="p-5 border-border bg-card/60 backdrop-blur-sm relative overflow-hidden group hover:shadow-md transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estimated Waste</span>
                  <span className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 font-bold text-sm">
                    🌱
                  </span>
                </div>
                <div className="text-2xl font-bold text-foreground mb-1">
                  {aiOpportunities.calculations.estimated_waste?.toLocaleString() ?? "0"} {aiOpportunities.calculations.unit ?? "kg"}
                </div>
                <p className="text-xs text-muted-foreground">Generated from logged metrics</p>
              </Card>

              {/* Estimated Revenue */}
              <Card className="p-5 border-border bg-card/60 backdrop-blur-sm relative overflow-hidden group hover:shadow-md transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Revenue Potential</span>
                  <span className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 font-bold text-sm">
                    ₹
                  </span>
                </div>
                <div className="text-2xl font-bold text-emerald-500 mb-1">
                  ₹{aiOpportunities.calculations.estimated_revenue?.toLocaleString() ?? "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {aiOpportunities.calculations.price_resolved_from_search ? (
                    <span className="text-emerald-500 font-medium">Using live market rate</span>
                  ) : (
                    "Based on historical average"
                  )}
                </p>
              </Card>

              {/* ROI */}
              <Card className="p-5 border-border bg-card/60 backdrop-blur-sm relative overflow-hidden group hover:shadow-md transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Est. Return Multiple</span>
                  <span className="p-2 bg-blue-500/10 rounded-lg text-blue-500 font-bold text-sm">
                    📈
                  </span>
                </div>
                <div className="text-2xl font-bold text-foreground mb-1">
                  {aiOpportunities.calculations.roi !== undefined && aiOpportunities.calculations.roi > 0 
                    ? `${aiOpportunities.calculations.roi.toFixed(1)}x` 
                    : "0.0x"}
                </div>
                <p className="text-xs text-muted-foreground">Net gains vs handling costs</p>
              </Card>

              {/* Carbon Offset */}
              <Card className="p-5 border-border bg-card/60 backdrop-blur-sm relative overflow-hidden group hover:shadow-md transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Carbon Savings</span>
                  <span className="p-2 bg-cyan-500/10 rounded-lg text-cyan-500 font-bold text-sm">
                    ☁️
                  </span>
                </div>
                <div className="text-2xl font-bold text-cyan-500 mb-1">
                  {aiOpportunities.calculations.co2_saved?.toLocaleString() ?? "0"} kg
                </div>
                <p className="text-xs text-muted-foreground">CO2 emissions prevented</p>
              </Card>
            </div>
            
            {/* Secondary Estimates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Card className="p-4 border border-border/80 bg-card/40 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">Potential Biochar Yield:</span>
                <span className="font-semibold text-foreground">{aiOpportunities.calculations.biochar_yield?.toLocaleString() ?? "0"} kg</span>
              </Card>
              <Card className="p-4 border border-border/80 bg-card/40 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">Estimated Biogas Potential:</span>
                <span className="font-semibold text-foreground">{aiOpportunities.calculations.biogas_estimate?.toLocaleString() ?? "0"} m³</span>
              </Card>
            </div>
          </div>
        )}

        {/* Real-time Market Intelligence */}
        {!loading && aiOpportunities && aiOpportunities.market_information && (
          <div className="mb-10 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              {t("opportunities.marketIntelligenceTitle") || "Real-Time Market Intelligence"}
            </h2>
            <Card className="p-6 border-border bg-card/85 backdrop-blur-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Live Scraped Prices</h3>
                  {Object.keys(aiOpportunities.market_information.market_price || {}).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(aiOpportunities.market_information.market_price).map(([item, price]) => (
                        <div key={item} className="flex justify-between py-2 border-b border-border text-sm">
                          <span className="capitalize font-medium text-foreground">{item.replace(/_/g, ' ')}</span>
                          <span className="font-semibold text-emerald-500">{price}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No live prices found in search results.</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Identified Local Buyers</h3>
                  {aiOpportunities.market_information.buyers && aiOpportunities.market_information.buyers.length > 0 ? (
                    <ul className="space-y-2">
                      {aiOpportunities.market_information.buyers.map((buyer, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-foreground bg-muted/40 p-2 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                          {buyer}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No specific buyer factories detected in search results. Check recommendations below.</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        {!loading && (
          <div className="mb-8 space-y-4">
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("opportunities.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card border-border"
              />
            </div>

            <div className="space-y-3">
              {/* Difficulty Filters */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">{t("opportunities.difficulty")}</label>
                <div className="flex flex-wrap gap-2">
                  {["Easy", "Medium", "Hard"].map((difficulty) => (
                    <Button
                      key={difficulty}
                      onClick={() => setSelectedDifficulty(selectedDifficulty === difficulty ? null : difficulty)}
                      variant={selectedDifficulty === difficulty ? "default" : "outline"}
                      size="sm"
                      className={`${
                        selectedDifficulty === difficulty
                          ? "bg-primary text-primary-foreground"
                          : "border-border text-foreground hover:bg-muted bg-transparent"
                      }`}
                    >
                      {difficulty}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Category Filters (only show if we have AI-generated opportunities) */}
              {aiOpportunities && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">{t("opportunities.category")}</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "on_farm_use", label: t("opportunities.onFarmUse"), icon: "🌱" },
                      { id: "local_sale", label: t("opportunities.localSale"), icon: "🏪" },
                      { id: "process_and_sell", label: t("opportunities.processAndSell"), icon: "🏭" }
                    ].map((category) => (
                      <Button
                        key={category.id}
                        onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
                        variant={selectedCategory === category.id ? "default" : "outline"}
                        size="sm"
                        className={`${
                          selectedCategory === category.id
                            ? "bg-primary text-primary-foreground"
                            : "border-border text-foreground hover:bg-muted bg-transparent"
                        }`}
                      >
                        <span className="mr-1">{category.icon}</span>
                        {category.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Opportunities Grid */}
        {!loading && (
          <>
            {filteredOpportunities.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm text-muted-foreground">
                    {t("opportunities.showing")} {filteredOpportunities.length} {filteredOpportunities.length === 1 ? t("opportunities.opportunity") : t("opportunities.opportunities")}
                    {wasteLogId && ` ${t("opportunities.tailored")}`}
                  </p>
                  {!showingFallback && wasteLogId && (
                    <Button 
                      onClick={() => window.location.href = '/log-waste'} 
                      variant="outline" 
                      size="sm"
                    >
                      {t("opportunities.logMore")}
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredOpportunities.map((opportunity) => (
                    <OpportunityCard 
                      key={opportunity.id} 
                      id={opportunity.id}
                      title={opportunity.title}
                      description={opportunity.description}
                      wasteType={opportunity.wasteType}
                      revenue={opportunity.revenue || 'Revenue varies'}
                      difficulty={opportunity.difficulty}
                      icon={opportunity.icon}
                    />
                  ))}
                </div>
                
                {/* Additional AI Response Details */}
                {aiOpportunities && aiOpportunities.opportunities_text && (
                  <Card className="mt-8 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-foreground">{t("opportunities.detailedAnalysis")}</h3>
                      <div className="text-sm text-muted-foreground">
                        {aiOpportunities.context_length} {t("opportunities.charactersAnalyzed")}
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none text-foreground">
                      <div className="whitespace-pre-line text-sm">
                        {formatOpportunityText(aiOpportunities.opportunities_text)}
                      </div>
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">{t("opportunities.noOpportunities")}</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || selectedDifficulty || selectedCategory 
                      ? t("opportunities.noMatch")
                      : t("opportunities.noOpportunities")
                    }
                  </p>
                  {(searchTerm || selectedDifficulty || selectedCategory) && (
                    <Button 
                      onClick={() => {
                        setSearchTerm('')
                        setSelectedDifficulty(null)
                        setSelectedCategory(null)
                      }} 
                      variant="outline"
                    >
                      {t("opportunities.clearFilters")}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

// Loading component for Suspense
function OpportunitiesLoading() {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-foreground">{t("common.loading")}</span>
        </div>
      </main>
    </div>
  )
}

// Main export with Suspense wrapper
export default function OpportunitiesPage() {
  return (
    <Suspense fallback={<OpportunitiesLoading />}>
      <OpportunitiesPageContent />
    </Suspense>
  )
}
