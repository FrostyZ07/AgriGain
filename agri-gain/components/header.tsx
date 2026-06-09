"use client"

import { useState } from "react"
import Link from "next/link"
import { FaBars, FaX, FaLeaf, FaGlobe } from "react-icons/fa6"
import { useLanguage } from "@/contexts/language-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { language, setLanguage, t } = useLanguage()

  const toggleMenu = () => setIsOpen(!isOpen)

  const navLinks = [
    { label: t("nav.home"), href: "/" },
    { label: t("nav.dashboard"), href: "/dashboard" },
    { label: t("nav.guides"), href: "/guides" },
    { label: t("nav.help"), href: "/help" },
  ]

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center transition-transform group-hover:scale-110">
              <FaLeaf className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground hidden sm:inline">Agri-Gain</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-foreground hover:text-primary transition-colors text-sm font-medium"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <FaGlobe className="w-4 h-4" />
                  <span className="hidden sm:inline">{language === 'hi' ? 'हिंदी' : 'English'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onSelect={() => {
                    setLanguage('en')
                  }}
                  className={language === 'en' ? 'bg-primary/10 font-medium' : ''}
                >
                  <span className="mr-2">🇺🇸</span> English
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onSelect={() => {
                    setLanguage('hi')
                  }}
                  className={language === 'hi' ? 'bg-primary/10 font-medium' : ''}
                >
                  <span className="mr-2">🇮🇳</span> हिंदी
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Toggle menu"
          >
            {isOpen ? <FaX className="w-6 h-6 text-foreground" /> : <FaBars className="w-6 h-6 text-foreground" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-3 animate-in fade-in slide-in-from-top-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-2 text-foreground hover:bg-muted rounded-lg transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {/* Mobile Language Selector */}
            <div className="px-4 py-2 space-y-2 border-t border-border mt-2 pt-2">
              <div className="text-xs text-muted-foreground mb-1">Language / भाषा</div>
              <button
                onClick={() => {
                  setLanguage('en')
                  setIsOpen(false)
                }}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  language === 'en' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                }`}
              >
                🇺🇸 English
              </button>
              <button
                onClick={() => {
                  setLanguage('hi')
                  setIsOpen(false)
                }}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  language === 'hi' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                }`}
              >
                🇮🇳 हिंदी
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
