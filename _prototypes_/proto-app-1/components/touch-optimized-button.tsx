'use client'

import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { TOUCH_TARGET_SIZES } from '@/lib/responsive-utils'

interface TouchOptimizedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon'
  size?: 'compact' | 'default' | 'large' | 'xl'
  isLoading?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
}

/**
 * Touch-optimized button component with appropriate sizing for mobile and tablet
 * Ensures minimum 44-48px touch target size for accessibility
 */
export const TouchOptimizedButton = forwardRef<
  HTMLButtonElement,
  TouchOptimizedButtonProps
>(
  (
    {
      variant = 'primary',
      size = 'default',
      isLoading = false,
      icon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeMap = {
      compact: 'px-2.5 py-1.5 text-sm min-h-[36px]',
      default: 'px-3.5 py-2.5 text-base min-h-[44px]',
      large: 'px-4 py-3 text-base min-h-[48px]',
      xl: 'px-5 py-4 text-lg min-h-[56px]',
    }

    const variantMap = {
      primary:
        'bg-accent text-accent-foreground hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed',
      secondary:
        'bg-secondary text-secondary-foreground hover:bg-secondary/90 active:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed',
      ghost:
        'text-foreground hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed',
      icon: 'p-2 text-foreground hover:bg-muted rounded-lg disabled:opacity-50 disabled:cursor-not-allowed',
    }

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
          'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'active:scale-95 disabled:scale-100',
          'select-none touch-manipulation',
          sizeMap[size],
          variantMap[variant],
          isLoading && 'opacity-75 cursor-wait',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {children && <span className="sr-only">{children}</span>}
          </>
        ) : (
          <>
            {icon && <span className="flex-shrink-0">{icon}</span>}
            {children}
          </>
        )}
      </button>
    )
  }
)

TouchOptimizedButton.displayName = 'TouchOptimizedButton'

interface TouchOptimizedIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  label: string
  isLoading?: boolean
}

/**
 * Icon-only button with tooltip and accessible labeling
 * Optimized for touch with minimum 44x44px size
 */
export const TouchOptimizedIconButton = forwardRef<
  HTMLButtonElement,
  TouchOptimizedIconButtonProps
>(({ icon, label, isLoading = false, className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-lg p-2',
      'min-h-[44px] min-w-[44px]',
      'text-muted-foreground hover:text-foreground hover:bg-muted',
      'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
      'select-none touch-manipulation',
      isLoading && 'opacity-75 cursor-wait',
      className
    )}
    aria-label={label}
    title={label}
    disabled={isLoading}
    {...props}
  >
    {isLoading ? (
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    ) : (
      icon
    )}
  </button>
))

TouchOptimizedIconButton.displayName = 'TouchOptimizedIconButton'

interface TouchOptimizedButtonGroupProps {
  children: React.ReactNode
  className?: string
}

/**
 * Group of touch-optimized buttons with proper spacing
 * Ensures adequate gap between touch targets
 */
export function TouchOptimizedButtonGroup({
  children,
  className,
}: TouchOptimizedButtonGroupProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 md:gap-3', className)}>
      {children}
    </div>
  )
}
