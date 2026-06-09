"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { GuideCard } from "@/components/guide-card"
import { Button } from "@/components/ui/button"
import { AIInsight } from "@/components/ai-insight"
import { useLanguage } from "@/contexts/language-context"

const GUIDES = [
  {
    id: "1",
    title: "Getting Started with Waste Logging",
    description: "Learn how to effectively log your agricultural waste and track it over time.",
    category: "Basics",
    readTime: 5,
    difficulty: "Beginner" as const,
    icon: "📝",
  },
  {
    id: "2",
    title: "Rice Husk Briquette Production",
    description: "Step-by-step guide to converting rice husks into profitable briquettes.",
    category: "Production",
    readTime: 12,
    difficulty: "Intermediate" as const,
    icon: "🔥",
  },
  {
    id: "3",
    title: "Composting Best Practices",
    description: "Master the art of creating high-quality compost from vegetable waste.",
    category: "Composting",
    readTime: 8,
    difficulty: "Beginner" as const,
    icon: "🌱",
  },
  {
    id: "4",
    title: "Advanced Biochar Production",
    description: "Learn advanced techniques for biochar production and soil enhancement.",
    category: "Production",
    readTime: 15,
    difficulty: "Advanced" as const,
    icon: "⚫",
  },
  {
    id: "5",
    title: "Marketing Your Waste Products",
    description: "Strategies for finding buyers and selling your waste-derived products.",
    category: "Business",
    readTime: 10,
    difficulty: "Intermediate" as const,
    icon: "📊",
  },
  {
    id: "6",
    title: "Storage and Preservation Techniques",
    description: "Keep your waste products fresh and maintain their quality for longer.",
    category: "Storage",
    readTime: 7,
    difficulty: "Beginner" as const,
    icon: "📦",
  },
  {
    id: "7",
    title: "Scaling Your Waste Business",
    description: "Expand your waste monetization operation from small to large scale.",
    category: "Business",
    readTime: 14,
    difficulty: "Advanced" as const,
    icon: "📈",
  },
  {
    id: "8",
    title: "Environmental Impact Measurement",
    description: "Understand and measure the environmental benefits of your waste management.",
    category: "Impact",
    readTime: 9,
    difficulty: "Intermediate" as const,
    icon: "🌍",
  },
]

const CATEGORIES = ["All", "Basics", "Production", "Composting", "Business", "Storage", "Impact"]

export default function GuidesPage() {
  const { t } = useLanguage()
  const [selectedCategory, setSelectedCategory] = useState("All")

  const filteredGuides =
    selectedCategory === "All" ? GUIDES : GUIDES.filter((guide) => guide.category === selectedCategory)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-2">{t("guides.title")}</h1>
          <p className="text-muted-foreground">{t("guides.subtitle")}</p>
        </div>

        {/* AI Insight Section */}
        <div className="mb-12">
          <AIInsight />
        </div>

        {/* Category Filter */}
        <div className="mb-8 flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <Button
              key={category}
              onClick={() => setSelectedCategory(category)}
              variant={selectedCategory === category ? "default" : "outline"}
              className={`${
                selectedCategory === category
                  ? "bg-primary text-primary-foreground"
                  : "border-border text-foreground hover:bg-muted bg-transparent"
              }`}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Guides Grid */}
        {filteredGuides.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGuides.map((guide) => (
              <GuideCard key={guide.id} {...guide} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">{t("guides.noGuides")}</p>
          </div>
        )}
      </main>
    </div>
  )
}
