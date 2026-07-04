# Dark & Light Theme System Implementation Guide

## Overview
VPC Music now features a complete Dark & Light Theme system with semantic CSS variables, smooth transitions, and full accessibility compliance.

## Architecture

### 1. Theme Tokens (CSS Variables)
Located in `/app/globals.css`, the theme system uses semantic CSS variables organized by purpose:

#### Light Mode (Root)
```css
:root {
  --background: #FAFBFC;      /* Primary background */
  --foreground: #0D1117;       /* Primary text */
  --card: #FFFFFF;            /* Card backgrounds */
  --border: #E0E6ED;          /* Borders and dividers */
  --muted: #E0E6ED;           /* Muted backgrounds */
  --muted-foreground: #57606A; /* Muted text */
  --accent: #C09060;          /* Gold worship accent */
  --success: #1A7F64;         /* Success state */
  --warning: #B08B13;         /* Warning state */
  --error: #D1242F;           /* Error state */
  --info: #0969DA;            /* Info state */
}
```

#### Dark Mode (.dark)
```css
.dark {
  --background: #000030;      /* Navy background */
  --foreground: #F0F0F0;      /* Light text */
  --card: #102040;            /* Dark card backgrounds */
  --border: #203040;          /* Dark borders */
  --muted: #203040;           /* Muted dark backgrounds */
  --muted-foreground: #A0A0A0;/* Muted text */
  --accent: #C09060;          /* Gold accent (preserved) */
  --success: #51CF66;         /* Success state */
  --warning: #FFD43B;         /* Warning state */
  --error: #FF6B6B;           /* Error state */
  --info: #74C0FC;            /* Info state */
}
```

### 2. Theme Modes
The app supports three theme modes via next-themes:
- **Light**: Always use light theme
- **Dark**: Always use dark theme
- **System**: Follow OS/device preference

### 3. Semantic Tokens
Never use hardcoded colors. Always use semantic tokens:
- `bg-background` - Main background
- `bg-card` - Card/elevated surfaces
- `bg-muted` - Secondary backgrounds
- `text-foreground` - Primary text
- `text-muted-foreground` - Secondary text
- `border-border` - Borders and dividers
- `bg-accent text-accent-foreground` - Interactive accents
- `bg-success`, `bg-warning`, `bg-error`, `bg-info` - Status states

## Components

### 1. ThemeToggle Component
Location: `/components/app-shell/theme-toggle.tsx`

Enhanced dropdown menu supporting all three theme modes with visual feedback:
```tsx
<ThemeToggle />
```

Features:
- Light/Dark/System mode selection
- Animated dropdown with smooth transitions
- Active indicator
- Keyboard accessible

### 2. AppearanceSettings Component
Location: `/components/appearance-settings.tsx`

Comprehensive appearance settings panel with:
- Theme mode selector (Light/Dark/System)
- Visual theme cards with checkmark indicators
- Color palette preview
- Accessibility notes about WCAG AA compliance

Usage in settings page:
```tsx
<AppearanceSettings />
```

### 3. Theme Tokens Library
Location: `/lib/theme-tokens.ts`

Provides utility functions:
```tsx
import { 
  THEME_MODES, 
  getSystemTheme, 
  resolveTheme, 
  isDarkTheme 
} from '@/lib/theme-tokens'

const currentTheme = resolveTheme(theme) // 'light' or 'dark'
const isDark = isDarkTheme(currentTheme)
```

## Usage Guidelines

### 1. In Tailwind Classes
Always use semantic color tokens in components:

✅ **CORRECT**
```tsx
<div className="bg-background text-foreground border border-border">
  <button className="bg-accent text-accent-foreground hover:bg-accent/90">
    Click me
  </button>
</div>
```

❌ **INCORRECT** (Never hardcode colors)
```tsx
<div className="bg-white text-black border border-gray-300">
  <button className="bg-[#C09060] text-white">
    Click me
  </button>
</div>
```

### 2. Smooth Transitions
CSS variables have automatic transitions:
```tsx
// This color change will smoothly animate
<div className="bg-background transition-colors duration-200" />
```

### 3. State-Specific Tokens
Use semantic tokens for all interactive states:
```tsx
<button className={cn(
  'bg-background text-foreground border border-border',
  'hover:bg-muted hover:text-foreground',
  'active:bg-muted/80',
  'disabled:opacity-50 disabled:cursor-not-allowed'
)} />
```

### 4. Keyboard Focus States
All interactive elements automatically get focus styling:
```css
*:focus-visible {
  @apply outline-2 outline-ring outline-offset-2;
}
```

## Integration with next-themes

The app uses `next-themes` for automatic theme management:

```tsx
import { useTheme } from 'next-themes'

export function MyComponent() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  
  return (
    <button onClick={() => setTheme('dark')}>
      Set Dark Mode
    </button>
  )
}
```

## Accessibility Features

### WCAG AA Compliance
Both light and dark themes meet WCAG AA contrast standards:
- Text color contrast: 4.5:1 for normal text
- Large text contrast: 3:1 minimum

### Keyboard Navigation
- Theme toggle accessible via keyboard
- Focus indicators visible on all interactive elements
- Dropdown menu keyboard-navigable

### Reduced Motion
The system respects `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Browser Support

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Component Audit

All components updated to use semantic tokens:
- Navigation
- Modals and dialogs
- Cards and panels
- Forms and inputs
- Tables
- Buttons and interactive elements
- Status indicators

## Performance

Theme switching is optimized with:
- CSS variable inheritance
- Native browser theme transitions
- No JavaScript-based color calculations
- System preference detection (no network calls)

## Troubleshooting

### Theme not persisting
- Check that next-themes is initialized in layout.tsx
- Verify localStorage is enabled in browser
- Check browser console for errors

### Colors look wrong
- Verify element is using semantic tokens, not hardcoded colors
- Check that parent elements are in correct DOM tree for CSS variable inheritance
- Inspect computed styles in DevTools

### Transitions feel sluggish
- Reduce duration values in globals.css if needed
- Check for conflicting CSS animations
- Verify browser performance in DevTools

## Future Enhancements

Potential additions:
- Custom color picker for accent color
- Font size/scaling preferences
- High contrast mode toggle
- Dyslexia-friendly font option
- Auto-theme based on time of day

