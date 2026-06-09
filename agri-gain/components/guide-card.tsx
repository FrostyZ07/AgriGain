import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, BookOpen } from "lucide-react"

interface GuideCardProps {
  id: string
  title: string
  description: string
  category: string
  readTime: number
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  icon: string
}

export function GuideCard({ id, title, description, category, readTime, difficulty, icon }: GuideCardProps) {
  const difficultyColor = {
    Beginner: "bg-green-500/20 text-green-700 dark:text-green-400",
    Intermediate: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
    Advanced: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  }

  return (
    <Card className="p-6 hover:shadow-lg transition-all hover:border-primary group bg-card border-border flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="text-4xl">{icon}</div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${difficultyColor[difficulty]}`}>
          {difficulty}
        </span>
      </div>

      <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 flex-grow">{description}</p>

      <div className="space-y-3 mb-6 pb-6 border-b border-border">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Category:</span>
          <span className="font-medium text-foreground">{category}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{readTime} min read</span>
          </div>
          <div className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />
            <span>Guide</span>
          </div>
        </div>
      </div>

      <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
        <a href={`/guides/${id}`}>Read Guide</a>
      </Button>
    </Card>
  )
}
