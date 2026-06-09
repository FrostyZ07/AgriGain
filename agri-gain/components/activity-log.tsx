import { Card } from "@/components/ui/card"

interface Activity {
  id: string
  type: string
  description: string
  timestamp: string
  icon: string
}

interface ActivityLogProps {
  activities: Activity[]
}

export function ActivityLog({ activities }: ActivityLogProps) {
  return (
    <Card className="p-6 bg-card border-border">
      <h3 className="text-lg font-bold text-foreground mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
            <div className="text-2xl flex-shrink-0">{activity.icon}</div>
            <div className="flex-grow">
              <p className="font-medium text-foreground">{activity.type}</p>
              <p className="text-sm text-muted-foreground">{activity.description}</p>
              <p className="text-xs text-muted-foreground mt-1">{activity.timestamp}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
