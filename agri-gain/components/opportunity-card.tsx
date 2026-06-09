import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

interface OpportunityCardProps {
  id: string
  title: string
  description: string
  wasteType: string
  revenue: string
  difficulty: "Easy" | "Medium" | "Hard"
  icon: string
}

export function OpportunityCard({
  id,
  title,
  description,
  wasteType,
  revenue,
  difficulty,
  icon,
}: OpportunityCardProps) {
  const difficultyColor = {
    Easy: "bg-green-500/20 text-green-700 dark:text-green-400",
    Medium: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
    Hard: "bg-red-500/20 text-red-700 dark:text-red-400",
  }

  return (
    <Card className="p-6 hover:shadow-lg transition-all hover:border-primary group bg-card border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="text-4xl">{icon}</div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${difficultyColor[difficulty]}`}>
          {difficulty}
        </span>
      </div>

      <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>

      <div className="space-y-3 mb-6 pb-6 border-b border-border">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Waste Type:</span>
          <span className="text-sm font-medium text-foreground">{wasteType}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Potential Revenue:</span>
          <span className="text-sm font-bold text-primary">{revenue}</span>
        </div>
      </div>

      <Button
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground group-hover:gap-2 transition-all"
        asChild
      >
        <a href={`/opportunities/${id}`}>
          Learn More <ArrowRight className="w-4 h-4" />
        </a>
      </Button>
    </Card>
  )
}
