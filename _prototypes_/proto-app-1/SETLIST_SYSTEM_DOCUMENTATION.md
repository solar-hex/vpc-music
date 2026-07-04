# Production Setlist System Documentation

## Overview
The VPC Music Setlist System is a production-ready implementation using localStorage persistence, auto-save, drag-and-drop reordering, archive functionality, and trash recovery.

## Architecture

### Core Files
1. **`lib/use-setlist-storage.ts`** (300+ lines)
   - Custom React hook for all setlist state management
   - localStorage persistence with separate keys for setlists and trash
   - Auto-save with 500ms debounce
   - Full CRUD operations and trash recovery
   - Hydration-safe loading with isLoaded state

2. **`app/setlist-hub/page.tsx`** (Production component)
   - Uses `useSetlistStorage()` hook for all state
   - Hydration-safe rendering (loading state prevents mismatch)
   - Drag-and-drop song reordering with persistence
   - Edit mode for detailed setlist management
   - Create new setlists with song selection

### Data Structures

#### Setlist Interface
```typescript
interface Setlist {
  id: string
  title: string
  category: string
  songs: Song[]
  createdDate: string
  modifiedDate?: string
  isArchived?: boolean
  status?: 'READY' | 'MISSING_CHORDS' | 'SYNCED'
  keyRange?: string
  totalDuration?: number
  averageBpm?: number
  flowScore?: number
  leader?: string
  tags?: string[]
  notes?: string
  teamMembers?: Array<{ id: string; name: string; role: string }>
}
```

#### Song Interface
```typescript
interface Song {
  id: string
  title: string
  artist: string
  originalKey: string
  keyOverride?: string
  position: number
  duration?: number
  bpm?: number
}
```

#### TrashItem Interface
```typescript
interface TrashItem {
  id: string
  setlist: Setlist
  deletedDate: string
}
```

## Features

### 1. localStorage Persistence
- **Setlists Storage Key**: `vpc_music_setlists`
- **Trash Storage Key**: `vpc_music_trash`
- Automatic serialization/deserialization
- Error handling with fallback to empty state
- Survives page navigation and browser restarts

### 2. Auto-Save System
- Debounced saves (500ms delay)
- Visual feedback with save status indicator
- States: 'idle', 'saving', 'saved'
- Prevents excessive writes to localStorage
- Timeout cleanup on unmount

### 3. Hydration-Safe Implementation
- `isLoaded` state prevents rendering before data loads
- Loading spinner displayed until data is ready
- Prevents hydration mismatch errors
- Safe for SSR/SSG if needed in future

### 4. Drag-and-Drop
- Built with `@dnd-kit/core` and sortables
- Reorder songs within setlists
- Automatic position updates (1-based indexing)
- Visual feedback during drag
- Keyboard navigation support

### 5. Archive Functionality
- `isArchived` boolean flag on setlist
- Archived setlists hidden from main view
- Filter using: `setlists.filter(sl => !sl.isArchived)`
- Can be restored from archive

### 6. Trash & Recovery
- Deleted setlists moved to trash (not permanent)
- Separate trash storage
- Restore setlists from trash
- Permanent deletion from trash
- Empty trash functionality

## Hook API

### `useSetlistStorage()`

```typescript
const {
  setlists,           // Current active setlists
  trash,              // Deleted setlists in trash
  saveStatus,         // 'idle' | 'saving' | 'saved'
  isLoaded,           // Whether localStorage loaded
  addSetlist,         // (setlist: Setlist) => void
  updateSetlist,      // (id: string, updates: Partial<Setlist>) => void
  deleteSetlist,      // (id: string) => void - moves to trash
  archiveSetlist,     // (id: string) => void
  restoreFromTrash,   // (trashId: string) => void
  permanentlyDeleteFromTrash, // (trashId: string) => void
  emptyTrash,         // () => void
  reorderSongs,       // (setlistId: string, songs: Song[]) => void
} = useSetlistStorage()
```

## Usage Example

### In Components

```typescript
'use client'

import { useSetlistStorage } from '@/lib/use-setlist-storage'

export function MyComponent() {
  const { setlists, addSetlist, updateSetlist, deleteSetlist, saveStatus, isLoaded } = useSetlistStorage()

  // Don't render until loaded
  if (!isLoaded) return <div>Loading...</div>

  return (
    <div>
      <p>Save Status: {saveStatus}</p>
      
      {/* List setlists */}
      {setlists.map(sl => (
        <div key={sl.id}>
          <h3>{sl.title}</h3>
          <button onClick={() => deleteSetlist(sl.id)}>Delete</button>
        </div>
      ))}

      {/* Create new setlist */}
      <button onClick={() => {
        addSetlist({
          id: `setlist_${Date.now()}`,
          title: 'New Setlist',
          category: 'CHURCH',
          songs: [],
          createdDate: new Date().toLocaleDateString(),
        })
      }}>
        Add Setlist
      </button>
    </div>
  )
}
```

## Storage Schema

### localStorage: `vpc_music_setlists`
```json
[
  {
    "id": "setlist_1234567890",
    "title": "Sunday Worship",
    "category": "CHURCH",
    "songs": [...],
    "createdDate": "May 19, 2025",
    "modifiedDate": "2025-05-19T14:30:00.000Z",
    "isArchived": false,
    "status": "READY"
  }
]
```

### localStorage: `vpc_music_trash`
```json
[
  {
    "id": "trash_1234567890",
    "setlist": {...},
    "deletedDate": "2025-05-19T15:00:00.000Z"
  }
]
```

## Theme Support

### Dark Mode
- Uses semantic CSS variables from globals.css
- Dark backgrounds: `bg-slate-900 to-slate-800` for container
- Text colors auto-adapt with Tailwind dark mode
- Borders use `border-slate-600` for visibility

### Light Mode
- Automatic theming via CSS variables
- Colors defined in `app/globals.css`
- No hardcoded colors in setlist components
- Respects system theme preference

## Performance Optimizations

1. **Debounced Saves**: 500ms delay prevents rapid localStorage writes
2. **Lazy Loading**: Data loaded only on first mount
3. **Selective Rendering**: Only active setlists rendered by default
4. **Memoized Callbacks**: useCallback prevents unnecessary re-renders
5. **Event Handlers**: Efficient state updates with callbacks

## Common Tasks

### Create a Setlist
```typescript
const { addSetlist } = useSetlistStorage()

addSetlist({
  id: `setlist_${Date.now()}`,
  title: 'New Setlist',
  category: 'CHURCH',
  songs: [],
  createdDate: new Date().toLocaleDateString(),
})
```

### Update a Setlist
```typescript
const { updateSetlist } = useSetlistStorage()

updateSetlist(setlistId, {
  title: 'Updated Title',
  tags: ['Worship', 'Praise'],
})
```

### Delete a Setlist (to Trash)
```typescript
const { deleteSetlist } = useSetlistStorage()

deleteSetlist(setlistId) // Moves to trash
```

### Restore from Trash
```typescript
const { restoreFromTrash } = useSetlistStorage()

restoreFromTrash(trashItemId)
```

### Reorder Songs
```typescript
const { reorderSongs } = useSetlistStorage()

reorderSongs(setlistId, reorderedSongs) // Auto-updates positions
```

## Troubleshooting

### Hydration Mismatch
**Issue**: "Hydration mismatch" errors on page load
**Solution**: The hook includes `isLoaded` state. Always check this before rendering:
```typescript
if (!isLoaded) return <LoadingSpinner />
```

### Changes Not Persisting
**Issue**: Changes disappear after refresh
**Solution**: Verify localStorage is enabled in browser. Check console for errors.

### Drag-and-Drop Not Working
**Issue**: Songs can't be reordered
**Solution**: Ensure `@dnd-kit` packages are installed and imported correctly.

### Save Status Not Updating
**Issue**: "Saving/Saved" indicators don't appear
**Solution**: Ensure `saveStatus` is included in render and displayed properly.

## Browser Support

- All modern browsers with localStorage support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

- [ ] Cloud sync via backend API
- [ ] Collaboration/sharing setlists
- [ ] Export/import setlists
- [ ] Setlist templates
- [ ] Smart song suggestions
- [ ] Performance metrics tracking
- [ ] Undo/redo functionality
- [ ] Setlist versioning

