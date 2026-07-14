/**
 * API Service Layer for Agricultural Waste Backend Integration
 * 
 * This module provides a comprehensive API client for the FastAPI backend,
 * with proper TypeScript types, error handling, and request/response transformation.
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface WasteLogRequest {
  userId: string
  waste_type: string
  unit_name: string
  quantity: number
  notes?: string
}

export interface WasteLogResponse {
  success: boolean
  waste_log_id: string
  estimated_kg: number
  message: string
}

export interface OpportunitiesRequest {
  userId: string
  waste_log_id: string
}

export interface StructuredOpportunities {
  on_farm_use: string[]
  local_sale: string[]
  process_and_sell: string[]
}

export interface CalculationMetrics {
  estimated_waste: number
  unit: string
  estimated_revenue: number
  transportation_cost: number
  storage_cost: number
  roi: number
  biochar_yield: number
  biogas_estimate: number
  co2_saved: number
  price_resolved_from_search?: boolean
  resolved_price_per_kg?: number
}

export interface MarketIntel {
  market_price: Record<string, string>
  buyers: string[]
}

export interface OpportunitiesResponse {
  opportunities_text: string
  structured_opportunities?: StructuredOpportunities
  sources_used: number
  processing_time_ms: number
  context_length: number
  queries_generated: number
  waste_info: Record<string, any>
  user_region?: string
  error?: string
  
  // Agentic AI fields
  status?: string
  calculations?: CalculationMetrics
  market_information?: MarketIntel
  citations?: string[]
  confidence_score?: number
}

export interface HowToGuide {
  guide_id: string
  waste_type: string
  title: string
  description: string
  steps: string[]
  materials_needed: string[]
  difficulty: 'Easy' | 'Medium' | 'Hard'
  region: string
}

export interface QuantificationInfo {
  available_waste_types: string[]
  available_units: string[]
  total_models: number
  conversion_factors: Record<string, number>
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  services: Record<string, string>
  timestamp: string
}

export interface AIInsightRequest {
  question: string
  waste_type?: string
  language: string
  context?: string
}

export interface AIInsightResponse {
  question: string
  answer: string
  sources_used: number
  language: string
  processing_time_ms: number
  confidence_score: number
  related_guides: string[]
  fallback_used: boolean
  error?: string
}

export interface ApiError {
  detail: string
  status_code?: number
}

// ============================================================================
// Configuration
// ============================================================================

const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 60000, // Increased to 60s for opportunities endpoint
  retries: 3,
  retryDelay: 1000,
}

// ============================================================================
// Utility Functions
// ============================================================================

class ApiClient {
  private baseUrl: string
  private timeout: number

  constructor(config = API_CONFIG) {
    this.baseUrl = config.baseUrl
    this.timeout = config.timeout
  }

  /**
   * Enhanced fetch with timeout, retries, and error handling
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retries = API_CONFIG.retries
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    const requestOptions: RequestInit = {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }

    try {
      const response = await fetch(url, requestOptions)
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (retries > 0 && !controller.signal.aborted) {
        console.warn(`Request failed, retrying in ${API_CONFIG.retryDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, API_CONFIG.retryDelay))
        return this.fetchWithRetry(url, options, retries - 1)
      }
      
      throw error
    }
  }

  /**
   * Generic API request method with comprehensive error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    try {
      const response = await this.fetchWithRetry(url, options)
      
      // Handle different response types
      const contentType = response.headers.get('content-type')
      let data: any
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }
      
      if (!response.ok) {
        const error: ApiError = {
          detail: data.detail || `HTTP ${response.status}: ${response.statusText}`,
          status_code: response.status
        }
        throw error
      }
      
      return data as T
    } catch (err) {
      const error = err as any
      // Handle different types of errors
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw {
          detail: 'Unable to connect to the server. Please check your connection.',
          status_code: 0
        } as ApiError
      }
      
      if (error.name === 'AbortError') {
        throw {
          detail: 'Request timed out. Please try again.',
          status_code: 408
        } as ApiError
      }
      
      // Re-throw ApiError as-is
      if (error.detail) {
        throw error as ApiError
      }
      
      // Wrap unknown errors
      throw {
        detail: `Unexpected error: ${error.message}`,
        status_code: 500
      } as ApiError
    }
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Health check endpoint
   */
  async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health')
  }

  /**
   * Log agricultural waste
   */
  async logWaste(wasteData: WasteLogRequest): Promise<WasteLogResponse> {
    return this.request<WasteLogResponse>('/log_waste', {
      method: 'POST',
      body: JSON.stringify(wasteData)
    })
  }

  /**
   * Get AI-powered opportunities for logged waste
   */
  async getOpportunities(request: OpportunitiesRequest): Promise<OpportunitiesResponse> {
    // Use longer timeout for opportunities endpoint (90 seconds)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000)
    
    try {
      const response = await fetch(`${this.baseUrl}/api/v2/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }))
        throw { detail: data.detail || `HTTP ${response.status}: ${response.statusText}`, status_code: response.status } as ApiError
      }
      
      return await response.json() as OpportunitiesResponse
    } catch (err) {
      const error = err as any
      clearTimeout(timeoutId)
      
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw {
          detail: 'Unable to connect to the server. Please check your connection.',
          status_code: 0
        } as ApiError
      }
      
      if (error.name === 'AbortError') {
        throw {
          detail: 'Request timed out. The AI is taking longer than expected. Please try again.',
          status_code: 408
        } as ApiError
      }
      
      if ((error as ApiError).detail) {
        throw error as ApiError
      }
      
      throw {
        detail: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        status_code: 500
      } as ApiError
    }
  }

  /**
   * Get how-to guide by ID
   */
  async getGuide(guideId: string): Promise<HowToGuide> {
    return this.request<HowToGuide>(`/get_how_to_guide/${guideId}`)
  }

  /**
   * Get all available guides
   */
  async getGuides(): Promise<{ total_guides: number; guides: Partial<HowToGuide>[] }> {
    return this.request<{ total_guides: number; guides: Partial<HowToGuide>[] }>('/guides')
  }

  /**
   * Get quantification information (waste types, units, conversion factors)
   */
  async getQuantificationInfo(): Promise<QuantificationInfo> {
    return this.request<QuantificationInfo>('/quantification/info')
  }

  /**
   * Get AI-powered insights about agricultural waste
   */
  async getAIInsight(request: AIInsightRequest): Promise<AIInsightResponse> {
    return this.request<AIInsightResponse>('/ai_insight', {
      method: 'POST',
      body: JSON.stringify(request)
    })
  }

  /**
   * Test opportunities endpoint (for development)
   */
  async testOpportunities(wasteType: string, totalKg: number, region: string): Promise<OpportunitiesResponse> {
    return this.request<OpportunitiesResponse>('/test_opportunities', {
      method: 'POST',
      body: JSON.stringify({
        waste_type: wasteType,
        total_kg: totalKg,
        region: region
      })
    })
  }
}

// ============================================================================
// API Client Instance & Helper Functions
// ============================================================================

/**
 * Main API client instance
 */
export const api = new ApiClient()

/**
 * Frontend-friendly waste type mapping
 */
export const WASTE_TYPE_MAPPING: Record<string, string> = {
  'rice': 'rice_husks',
  'sugarcane': 'sugarcane_bagasse',
  'vegetable': 'vegetable_trimmings',
  'fruit': 'fruit_seeds',
  'corn': 'corn_stalks',
  'wheat': 'wheat_straw',
  'coconut': 'coconut_husks',
  'cotton': 'cotton_stalks',
  'banana': 'banana_leaves',
  'other': 'mixed_waste'
}

/**
 * Frontend-friendly unit mapping
 */
export const UNIT_MAPPING: Record<string, string> = {
  'sacks': 'sacks',
  'wheelbarrows': 'wheelbarrows', 
  'crates': 'crates',
  'baskets': 'baskets',
  'bags': 'bags',
  'trucks': 'trucks'
}

/**
 * Map frontend waste type to backend format
 */
export function mapWasteType(frontendType: string): string {
  return WASTE_TYPE_MAPPING[frontendType] || frontendType
}

/**
 * Map frontend unit to backend format
 */
export function mapUnit(frontendUnit: string): string {
  return UNIT_MAPPING[frontendUnit] || frontendUnit
}

/**
 * Format opportunity text for better readability
 */
export function formatOpportunityText(text: string): string {
  // Add line breaks before numbered sections
  return text
    .replace(/(\d+\.\s)/g, '\n$1')
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold
    .replace(/#{1,3}\s/g, '') // Remove markdown headers
    .trim()
}

/**
 * Parse structured opportunities from text
 */
export function parseStructuredOpportunities(text: string): StructuredOpportunities {
  const result: StructuredOpportunities = {
    on_farm_use: [],
    local_sale: [],
    process_and_sell: []
  }

  // Simple parsing logic - can be enhanced based on AI response format
  const sections = text.split(/(?=(?:On-Farm|Local Sale|Process.*Sell))/i)
  
  sections.forEach(section => {
    const lowerSection = section.toLowerCase()
    
    if (lowerSection.includes('on-farm') || lowerSection.includes('direct use')) {
      const opportunities = extractOpportunities(section)
      result.on_farm_use.push(...opportunities)
    } else if (lowerSection.includes('local sale') || lowerSection.includes('sell locally')) {
      const opportunities = extractOpportunities(section)
      result.local_sale.push(...opportunities)
    } else if (lowerSection.includes('process') && lowerSection.includes('sell')) {
      const opportunities = extractOpportunities(section)
      result.process_and_sell.push(...opportunities)
    }
  })

  return result
}

/**
 * Extract opportunity items from a text section
 */
function extractOpportunities(section: string): string[] {
  const lines = section.split('\n').filter(line => line.trim())
  const opportunities: string[] = []
  
  lines.forEach(line => {
    const trimmed = line.trim()
    // Look for bulleted items or numbered items
    if (trimmed.match(/^[-*•]\s/) || trimmed.match(/^\d+\.\s/)) {
      opportunities.push(trimmed.replace(/^[-*•]\s/, '').replace(/^\d+\.\s/, ''))
    }
  })
  
  return opportunities
}

/**
 * Error handling utility
 */
export function handleApiError(error: ApiError): string {
  switch (error.status_code) {
    case 0:
      return 'Unable to connect to server. Please check your internet connection.'
    case 400:
      return `Invalid request: ${error.detail}`
    case 404:
      return 'The requested resource was not found.'
    case 422:
      return 'Please check your input and try again.'
    case 503:
      return 'Service temporarily unavailable. Please try again later.'
    default:
      return error.detail || 'An unexpected error occurred.'
  }
}

/**
 * Check if API is available
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const health = await api.getHealth()
    return health.status === 'healthy'
  } catch {
    return false
  }
}