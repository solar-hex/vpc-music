# Dark & Light Theme System Implementation Plan

## Current State
- ThemeProvider from next-themes already integrated in layout.tsx
- CSS variables defined in globals.css for dark mode only
- ThemeToggle component exists (simple binary toggle)
- Settings page exists but no appearance/theme settings panel yet

## Implementation Strategy

### Phase 1: Theme Token Architecture
1. Expand globals.css with light mode CSS variables
2. Define semantic tokens for:
   - Backgrounds (surface, card, elevated, modal)
   - Text colors (primary, secondary, tertiary, muted)
   - Borders and dividers
   - Interactive states (hover, active, focus, disabled)
   - Semantic colors (success, warning, error, info)
   - Status indicators

### Phase 2: Theme Toggle Enhancement
1. Upgrade ThemeToggle to support Light/Dark/System modes
2. Add improved UI with better visual feedback
3. Persist preference in localStorage via next-themes

### Phase 3: Appearance Settings Page
1. Create comprehensive appearance section in settings
2. Theme mode selector (Light/Dark/System)
3. Accent color selector (preserve gold branding)
4. Font size controls
5. Contrast level selector
6. Preview of changes

### Phase 4: Component Updates
1. Audit all components for hardcoded colors
2. Replace with CSS variable equivalents
3. Ensure smooth transitions between themes
4. Add focus states for keyboard navigation

### Phase 5: Accessibility & Testing
1. Verify WCAG AA contrast ratios for all text
2. Test keyboard navigation
3. Test with screen readers
4. Cross-browser testing

## Files to Create/Update
- Update: app/globals.css (add light mode variables)
- Create: lib/theme-tokens.ts (semantic token definitions)
- Update: components/app-shell/theme-toggle.tsx (enhance to 3-mode)
- Create: app/settings/appearance.tsx (settings section)
- Update: app/settings/page.tsx (integrate appearance section)
- Audit & Update: All component files for hardcoded colors

## Key Design Tokens

### Light Mode
- Background: #F8F9FA (light gray)
- Surface: #FFFFFF (white)
- Card: #F0F4F8 (subtle gray)
- Text Primary: #1A202C (dark gray)
- Text Secondary: #4A5568 (medium gray)
- Border: #E2E8F0 (light gray)
- Accent: #C09060 (maintain gold)

### Dark Mode (Current)
- Background: #000030 (navy)
- Surface: #102040 (dark blue)
- Card: #102040 (dark blue)
- Text Primary: #F0F0F0 (light)
- Text Secondary: #A0A0A0 (medium gray)
- Border: #203040 (dark gray)
- Accent: #C09060 (gold)

## Transition & Animation
- Use CSS transitions for smooth theme switching
- 200-300ms duration for color changes
- Preserve user's choice across sessions
