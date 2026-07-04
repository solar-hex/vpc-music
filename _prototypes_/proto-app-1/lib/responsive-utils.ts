/**
 * Responsive Layout Utilities
 * Provides helpers for responsive design patterns and breakpoint management
 */

export const BREAKPOINTS = {
  mobile: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
  musicStand: 1920,
} as const

export type Breakpoint = keyof typeof BREAKPOINTS

export const BREAKPOINT_LABELS = {
  mobile: 'Mobile (320px - 640px)',
  sm: 'Mobile Large (640px - 768px)',
  md: 'Tablet Portrait (768px - 1024px)',
  lg: 'Tablet Landscape (1024px - 1280px)',
  xl: 'Desktop (1280px - 1536px)',
  '2xl': 'Desktop Large (1536px+)',
  musicStand: 'Music Stand (1920px+)',
} as const

/**
 * Get breakpoint query for media detection
 */
export function getBreakpointQuery(breakpoint: Breakpoint): string {
  return `(min-width: ${BREAKPOINTS[breakpoint]}px)`
}

/**
 * Get all breakpoints greater than or equal to the specified one
 */
export function getBreakpointsFrom(
  breakpoint: Breakpoint
): Array<{ name: Breakpoint; px: number }> {
  const breakpoints = Object.entries(BREAKPOINTS) as Array<[Breakpoint, number]>
  return breakpoints
    .filter(([_, px]) => px >= BREAKPOINTS[breakpoint])
    .map(([name, px]) => ({ name, px }))
}

/**
 * Responsive spacing scale (mobile-first)
 * Values increase with screen size
 */
export const RESPONSIVE_SPACING = {
  xs: { mobile: '0.25rem', md: '0.375rem', lg: '0.5rem' },
  sm: { mobile: '0.5rem', md: '0.625rem', lg: '0.75rem' },
  md: { mobile: '1rem', md: '1.125rem', lg: '1.25rem' },
  lg: { mobile: '1.5rem', md: '1.625rem', lg: '1.875rem' },
  xl: { mobile: '2rem', md: '2.25rem', lg: '2.5rem' },
} as const

/**
 * Responsive typography scale
 */
export const RESPONSIVE_TYPOGRAPHY = {
  xs: { mobile: '0.75rem', md: '0.8125rem', lg: '0.875rem' },
  sm: { mobile: '0.875rem', md: '0.9375rem', lg: '1rem' },
  base: { mobile: '1rem', md: '1.0625rem', lg: '1.125rem' },
  lg: { mobile: '1.125rem', md: '1.25rem', lg: '1.375rem' },
  xl: { mobile: '1.25rem', md: '1.375rem', lg: '1.5rem' },
  '2xl': { mobile: '1.5rem', md: '1.75rem', lg: '2rem' },
  '3xl': { mobile: '1.875rem', md: '2.125rem', lg: '2.375rem' },
} as const

/**
 * Responsive grid configurations
 */
export const RESPONSIVE_GRID = {
  compact: {
    mobile: 2,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 5,
    '2xl': 6,
  },
  comfortable: {
    mobile: 1,
    sm: 2,
    md: 2,
    lg: 3,
    xl: 4,
    '2xl': 5,
  },
  full: {
    mobile: 1,
    sm: 1,
    md: 2,
    lg: 2,
    xl: 3,
    '2xl': 4,
  },
} as const

/**
 * Generate Tailwind grid column classes based on responsive config
 */
export function generateGridColsClass(
  config: Record<Breakpoint, number>
): string {
  const parts = []
  let prevCols = 0

  // Build classes only when columns change
  for (const [breakpoint, cols] of Object.entries(config)) {
    if (breakpoint === 'mobile' || breakpoint === 'sm') {
      if (cols !== prevCols) {
        parts.push(`grid-cols-${cols}`)
        prevCols = cols
      }
    } else {
      if (cols !== prevCols) {
        parts.push(`${breakpoint}:grid-cols-${cols}`)
        prevCols = cols
      }
    }
  }

  return parts.join(' ')
}

/**
 * Mobile-first container size helpers
 */
export const CONTAINER_SIZES = {
  mobile: { padding: '1rem', maxWidth: '100%' },
  sm: { padding: '1rem', maxWidth: '100%' },
  md: { padding: '1.5rem', maxWidth: '100%' },
  lg: { padding: '2rem', maxWidth: '1024px' },
  xl: { padding: '2.5rem', maxWidth: '1280px' },
  '2xl': { padding: '3rem', maxWidth: '1536px' },
} as const

/**
 * Touch target size standards (in pixels)
 * iOS: 44px, Android: 48px, Web: 44-48px
 */
export const TOUCH_TARGET_SIZES = {
  compact: 36, // Small icons only
  default: 44, // Standard touch targets
  large: 48, // Large touch targets
  xl: 56, // Extra large for accessibility
} as const

/**
 * Responsive gap utilities for common patterns
 */
export const RESPONSIVE_GAPS = {
  tight: 'gap-1 md:gap-1.5 lg:gap-2',
  default: 'gap-2 md:gap-3 lg:gap-4',
  comfortable: 'gap-3 md:gap-4 lg:gap-6',
  spacious: 'gap-4 md:gap-6 lg:gap-8',
} as const
