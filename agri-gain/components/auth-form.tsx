"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import Link from "next/link"

interface AuthFormProps {
  type: "login" | "signup"
  onSubmit: (data: Record<string, string>) => void
}

export function AuthForm({ type, onSubmit }: AuthFormProps) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    farmName: "",
    location: "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email"
    }

    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters"
    }

    if (type === "signup") {
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password"
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match"
      }

      if (!formData.farmName) {
        newErrors.farmName = "Farm name is required"
      }

      if (!formData.location) {
        newErrors.location = "Location is required"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSubmit(formData)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  return (
    <Card className="p-8 bg-card border-border w-full max-w-md">
      <h2 className="text-2xl font-bold text-foreground mb-6">
        {type === "login" ? "Welcome Back" : "Create Your Account"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
          <Input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="your@email.com"
            className="bg-background border-border"
          />
          {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
        </div>

        {/* Farm Name (Signup only) */}
        {type === "signup" && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Farm Name</label>
            <Input
              type="text"
              name="farmName"
              value={formData.farmName}
              onChange={handleChange}
              placeholder="Your farm name"
              className="bg-background border-border"
            />
            {errors.farmName && <p className="text-xs text-destructive mt-1">{errors.farmName}</p>}
          </div>
        )}

        {/* Location (Signup only) */}
        {type === "signup" && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Location</label>
            <Input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="City, State"
              className="bg-background border-border"
            />
            {errors.location && <p className="text-xs text-destructive mt-1">{errors.location}</p>}
          </div>
        )}

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Password</label>
          <Input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            className="bg-background border-border"
          />
          {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
        </div>

        {/* Confirm Password (Signup only) */}
        {type === "signup" && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Confirm Password</label>
            <Input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              className="bg-background border-border"
            />
            {errors.confirmPassword && <p className="text-xs text-destructive mt-1">{errors.confirmPassword}</p>}
          </div>
        )}

        {/* Submit Button */}
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-6">
          {type === "login" ? "Sign In" : "Create Account"}
        </Button>
      </form>

      {/* Link to other auth page */}
      <p className="text-center text-sm text-muted-foreground mt-6">
        {type === "login" ? "Don't have an account? " : "Already have an account? "}
        <Link href={type === "login" ? "/signup" : "/login"} className="text-primary hover:underline font-medium">
          {type === "login" ? "Sign up" : "Sign in"}
        </Link>
      </p>
    </Card>
  )
}
