"use client"

import { useState, useRef, useEffect } from "react"
import { useLanguage } from "@/contexts/language-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Bot, 
  Send, 
  Loader2, 
  MessageSquare, 
  Globe, 
  BookOpen, 
  TrendingUp, 
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  User,
  Database,
  Brain
} from "lucide-react"
import { api, type AIInsightRequest, type AIInsightResponse } from "@/lib/api"

const SUPPORTED_LANGUAGES = [
  { code: "english", name: "English", flag: "🇺🇸" },
  { code: "hindi", name: "हिंदी", flag: "🇮🇳" },
  { code: "kannada", name: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "tamil", name: "தமிழ்", flag: "🇮🇳" },
  { code: "telugu", name: "తెలుగు", flag: "🇮🇳" },
  { code: "bengali", name: "বাংলা", flag: "🇧🇩" },
  { code: "gujarati", name: "ગુજરાતી", flag: "🇮🇳" },
  { code: "marathi", name: "मराठी", flag: "🇮🇳" },
  { code: "punjabi", name: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { code: "malayalam", name: "മലയാളം", flag: "🇮🇳" }
]

const WASTE_TYPES = [
  { value: "", label: "General Question" },
  { value: "rice_husks", label: "Rice Husks" },
  { value: "sugarcane_bagasse", label: "Sugarcane Bagasse" },
  { value: "vegetable_trimmings", label: "Vegetable Trimmings" },
  { value: "fruit_seeds", label: "Fruit Seeds" },
  { value: "corn_stalks", label: "Corn Stalks" },
  { value: "wheat_straw", label: "Wheat Straw" },
  { value: "coconut_husks", label: "Coconut Husks" },
  { value: "cotton_stalks", label: "Cotton Stalks" },
  { value: "banana_leaves", label: "Banana Leaves" },
  { value: "mixed_waste", label: "Mixed Waste" }
]

const SAMPLE_QUESTIONS = [
  "How do I start composting vegetable waste?",
  "What equipment is needed for rice husk briquettes?",
  "How much revenue can I expect from sugarcane bagasse?",
  "What are the safety precautions for waste processing?",
  "How do I find local buyers for my processed products?",
  "What is the best waste type to start with as a beginner?"
]

interface Message {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: Date
  metadata?: {
    sources_used?: number
    confidence_score?: number
    related_guides?: string[]
    fallback_used?: boolean
    processing_time_ms?: number
  }
}

export function AIInsight() {
  const { language: uiLanguage } = useLanguage()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [selectedLanguage, setSelectedLanguage] = useState(uiLanguage === 'hi' ? "hindi" : "english")
  const [selectedWasteType, setSelectedWasteType] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Sync AI language with UI language
  useEffect(() => {
    setSelectedLanguage(uiLanguage === 'hi' ? "hindi" : "english")
  }, [uiLanguage])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Check backend health on mount
  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const health = await api.getHealth()
        setBackendStatus('online')
        console.log('Backend health check successful:', health)
      } catch (error) {
        setBackendStatus('offline')
        console.error('Backend health check failed:', error)
      }
    }

    checkBackendHealth()
  }, [])

  const sendMessage = async (question: string) => {
    if (!question.trim()) return
    
    // Check if backend is available
    if (backendStatus === 'offline') {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: 'The AI service is currently offline. Please start the backend server on port 8000 and refresh the page.',
        timestamp: new Date(),
        metadata: {
          sources_used: 0,
          confidence_score: 0,
          related_guides: [],
          fallback_used: true
        }
      }
      setMessages(prev => [...prev, errorMessage])
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: question.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)
    let request: AIInsightRequest | undefined = undefined

    try {
      request = {
        question: question.trim(),
        language: selectedLanguage,
        waste_type: selectedWasteType || undefined,
        context: `User is asking about agricultural waste management${selectedWasteType ? ` specifically for ${selectedWasteType.replace('_', ' ')}` : ''}.`
      }

      const response: AIInsightResponse = await api.getAIInsight(request)

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: response.answer,
        timestamp: new Date(),
        metadata: {
          sources_used: response.sources_used,
          confidence_score: response.confidence_score,
          related_guides: response.related_guides,
          fallback_used: response.fallback_used,
          processing_time_ms: response.processing_time_ms
        }
      }

      setMessages(prev => [...prev, aiMessage])

    } catch (error) {
      console.error('Failed to get AI insight:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        request: request
      })
      
      let errorContent = "I apologize, but I'm experiencing technical difficulties. "
      
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorContent += "Unable to connect to the AI service. Please make sure the backend server is running on port 8000."
        } else if (error.message.includes('timeout')) {
          errorContent += "The request timed out. Please try a simpler question."
        } else {
          errorContent += `Error: ${error.message}`
        }
      } else {
        errorContent += "Please try again later or contact support for assistance."
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: errorContent,
        timestamp: new Date(),
        metadata: {
          sources_used: 0,
          confidence_score: 0,
          related_guides: [],
          fallback_used: true
        }
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(inputValue)
  }

  const selectedLanguageInfo = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage)

  if (!isExpanded) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">AI Waste Expert</h3>
                <p className="text-sm text-muted-foreground">Ask questions about agricultural waste processing</p>
              </div>
            </div>
            <Button onClick={() => setIsExpanded(true)} className="shrink-0">
              <MessageSquare className="w-4 h-4 mr-2" />
              Start Chat
            </Button>
          </div>
          
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SAMPLE_QUESTIONS.slice(0, 4).map((question, index) => (
              <button
                key={index}
                onClick={() => {
                  setIsExpanded(true)
                  setTimeout(() => sendMessage(question), 300)
                }}
                className="text-left p-2 text-xs bg-background rounded border border-border hover:border-primary transition-colors"
              >
                "{question}"
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            AI Waste Expert
            <Badge variant="secondary" className="ml-2">
              {selectedLanguageInfo?.flag} {selectedLanguageInfo?.name}
            </Badge>
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsExpanded(false)}
          >
            Minimize
          </Button>
        </div>
        
        {/* Language and Waste Type Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              <Globe className="w-3 h-3 inline mr-1" />
              Language
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Waste Type (Optional)
            </label>
            <select
              value={selectedWasteType}
              onChange={(e) => setSelectedWasteType(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
            >
              {WASTE_TYPES.map((waste) => (
                <option key={waste.value} value={waste.value}>
                  {waste.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Messages Area */}
        <div className="h-96 overflow-y-auto px-4 py-2 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="w-8 h-8 mx-auto mb-2 text-primary/50" />
              <p className="text-sm">Ask me anything about agricultural waste management!</p>
              <div className="mt-3 flex flex-wrap gap-1 justify-center">
                {SAMPLE_QUESTIONS.slice(0, 3).map((question, index) => (
                  <button
                    key={index}
                    onClick={() => sendMessage(question)}
                    className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                  >
                    {question.substring(0, 30)}...
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {messages.map((message) => (
            <div key={message.id} className={`flex items-start gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`p-2 rounded-full ${message.type === 'user' ? 'bg-primary/10' : 'bg-muted'}`}>
                {message.type === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4 text-primary" />
                )}
              </div>
              
              <div className={`max-w-[85%] ${message.type === 'user' ? 'text-right' : ''}`}>
                <div className={`rounded-lg p-3 text-sm ${
                  message.type === 'user' 
                    ? 'bg-primary text-primary-foreground ml-auto' 
                    : 'bg-background border border-border'
                }`}>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
                
                {message.type === 'ai' && message.metadata && (
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                    {(message.metadata.sources_used ?? 0) > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <Database className="w-3 h-3 mr-1" />
                        {message.metadata.sources_used} sources
                      </Badge>
                    )}
                    
                    {(message.metadata.confidence_score ?? 0) > 0 && (
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          (message.metadata.confidence_score ?? 0) >= 0.8 ? 'text-green-600' :
                          (message.metadata.confidence_score ?? 0) >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                        }`}
                      >
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {Math.round((message.metadata.confidence_score ?? 0) * 100)}% confident
                      </Badge>
                    )}
                    
                    {message.metadata.fallback_used && (
                      <Badge variant="outline" className="text-xs text-orange-600">
                        <Brain className="w-3 h-3 mr-1" />
                        AI Generated
                      </Badge>
                    )}
                    
                    {message.metadata.related_guides && message.metadata.related_guides.length > 0 && (
                      <Badge variant="outline" className="text-xs text-blue-600">
                        <BookOpen className="w-3 h-3 mr-1" />
                        {message.metadata.related_guides.length} related guides
                      </Badge>
                    )}
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-muted">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-background border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing your question...
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="border-t border-border p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={backendStatus === 'offline' ? 'Backend server is offline...' : `Ask about ${selectedWasteType ? selectedWasteType.replace('_', ' ') : 'agricultural waste'}...`}
              disabled={isLoading || backendStatus !== 'online'}
              className="flex-1"
              maxLength={500}
            />
            <Button type="submit" disabled={isLoading || !inputValue.trim() || backendStatus !== 'online'}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
          
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>
              {inputValue.length}/500 characters
            </span>
            <span className="flex items-center gap-1">
              {backendStatus === 'online' ? (
                <>
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  Knowledge base + AI powered
                </>
              ) : backendStatus === 'offline' ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  Backend offline - Start server on port 8000
                </>
              ) : (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />
                  Checking backend status...
                </>
              )}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}