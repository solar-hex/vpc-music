'use client'

import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { RESPONSIVE_GAPS, RESPONSIVE_GRID, generateGridColsClass } from '@/lib/responsive-utils'

interface ResponsiveGridProps {
  children: ReactNode
  variant?: 'compact' | 'comfortable' | 'full'
  gap?: 'tight' | 'default' | 'comfortable' | 'spacious'
  className?: string
}

/**
 * Responsive grid component optimized for mobile-first layouts
 * Automatically scales grid columns based on viewport size
 */
export function ResponsiveGrid({
  children,
  variant = 'compact',
  gap = 'default',
  className,
}: ResponsiveGridProps) {
  const gridConfig = RESPONSIVE_GRID[variant]
  const gridColsClass = generateGridColsClass(gridConfig)
  const gapClass = RESPONSIVE_GAPS[gap]

  return (
    <div
      className={cn(
        'grid',
        gridColsClass,
        gapClass,
        className
      )}
    >
      {children}
    </div>
  )
}

interface ResponsiveContainerProps {
  children: ReactNode
  className?: string
}

/**
 * Responsive container with safe padding and max-width
 * Optimized for mobile, tablet, and desktop
 */
export function ResponsiveContainer({
  children,
  className,
}: ResponsiveContainerProps) {
  return (
    <div
      className={cn(
        'w-full px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10',
        'max-w-full md:max-w-5xl lg:max-w-7xl',
        'mx-auto',
        className
      )}
    >
      {children}
    </div>
  )
}

interface ResponsiveColumnProps {
  children: ReactNode
  cols?: { mobile?: number; md?: number; lg?: number; xl?: number }
  className?: string
}

/**
 * Individual responsive column for grid layouts
 */
export function ResponsiveColumn({
  children,
  cols = { mobile: 1, md: 1, lg: 1 },
  className,
}: ResponsiveColumnProps) {
  const colSpan = cn(
    cols.mobile && `col-span-${cols.mobile}`,
    cols.md && `md:col-span-${cols.md}`,
    cols.lg && `lg:col-span-${cols.lg}`,
    cols.xl && `xl:col-span-${cols.xl}`
  )

  return (
    <div className={cn(colSpan, className)}>
      {children}
    </div>
  )
}

interface ResponsiveStackProps {
  children: ReactNode
  direction?: 'vertical' | 'horizontal'
  gap?: 'tight' | 'default' | 'comfortable' | 'spacious'
  className?: string
}

/**
 * Responsive stack that changes direction based on viewport
 */
export function ResponsiveStack({
  children,
  direction = 'vertical',
  gap = 'default',
  className,
}: ResponsiveStackProps) {
  const gapValue = RESPONSIVE_GAPS[gap]

  return (
    <div
      className={cn(
        'flex',
        direction === 'vertical'
          ? 'flex-col lg:flex-row'
          : 'flex-row flex-wrap',
        gapValue,
        className
      )}
    >
      {children}
    </div>
  )
}
