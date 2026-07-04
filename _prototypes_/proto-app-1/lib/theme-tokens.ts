/**
 * Semantic Theme Tokens
 * Defines color and style tokens for consistent theming across the app
 */

export const THEME_MODES = ['light', 'dark', 'system'] as const
export type ThemeMode = (typeof THEME_MODES)[number]

export interface ThemeColors {
  light: {
    background: string
    foreground: string
    card: string
    border: string
    muted: string
    accent: string
    success: string
    warning: string
    error: string
    info: string
  }
  dark: {
    background: string
    foreground: string
    card: string
    border: string
    muted: string
    accent: string
    success: string
    warning: string
    error: string
    info: string
  }
}

export const THEME_COLORS: ThemeColors = {
  light: {
    background: '#FAFBFC',
    foreground: '#0D1117',
    card: '#FFFFFF',
    border: '#E0E6ED',
    muted: '#E0E6ED',
    accent: '#C09060',
    success: '#1A7F64',
    warning: '#B08B13',
    error: '#D1242F',
    info: '#0969DA',
  },
  dark: {
    background: '#000030',
    foreground: '#F0F0F0',
    card: '#102040',
    border: '#203040',
    muted: '#203040',
    accent: '#C09060',
    success: '#51CF66',
    warning: '#FFD43B',
    error: '#FF6B6B',
    info: '#74C0FC',
  },
}

/**
 * Get the system theme preference
 */
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Resolve theme mode to actual theme
 */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return getSystemTheme()
  }
  return mode
}

/**
 * Check if current theme is dark
 */
export function isDarkTheme(theme: 'light' | 'dark'): boolean {
  return theme === 'dark'
}

/**
 * Check if current theme is light
 */
export function isLightTheme(theme: 'light' | 'dark'): boolean {
  return theme === 'light'
}

/**
 * Contrast ratio checker for accessibility (WCAG AA standard)
 * WCAG AA requires 4.5:1 for normal text, 3:1 for large text
 */
export function getContrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const getLuminance = (rgb: [number, number, number]) => {
    const [r, g, b] = rgb.map(val => {
      val = val / 255
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  const l1 = getLuminance(rgb1)
  const l2 = getLuminance(rgb2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * List of semantic token names that should not have hardcoded colors
 */
export const SEMANTIC_TOKEN_NAMES = {
  backgrounds: [
    'background',
    'card',
    'input',
    'popover',
  ],
  text: [
    'foreground',
    'muted-foreground',
    'card-foreground',
    'popover-foreground',
  ],
  interactive: [
    'primary',
    'secondary',
    'accent',
    'destructive',
  ],
  states: [
    'success',
    'warning',
    'error',
    'info',
  ],
  borders: [
    'border',
    'ring',
  ],
} as const
