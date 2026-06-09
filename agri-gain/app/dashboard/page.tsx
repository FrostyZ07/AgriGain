"use client"

import { Header } from "@/components/header"
import { StatCard } from "@/components/stat-card"
import { ActivityLog } from "@/components/activity-log"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import Link from "next/link"
import { useLanguage } from "@/contexts/language-context"

const REVENUE_DATA = [
  { month: "Jan", revenue: 2000 },
  { month: "Feb", revenue: 3500 },
  { month: "Mar", revenue: 2800 },
  { month: "Apr", revenue: 4200 },
  { month: "May", revenue: 5100 },
  { month: "Jun", revenue: 6800 },
]

const WASTE_DATA = [
  { month: "Jan", waste: 150 },
  { month: "Feb", waste: 200 },
  { month: "Mar", waste: 180 },
  { month: "Apr", waste: 250 },
  { month: "May", waste: 320 },
  { month: "Jun", waste: 400 },
]

const ACTIVITIES = [
  {
    id: "1",
    type: "Waste Logged",
    description: "Logged 50 sacks of rice husks",
    timestamp: "2 hours ago",
    icon: "📝",
  },
  {
    id: "2",
    type: "Revenue Generated",
    description: "Earned ₹1,200 from briquette sales",
    timestamp: "1 day ago",
    icon: "💰",
  },
  {
    id: "3",
    type: "Opportunity Discovered",
    description: "New opportunity: Biochar production",
    timestamp: "3 days ago",
    icon: "🎯",
  },
  {
    id: "4",
    type: "Guide Completed",
    description: "Completed 'Composting Best Practices'",
    timestamp: "1 week ago",
    icon: "✅",
  },
]

export default function DashboardPage() {
  const { t } = useLanguage()
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label={t("dashboard.totalWasteLogged")}
            value="1,280 kg"
            change={t("dashboard.title").includes('आपका') ? '↑ पिछले महीने से 15%' : '↑ 15% from last month'}
            icon="📊"
            color="primary"
          />
          <StatCard 
            label={t("dashboard.revenueGenerated")} 
            value="₹23,700" 
            change={t("dashboard.title").includes('आपका') ? '↑ पिछले महीने से 32%' : '↑ 32% from last month'} 
            icon="💰" 
            color="accent" 
          />
          <StatCard 
            label={t("dashboard.co2Saved")} 
            value="2.4 tons" 
            change={t("dashboard.title").includes('आपका') ? '↑ पिछले महीने से 18%' : '↑ 18% from last month'} 
            icon="🌍" 
            color="secondary" 
          />
          <StatCard 
            label={t("dashboard.activeOpportunities")} 
            value="6" 
            change={t("dashboard.title").includes('आपका') ? 'इस महीने 2 नए' : '2 new this month'} 
            icon="🎯" 
            color="primary" 
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Chart */}
          <Card className="p-6 bg-card border-border">
            <h3 className="text-lg font-bold text-foreground mb-4">{t("dashboard.revenueTrend")}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={REVENUE_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis stroke="var(--color-muted-foreground)" />
                <YAxis stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                  }}
                />
                <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Waste Logged Chart */}
          <Card className="p-6 bg-card border-border">
            <h3 className="text-lg font-bold text-foreground mb-4">{t("dashboard.wasteLogged")}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={WASTE_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis stroke="var(--color-muted-foreground)" />
                <YAxis stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="waste" fill="var(--color-accent)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Activity and Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Log */}
          <div className="lg:col-span-2">
            <ActivityLog activities={ACTIVITIES} />
          </div>

          {/* Quick Actions */}
          <Card className="p-6 bg-card border-border">
            <h3 className="text-lg font-bold text-foreground mb-4">{t("dashboard.quickActions")}</h3>
            <div className="space-y-3">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                <Link href="/log-waste">{t("nav.logWaste")}</Link>
              </Button>
              <Button
                variant="outline"
                className="w-full border-border text-foreground hover:bg-muted bg-transparent"
                asChild
              >
                <Link href="/opportunities">{t("dashboard.viewOpportunities")}</Link>
              </Button>
              <Button
                variant="outline"
                className="w-full border-border text-foreground hover:bg-muted bg-transparent"
                asChild
              >
                <Link href="/guides">{t("dashboard.readGuides")}</Link>
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
