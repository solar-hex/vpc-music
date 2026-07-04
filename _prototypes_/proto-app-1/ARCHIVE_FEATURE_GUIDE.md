# Archive Feature Implementation Guide

## Overview
The Archive feature allows users to manage setlists by archiving them (hiding from the active view) and later viewing, restoring, or permanently deleting archived setlists from a dedicated panel. All archived data persists in localStorage.

## Features Implemented

### 1. Archive Button with Badge Counter
- Located beside the "New Setlist" button in the header
- Displays a badge showing the number of archived setlists
- Badge animates in/out smoothly
- Opens the Archived Setlists panel when clicked

### 2. Archive Actions from Setlist Cards
- Each setlist card has three action buttons:
  - **Edit**: Opens the setlist editor
  - **Archive**: Archives the setlist immediately with notification
  - **Delete**: Soft deletes the setlist to trash
- Actions stop propagation to prevent opening detail view
- Archive button provides instant visual feedback

### 3. Archived Setlists Panel
- **Slide-out panel** from the right side of the screen
- **Fully responsive**:
  - Mobile: Full-width panel
  - Tablet: Medium-width panel
  - Desktop: Full panel with optimal width
- **Search functionality**: Filter by title, category, or tags
- **Sort options**:
  - Newest First (default)
  - Oldest First
  - Title (A-Z)
- **Actions per setlist**:
  - Restore: Unarchives and returns to active list
  - Delete: Permanently removes from archive
- **Confirmation dialog**: Required before permanent deletion
- **Responsive layout**: Buttons stack on mobile, horizontal on desktop

### 4. Persistence & Storage
- Archived setlists stored in localStorage (same as active setlists)
- Uses `isArchived?: boolean` flag on Setlist interface
- Auto-saves on every archive/unarchive operation
- Data survives page refresh, navigation, and browser restart

### 5. Animations
- **Archive button badge**: Scales in smoothly
- **Panel open/close**: Spring animation from right side
- **Setlist items**: Fade and slide animations in panel
- **Delete confirmation**: Height animation for reveal
- **Notifications**: Toast-style appearance at bottom of screen
- **Action buttons**: Scale on hover/tap for tactile feedback

### 6. Notifications
- Toast notifications appear at bottom center after actions:
  - "Setlist archived" (green)
  - "Setlist restored" (green)
  - "Deleted permanently" (red) - for permanent deletions
- Auto-dismiss after 3 seconds
- Non-intrusive positioning that doesn't block content

### 7. Responsive Design
- **Mobile (< 640px)**:
  - Full-width panel with top/bottom padding
  - Action buttons stack vertically on each card
  - Search and sort in vertical layout
  - Touch-friendly button sizes

- **Tablet (640px - 1024px)**:
  - Panel takes 80-90% of screen width
  - Action buttons in flexbox row
  - Optimized padding and spacing

- **Desktop (> 1024px)**:
  - Panel positioned on right with max-width
  - Full horizontal layouts
  - Optimal spacing and margins

## File Structure

### New Files
```
components/
  └── archived-setlists-panel.tsx        (250 lines)
      ├── ArchivedSetlistsPanel component
      ├── Search & sort functionality
      ├── Restore & delete actions
      └── Responsive layout
```

### Modified Files
```
lib/
  └── use-setlist-storage.ts
      ├── Added permanentlyDeleteArchived() function
      └── Exported new function

app/
  └── setlist-hub/page.tsx
      ├── Added Archive icon import
      ├── Added ArchivedSetlistsPanel import
      ├── Added isArchivedPanelOpen state
      ├── Added notification state
      ├── Added archivedSetlists filter
      ├── Added Archive button with badge
      ├── Added action buttons to cards
      ├── Integrated ArchivedSetlistsPanel
      └── Added notification toast
```

## API Reference

### Hook Function
```typescript
const { permanentlyDeleteArchived } = useSetlistStorage()

permanentlyDeleteArchived(setlistId: string) => void
```

### Component Props
```typescript
interface ArchivedSetlistsPanelProps {
  isOpen: boolean
  onClose: () => void
  archivedSetlists: Setlist[]
  onRestore: (id: string) => void
  onPermanentlyDelete: (id: string) => void
}
```

## Usage Example

```typescript
'use client'

import { useSetlistStorage } from '@/lib/use-setlist-storage'
import { ArchivedSetlistsPanel } from '@/components/archived-setlists-panel'

export function SetlistHub() {
  const {
    setlists,
    archiveSetlist,
    permanentlyDeleteArchived,
    updateSetlist,
  } = useSetlistStorage()

  const [isArchivedOpen, setIsArchivedOpen] = useState(false)

  const archivedSetlists = setlists.filter(sl => sl.isArchived)

  return (
    <>
      <button onClick={() => archiveSetlist(id)}>Archive</button>
      <button onClick={() => setIsArchivedOpen(true)}>
        Archived ({archivedSetlists.length})
      </button>

      <ArchivedSetlistsPanel
        isOpen={isArchivedOpen}
        onClose={() => setIsArchivedOpen(false)}
        archivedSetlists={archivedSetlists}
        onRestore={(id) => updateSetlist(id, { isArchived: false })}
        onPermanentlyDelete={(id) => permanentlyDeleteArchived(id)}
      />
    </>
  )
}
```

## State Management

### Archive State Flow
```
User clicks Archive
    ↓
archiveSetlist(id)
    ↓
updateSetlist(id, { isArchived: true })
    ↓
Auto-save to localStorage
    ↓
Notification shown
    ↓
Setlist removed from active list
    ↓
Badge counter increments
```

### Restore State Flow
```
User clicks Restore
    ↓
updateSetlist(id, { isArchived: false })
    ↓
Auto-save to localStorage
    ↓
Notification shown
    ↓
Panel closes
    ↓
Setlist appears in active list
    ↓
Badge counter decrements
```

## Styling & Theming

### Color Scheme
- **Archive button**: Slate-800 with hover effect
- **Archive badge**: Gold (#C09060) background
- **Restore button**: Gold gradient
- **Delete button**: Red-900 with transparent background
- **Panel background**: Slate-900 gradient
- **Text**: White on dark backgrounds
- **Accents**: Gold (#C09060) for highlights

### Responsive Classes
```typescript
// Mobile-first approach
className="w-full max-w-2xl"          // Full on mobile, constrained on larger
className="flex-col md:flex-row"      // Stack on mobile, horizontal on medium+
className="gap-2 sm:gap-4"            // Smaller gaps on mobile
```

## Testing Checklist

- [ ] Click Archive button → Panel opens
- [ ] Panel has badge counter showing archived count
- [ ] Archive setlist from card → Notification shows
- [ ] Archived setlist removed from active list
- [ ] Search in panel filters correctly
- [ ] Sort options work (newest, oldest, title)
- [ ] Restore button unarchives setlist
- [ ] Confirm delete dialog appears
- [ ] Permanent delete removes setlist
- [ ] Data persists after refresh
- [ ] Panel responsive on mobile (full-width)
- [ ] Panel responsive on tablet (medium-width)
- [ ] Panel responsive on desktop (optimal-width)
- [ ] Animations smooth and not jarring
- [ ] Toast notifications auto-dismiss
- [ ] No console errors

## Performance Considerations

- **Search/Sort**: Memoized with useMemo to prevent unnecessary re-renders
- **Animations**: GPU-accelerated transforms (x, y, opacity)
- **Panel rendering**: Mounted only when open (AnimatePresence)
- **Storage operations**: Batched auto-save with debounce
- **Memory**: No memory leaks from timeouts (cleaned up)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers with localStorage support

## Future Enhancements

- [ ] Bulk archive/restore operations
- [ ] Archive/unarchive all
- [ ] Archive reason/notes
- [ ] Archive history timeline
- [ ] Auto-archive old setlists
- [ ] Archive expiration (delete after X days)
- [ ] Archive export/backup
- [ ] Archive sharing
