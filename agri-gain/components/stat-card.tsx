import { Card } from "@/components/ui/card"

interface StatCardProps {
  label: string
  value: string
  change?: string
  icon: string
  color?: "primary" | "accent" | "secondary"
}

export function StatCard({ label, value, change, icon, color = "primary" }: StatCardProps) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    secondary: "bg-secondary/10 text-secondary",
  }

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {change && <p className="text-xs text-primary mt-2">{change}</p>}
        </div>
        <div className={`text-4xl p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      </div>
    </Card>
  )
}
