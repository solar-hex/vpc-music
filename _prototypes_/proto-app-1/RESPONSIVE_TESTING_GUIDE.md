# Responsive Layout Testing Guide

## Quick Start

### DevTools Testing
1. Open Chrome DevTools (F12)
2. Click "Toggle Device Toolbar" (Ctrl+Shift+M)
3. Test each device preset:
   - iPhone SE (375px)
   - iPhone 12 Pro (390px)
   - Pixel 5 (393px)
   - iPad (768px)
   - iPad Pro (1024px)

### Real Device Testing
Test on actual devices for accurate touch and orientation behavior:
- iPhone (various sizes)
- Android phone
- iPad or Android tablet
- Laptop/Desktop

## Test Cases

### Mobile (320px - 640px)

**Song Library**
- [ ] Grid displays 2 columns
- [ ] Compact song cards are readable
- [ ] Search bar spans full width (minus padding)
- [ ] Genre buttons stack horizontally with wrapping
- [ ] View controls stack vertically
- [ ] No horizontal scrolling

**Lyrics Viewer**
- [ ] Fills entire viewport width
- [ ] Chords display above lyrics
- [ ] Font size is readable (not too small)
- [ ] Navigation buttons (prev/next) are touch-friendly (44x44px)
- [ ] Fullscreen mode hides UI chrome

**Settings Page**
- [ ] Form inputs are full width
- [ ] Toggle buttons are easy to tap
- [ ] Sections stack vertically
- [ ] Scrolling is smooth

### Tablet Portrait (768px - 1024px)

**Song Library**
- [ ] Grid displays 3-4 columns
- [ ] Controls display horizontally
- [ ] Sidebar visible (if applicable)
- [ ] Content doesn't overflow

**Lyrics Viewer**
- [ ] Split view with chords on left, lyrics on right
- [ ] Both columns visible without scrolling
- [ ] Touch gestures work smoothly

**Dashboard**
- [ ] 2-column layout for cards
- [ ] Stats display across columns
- [ ] Navigation accessible

### Tablet Landscape (1024px - 1280px)

**Song Library**
- [ ] Grid displays 4-5 columns
- [ ] All controls visible in header
- [ ] Density toggle accessible
- [ ] No truncation of content

**Lyrics Viewer**
- [ ] Maximum readability
- [ ] All controls visible
- [ ] Suitable for music stand viewing

### Desktop (1280px+)

**All Pages**
- [ ] Full layout visible
- [ ] Sidebar always accessible
- [ ] Controls grouped logically
- [ ] Content centered with max-width

**Music Stand (1920px+)**
- [ ] Lyrics extremely readable from 10+ feet
- [ ] Chord colors prominent
- [ ] Minimal UI chrome
- [ ] Page-turn controls obvious

## Touch Testing

### Tap Interactions
- [ ] All buttons (min 44x44px) responsive to tap
- [ ] No "dead zones" between buttons
- [ ] Double-tap zoom controlled
- [ ] Tap highlighting visible

### Swipe Gestures
- [ ] Left swipe navigates backward
- [ ] Right swipe navigates forward
- [ ] Vertical scrolling smooth (not intercepted)
- [ ] Gesture feedback visible

### Long Press
- [ ] Context menu appears on long press (if implemented)
- [ ] No accidental triggers
- [ ] Easy to cancel

## Orientation Testing

### Portrait Mode (Mobile)
- [ ] Layout adapts correctly
- [ ] No horizontal scrolling
- [ ] Text remains readable
- [ ] Touch targets unchanged

### Landscape Mode (Mobile)
- [ ] Content scales appropriately
- [ ] Navigation still accessible
- [ ] Status bar/notch handling works
- [ ] Keyboard inputs smooth

## Focus & Keyboard Navigation

- [ ] Tab navigation works through all interactive elements
- [ ] Focus ring visible on all breakpoints
- [ ] Focus order logical
- [ ] Escape key closes modals
- [ ] Enter key activates buttons

## Performance Checklist

- [ ] No layout shift on resize
- [ ] Smooth animations at 60fps
- [ ] Fast page load on 3G
- [ ] Images lazy-loaded
- [ ] No console errors

## Common Issues & Solutions

### Horizontal Scrolling
**Issue**: Content extends beyond viewport
**Solution**: 
```css
body { overflow-x: hidden; }
/* Check max-width constraints */
/* Verify padding isn't excessive */
```

### Touch Target Too Small
**Issue**: Buttons hard to tap on mobile
**Solution**:
```tsx
// Ensure minimum 44x44px
<button className="min-h-[44px] min-w-[44px] p-2">
  Button text
</button>
```

### Text Too Small on Mobile
**Issue**: Content unreadable on small screens
**Solution**:
```tsx
// Use responsive text sizes
<h1 className="text-xl md:text-2xl lg:text-3xl">
  Responsive heading
</h1>
```

### Layout Breaks at Breakpoint
**Issue**: Content jumps at specific viewport width
**Solution**:
1. Inspect with DevTools at that width
2. Check Tailwind breakpoint usage
3. Look for competing width constraints
4. Test with `max-width` instead of `width`

## Responsive Breakpoint Reference

| Breakpoint | Width | Device Type | Use Case |
|------------|-------|------------|----------|
| Default | 320px+ | Mobile | Default mobile styles |
| sm | 640px+ | Mobile Large | Larger phones |
| md | 768px+ | Tablet Portrait | Tablets in portrait |
| lg | 1024px+ | Tablet Landscape | Tablets in landscape |
| xl | 1280px+ | Desktop/Laptop | Standard desktop |
| 2xl | 1536px+ | Large Desktop | Ultra-wide displays |
| - | 1920px+ | Music Stand | Music stand/display |

## Browser DevTools Tips

### Chrome DevTools
1. **Device Mode**: Ctrl+Shift+M
2. **Show Device Frame**: Click device name dropdown
3. **Emulate Touch**: Enable "Emulate touch screen" under Sensors
4. **Network Throttling**: Simulate 3G/4G speeds
5. **Orientation**: Click landscape/portrait toggle

### Firefox DevTools
1. **Responsive Design Mode**: Ctrl+Shift+M
2. **Touch Simulation**: Enable "Simulate touch events"
3. **Device Preset**: Select from dropdown
4. **Screenshot**: Ctrl+Shift+S

### Safari DevTools
1. **Responsive Design Mode**: Develop > Enter Responsive Design Mode
2. **Device Preset**: Select from dropdown
3. **Orientation**: Rotate device
4. **Inspect Element**: Verify responsive classes

## Automated Testing

### Using Puppeteer/Playwright
```javascript
// Test multiple viewports
const viewports = [
  { width: 375, height: 667 }, // Mobile
  { width: 768, height: 1024 }, // Tablet
  { width: 1920, height: 1080 }, // Desktop
];

for (const viewport of viewports) {
  await page.setViewport(viewport);
  // Test specific assertions
}
```

### Visual Regression Testing
- Take screenshots at each breakpoint
- Compare against baseline
- Flag unexpected changes
- Update baselines when intentional

## Accessibility Testing on Mobile

- [ ] Touch targets are accessible
- [ ] Focus indicators visible
- [ ] Screen reader navigation works
- [ ] Text alternatives for images
- [ ] Color contrast meets WCAG AA

## Performance Metrics to Monitor

- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Time to Interactive (TTI)**: < 3.8s

## Sign-Off Checklist

Before deploying, verify:
- [ ] All pages tested on 3+ breakpoints
- [ ] Touch interactions tested on real device
- [ ] No horizontal scrolling at any width
- [ ] Focus states visible
- [ ] Performance acceptable on 3G
- [ ] Orientation changes handled gracefully
- [ ] Notch/safe area padding correct
- [ ] All interactive elements min 44x44px

