# Responsive Mobile-First Layout System Plan

## Current State Assessment
- App shell has basic responsive structure (desktop sidebar + mobile drawer)
- Song grid uses: 2 cols (mobile), 3 cols (sm), 4 cols (md), 5-6 cols (lg/xl)
- Some pages lack comprehensive mobile optimization
- Inconsistent touch-friendly spacing across components
- No dedicated music stand/tablet landscape optimizations

## Breakpoint Strategy (Mobile-First)
```
- Mobile (default): 320px - 640px
- Mobile-Large (sm): 640px - 768px  
- Tablet-Portrait (md): 768px - 1024px
- Tablet-Landscape (lg): 1024px - 1280px
- Desktop (xl): 1280px - 1536px
- Desktop-Large (2xl): 1536px+
- Music Stand: 1920px+ or 4:3 aspect ratio
```

## Key Responsive Strategies

### 1. Adaptive Sidebar
- Hide on mobile (< md), show inline on tablet+ 
- Add slide-out drawer on mobile with backdrop
- Adjust content padding/margin when sidebar visible

### 2. Touch Optimization
- Minimum touch target size: 44x44px (iOS) / 48x48px (Android)
- Adequate spacing between interactive elements (8px minimum)
- Swipe gestures for navigation/filters on mobile
- Large, easy-to-tap buttons for portrait orientation

### 3. Key Pages to Optimize
1. **Song Library**: Responsive grid with mobile-friendly cards
2. **Set Lists**: Stack on mobile, horizontal on tablet+
3. **Lyrics Viewer**: Full screen on mobile, side-by-side on tablet+
4. **Dashboard**: Single column on mobile, multi-column on tablet+
5. **Settings**: Stack sections on mobile, sidebar layout on tablet+

### 4. Orientation Support
- Detect and optimize for portrait vs landscape
- Prevent horizontal scrolling at all breakpoints
- Scale typography and spacing with viewport

### 5. Music Stand / Large Display
- Optimize for 16:9 and 4:3 aspect ratios
- Large text for 10+ feet viewing distance
- Chord highlighting and key color persistence
- Minimal chrome/UI for maximum content area

## Files to Create/Update
1. Create: `lib/responsive-utils.ts` (breakpoint helpers)
2. Create: `lib/touch-utils.ts` (touch event handlers)
3. Update: `components/app-shell/app-shell.tsx` (responsive layout)
4. Update: `app/globals.css` (responsive utilities)
5. Update: Key pages (songs, setlists, lyrics, dashboard, settings)
6. Create: `components/responsive-grid.tsx` (generic responsive container)
7. Create: `components/touch-optimized-button.tsx` (mobile-safe buttons)

## Expected Outcomes
✓ Mobile-first responsive design across all pages
✓ Touch-friendly interactions on all devices
✓ Optimized tablet and music stand experiences
✓ No horizontal scrolling or layout overflow
✓ Consistent spacing and typography scaling
✓ Accessible focus states on all breakpoints
