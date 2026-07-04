'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Moon, Sun, Monitor, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ThemeOption {
  value: string
  label: string
  description: string
  icon: React.ReactNode
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'Clean and bright interface',
    icon: <Sun className="h-5 w-5" />,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Easy on the eyes',
    icon: <Moon className="h-5 w-5" />,
  },
  {
    value: 'system',
    label: 'System',
    description: 'Follow system preferences',
    icon: <Monitor className="h-5 w-5" />,
  },
]

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="h-48 bg-muted rounded-lg animate-pulse" />
      </div>
    )
  }

  const currentTheme = theme || 'system'

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">Theme</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose how the app looks to you. Select a single theme, or sync with your system and automatically switch between light and dark themes.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((option) => (
            <motion.button
              key={option.value}
              onClick={() => setTheme(option.value)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'relative flex flex-col items-start gap-3 rounded-lg border-2 p-4 text-left transition-all',
                currentTheme === option.value
                  ? 'border-accent bg-accent/5'
                  : 'border-border bg-card hover:border-border/80'
              )}
            >
              {/* Checkmark */}
              {currentTheme === option.value && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 h-5 w-5 rounded-full bg-accent flex items-center justify-center"
                >
                  <Check className="h-3 w-3 text-accent-foreground" />
                </motion.div>
              )}

              {/* Icon */}
              <div className={cn(
                'rounded-md p-2',
                currentTheme === option.value
                  ? 'bg-accent/20 text-accent'
                  : 'bg-muted text-muted-foreground'
              )}>
                {option.icon}
              </div>

              {/* Content */}
              <div>
                <p className="font-semibold text-foreground">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Preview Section */}
      <div className="mt-8 pt-6 border-t border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Preview</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Background Sample */}
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3">BACKGROUND</p>
            <div className="space-y-2">
              <div className="h-12 rounded bg-background" />
              <div className="h-12 rounded bg-card border border-border" />
              <div className="h-12 rounded bg-secondary" />
            </div>
          </div>

          {/* Text Sample */}
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3">TEXT & ACCENTS</p>
            <div className="space-y-2">
              <p className="text-foreground font-semibold">Primary text</p>
              <p className="text-muted-foreground">Secondary text</p>
              <button className="px-3 py-1 rounded bg-accent text-accent-foreground text-sm font-medium">
                Accent button
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Accessibility Info */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Accessibility Note:</span> Both light and dark themes meet WCAG AA contrast standards for enhanced readability and accessibility compliance.
        </p>
      </div>
    </div>
  )
}
