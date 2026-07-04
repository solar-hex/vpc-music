# Song Actions Guide

## Overview

The song actions feature provides users with three powerful management options in the lyrics modal: **Archive**, **Delete**, and **Share**. These actions help users organize their music library and collaborate with team members.

---

## Features

### 1. Archive Song

**Purpose:** Temporarily remove a song from the main library without permanently deleting it.

**How It Works:**
- Click the three-dot menu (⋮) in the lyrics modal header
- Select "Archive Song"
- The song is moved to the archived collection
- A success notification confirms the action
- Once archived, the button shows "Archived" with a checkmark

**Storage:** Songs are stored in `localStorage` under the key `archivedSongs`

**Benefits:**
- Keep library organized
- Hide seasonal or inactive songs
- Easy to restore later
- No data loss

### 2. Delete Song

**Purpose:** Permanently remove a song from the library.

**How It Works:**
- Click the three-dot menu (⋮) in the lyrics modal header
- Select "Delete Song" (shown in red)
- A confirmation dialog appears asking for confirmation
- Upon confirmation, the song is deleted
- The lyrics modal closes automatically
- Success notification is displayed

**Storage:** Deleted songs are tracked in `localStorage` under `deletedSongs`

**Warning:** This action cannot be undone in the current version. Use with caution.

**Safety Features:**
- Requires explicit confirmation before deletion
- Shows song title in confirmation message
- Clear visual indication (red button)

### 3. Share Song

**Purpose:** Share songs with others via multiple methods.

**Share Methods:**

#### 3a. Copy Link
- Copies the song URL and metadata to clipboard
- Users can paste anywhere
- Includes: Title, Artist, Link, Key, BPM, Genre
- Single-click operation

#### 3b. Share via App
- Uses the Web Share API (browser native)
- Available on: iOS, Android, and modern browsers
- Automatically detects compatible apps (Messages, WhatsApp, etc.)
- Falls back to copy if not available

#### 3c. Share via Email
- Opens the default email client
- Pre-fills subject line with song title
- Includes: Title, Artist, Link, Key, BPM, Genre
- Works on all devices with email support

**Shared Content Includes:**
```
Check out "[Song Title]" by [Artist] - Perfect for worship!
Link: [Full URL]
Key: [Song Key]
BPM: [Tempo]
Genre: [Genre]
```

---

## Files & Components

### `lib/song-actions.ts`
Core business logic for all song operations:
- `archiveSong()` - Archive a song
- `deleteSong()` - Delete a song permanently
- `shareSong()` - Share via multiple methods
- `isArchived()` - Check archive status
- `isDeleted()` - Check deletion status
- `getArchivedSongs()` - Retrieve all archived songs
- `getDeletedSongs()` - Retrieve all deleted songs
- `unarchiveSong()` - Restore an archived song

### `components/song-actions-menu.tsx`
UI component for the actions dropdown:
- Three-dot menu button
- Dropdown menu with all actions
- Real-time feedback messages
- Confirmation dialogs
- Loading states during operations

### `components/lyrics-modal.tsx`
Updated to include:
- SongActionsMenu integration
- Proper spacing in header
- Auto-close on deletion

---

## User Interface

### Header Layout
```
[Back] [Song Title]                    [Export] [Menu] [Close]
       [Artist • Key]
```

### Actions Menu Structure
```
┌─────────────────────────┐
│ Archive Song      ✓     │
├─────────────────────────┤
│ SHARE                   │
│ • Copy Link             │
│ • Share...              │
│ • Share via Email       │
├─────────────────────────┤
│ Delete Song (in red)    │
└─────────────────────────┘
```

---

## Storage Implementation

### Archive Storage
```javascript
// localStorage.archivedSongs
["song-id-1", "song-id-2", ...]
```

### Deletion Storage
```javascript
// localStorage.deletedSongs
["song-id-3", "song-id-4", ...]
```

### Functions to Check Status
```javascript
isArchived('song-id') // returns boolean
isDeleted('song-id')  // returns boolean
```

---

## Feedback System

### Success Messages
- "Song archived successfully"
- "Song deleted permanently"
- "Song link copied to clipboard"
- "Song shared successfully"
- "Email client opened"

### Error Messages
- "Failed to archive song"
- "Failed to delete song"
- "Failed to share song"

### Toast Notifications
- Green for success with checkmark icon
- Red for errors with alert icon
- Auto-dismiss after 3 seconds
- Positioned at top-right of menu

---

## Accessibility Features

- ARIA labels on all buttons
- Semantic HTML structure
- Keyboard support
- Screen reader friendly
- Color contrast compliance
- Clear visual states

---

## Best Practices

### For Users
1. Archive songs before deleting to be safe
2. Use share to collaborate with team members
3. Check archived folder periodically
4. Export important songs before deleting

### For Developers
1. Always call appropriate callback functions
2. Handle localStorage errors gracefully
3. Provide user feedback for all operations
4. Confirm destructive actions
5. Test share functionality on target devices

---

## Future Enhancements

- Undo/Restore deleted songs
- Bulk archive/delete operations
- Archive folder view
- Share with specific team members
- Song history/changelog
- Cloud backup integration
- Advanced permission system

---

## Browser Compatibility

| Feature | Desktop | Mobile |
|---------|---------|--------|
| Archive | ✓ | ✓ |
| Delete | ✓ | ✓ |
| Copy Link | ✓ | ✓ |
| Web Share | ✓ | ✓* |
| Email Share | ✓ | ✓ |

*Web Share API available on iOS 15.1+, Android 5.0+

---

## Error Handling

All operations include:
- Try-catch blocks
- Fallback mechanisms
- User-friendly error messages
- Graceful degradation
- Console error logging

---

## Performance Considerations

- Operations use localStorage (instant on client)
- No network requests required
- Minimal re-renders
- Optimized animation transitions
- Efficient confirmation dialogs

---

## Integration Examples

### Basic Usage
```jsx
<SongActionsMenu 
  song={song}
  onSongDeleted={() => {
    // Handle deletion (e.g., close modal)
  }}
/>
```

### With Callbacks
```jsx
<SongActionsMenu 
  song={song}
  onSongArchived={(songId) => {
    console.log(`Song ${songId} archived`)
  }}
  onSongDeleted={(songId) => {
    console.log(`Song ${songId} deleted`)
    navigateBack()
  }}
/>
```

---

## Testing Checklist

- [ ] Archive button works and shows confirmation
- [ ] Delete button requires confirmation
- [ ] Copy link works and includes all metadata
- [ ] Web share appears on supported devices
- [ ] Email share opens default client
- [ ] Feedback toasts display correctly
- [ ] Menu closes after action
- [ ] Mobile responsiveness works
- [ ] Keyboard navigation functional
- [ ] Screen reader announces actions
