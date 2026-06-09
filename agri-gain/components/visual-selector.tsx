"use client"

import type React from "react"

import { Card } from "@/components/ui/card"

interface VisualOption {
  id: string
  label: string
  icon: React.ReactNode
}

interface VisualSelectorProps {
  options: VisualOption[]
  selected: string | null
  onChange: (id: string) => void
  multiple?: boolean
}

export function VisualSelector({ options, selected, onChange, multiple = false }: VisualSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {options.map((option) => (
        <Card
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`p-4 cursor-pointer transition-all hover:border-primary ${
            selected === option.id ? "border-primary bg-primary/10 border-2" : "border-border hover:border-primary/50"
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="text-3xl">{option.icon}</div>
            <span className="text-sm font-medium text-center text-foreground">{option.label}</span>
          </div>
        </Card>
      ))}
    </div>
  )
}
