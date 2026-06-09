"use client"

import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { 
  HelpCircle, 
  BookOpen, 
  MessageCircle, 
  Phone, 
  Mail, 
  FileText,
  Users,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  ExternalLink
} from "lucide-react"

const FAQ_ITEMS = [
  {
    question: "How do I log my agricultural waste effectively?",
    answer: "Start by selecting your waste type from our comprehensive list, then choose the appropriate unit (sacks, wheelbarrows, etc.) and enter the quantity. Add notes about the condition or any specific details. Our system will automatically calculate the estimated weight and provide personalized recommendations."
  },
  {
    question: "What types of agricultural waste can I monetize?",
    answer: "You can monetize various types including rice husks, sugarcane bagasse, vegetable trimmings, fruit seeds, corn stalks, wheat straw, coconut husks, cotton stalks, banana leaves, and mixed agricultural waste. Each type has specific processing and market opportunities."
  },
  {
    question: "How accurate are the revenue estimates?",
    answer: "Our revenue estimates are based on current market data and regional pricing. Actual revenue may vary depending on local demand, quality of processed products, seasonal factors, and your processing efficiency. Use these as guidelines for planning your waste monetization strategy."
  },
  {
    question: "What safety precautions should I follow?",
    answer: "Always wear protective equipment when processing waste, ensure proper ventilation in work areas, store raw materials in dry conditions, follow fire safety protocols for combustible materials, and maintain clean processing environments to prevent contamination."
  },
  {
    question: "How do I find local buyers for my products?",
    answer: "Our system provides buyer contacts based on your region and waste type. Additionally, check with local agricultural cooperatives, manufacturing units, brick kilns, poultry farms, and organic farming communities. Building relationships with regular buyers ensures steady income."
  },
  {
    question: "Can I process waste without expensive equipment?",
    answer: "Yes! Many opportunities require minimal investment. Start with simple processes like composting, direct selling, or basic briquette making using manual tools. Scale up to mechanized processing as your business grows and generates revenue."
  }
]

const QUICK_ACTIONS = [
  {
    title: "Log Your Waste",
    description: "Start tracking your agricultural waste",
    icon: "📝",
    href: "/log-waste",
    color: "bg-green-500"
  },
  {
    title: "Browse Guides",
    description: "Learn processing techniques",
    icon: "📚",
    href: "/guides",
    color: "bg-blue-500"
  },
  {
    title: "View Opportunities",
    description: "Discover monetization options",
    icon: "💡",
    href: "/opportunities",
    color: "bg-purple-500"
  },
  {
    title: "Dashboard",
    description: "Track your progress",
    icon: "📊",
    href: "/dashboard",
    color: "bg-orange-500"
  }
]

const CONTACT_OPTIONS = [
  {
    title: "Technical Support",
    description: "Get help with the platform",
    icon: HelpCircle,
    contact: "support@agri-gain.com",
    type: "email"
  },
  {
    title: "Agricultural Expert",
    description: "Consult with waste specialists",
    icon: Users,
    contact: "+1-800-AGRI-HELP",
    type: "phone"
  },
  {
    title: "Community Forum",
    description: "Connect with other farmers",
    icon: MessageCircle,
    contact: "forum.agri-gain.com",
    type: "website"
  },
  {
    title: "Emergency Hotline",
    description: "24/7 safety and emergency support",
    icon: AlertTriangle,
    contact: "+1-800-EMERGENCY",
    type: "phone"
  }
]

export default function HelpPage() {
  const { t } = useLanguage()
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <HelpCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">{t("help.title")}</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("help.subtitle")}
          </p>
        </div>

        {/* Quick Actions */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Lightbulb className="w-6 h-6" />
            {t("help.quickStart")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_ACTIONS.map((action, index) => (
              <Card key={index} className="hover:shadow-lg transition-all hover:border-primary group cursor-pointer">
                <CardContent className="p-6">
                  <div className="text-4xl mb-3">{action.icon}</div>
                  <h3 className="font-semibold text-foreground mb-2">{action.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{action.description}</p>
                  <Button asChild size="sm" className="w-full">
                    <a href={action.href}>
                      Get Started <ArrowRight className="w-4 h-4 ml-1" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            {t("help.faq")}
          </h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map((faq, index) => (
              <Card key={index} className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                    {faq.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Getting Started Guide */}
        <section className="mb-12">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-xl text-foreground flex items-center gap-2">
                <FileText className="w-6 h-6" />
                {t("help.gettingStarted")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Step 1: Log Your Waste</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Start by recording your agricultural waste. Select waste type, quantity, and add any relevant notes.
                  </p>
                  
                  <h3 className="font-semibold text-foreground mb-2">Step 2: Get Recommendations</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Our AI analyzes your waste and provides personalized monetization opportunities.
                  </p>
                  
                  <h3 className="font-semibold text-foreground mb-2">Step 3: Learn & Implement</h3>
                  <p className="text-sm text-muted-foreground">
                    Follow our detailed guides to process your waste and connect with buyers.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Best Practices</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Keep accurate records of waste quantities
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Store materials in proper conditions
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Start small and scale gradually
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Build relationships with local buyers
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Follow safety guidelines always
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Contact Support */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <MessageCircle className="w-6 h-6" />
            {t("help.contactSupport")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {CONTACT_OPTIONS.map((contact, index) => {
              const IconComponent = contact.icon
              return (
                <Card key={index} className="text-center hover:shadow-lg transition-all">
                  <CardContent className="p-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-4">
                      <IconComponent className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{contact.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{contact.description}</p>
                    <div className="text-sm font-medium text-primary">
                      {contact.type === "email" && (
                        <a href={`mailto:${contact.contact}`} className="flex items-center justify-center gap-1">
                          <Mail className="w-4 h-4" />
                          {contact.contact}
                        </a>
                      )}
                      {contact.type === "phone" && (
                        <a href={`tel:${contact.contact}`} className="flex items-center justify-center gap-1">
                          <Phone className="w-4 h-4" />
                          {contact.contact}
                        </a>
                      )}
                      {contact.type === "website" && (
                        <a href={`https://${contact.contact}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1">
                          <ExternalLink className="w-4 h-4" />
                          {contact.contact}
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        {/* Additional Resources */}
        <section>
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-xl text-foreground">{t("help.additionalResources")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-semibold text-foreground mb-3">Video Tutorials</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Watch step-by-step video guides for various waste processing techniques.
                  </p>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Watch Videos
                  </Button>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-3">Market Reports</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Access current market prices and demand trends for waste-derived products.
                  </p>
                  <Button variant="outline" size="sm">
                    <FileText className="w-4 h-4 mr-2" />
                    View Reports
                  </Button>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-3">Success Stories</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Learn from other farmers who have successfully monetized their waste.
                  </p>
                  <Button variant="outline" size="sm">
                    <Users className="w-4 h-4 mr-2" />
                    Read Stories
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}