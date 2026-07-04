# Song Actions Menu - Modern UX Guide

## Overview

The song actions menu is now reorganized as a unified three-dot dropdown with a modern, clean hierarchy that consolidates all song management features in one place.

## Menu Structure

### Section 1: Save
- **Save** - Bookmark/save song to library

### Section 2: Share (with divider)
- **Via App** - Web Share API (Messages, WhatsApp, Telegram, etc.)
- **Email** - Share via email with pre-filled content

### Section 3: Export (with divider)
- **ChordPro** - Export in standard ChordPro format
- **Plain Text** - Export as readable text file

### Section 4: Copy & Download (with divider)
- **Copy to Clipboard** - Quick clipboard copy of full song content

### Section 5: Destructive Actions (visual separator)
- **Archive Song** - Move to archive (shows checkmark when already archived)
- **Delete Song** - Permanently remove (red text warning)

## Visual Design

### Styling Details
- **Container**: `rounded-2xl` with `backdrop-blur-md` for modern glass effect
- **Background**: `bg-slate-800/95` with semi-transparent border
- **Dividers**: `border-slate-700/50` for subtle separation between sections
- **Hover States**: Gold accent color (#C09060) for primary actions
- **Destructive**: Red color for delete/archive actions
- **Icons**: Lucide icons for consistency

### Animations
- **Entry**: Spring animation with scale and Y-offset
- **Hover**: Subtle 4px rightward shift with color transition
- **Toast**: Success/error feedback with auto-dismiss (3s)

## Interaction Patterns

### Standard Actions (Save, Share, Export, Copy)
1. Click menu item
2. Action executes
3. Toast notification appears
4. Menu closes automatically
5. Loading state prevents double-clicks

### Destructive Actions (Archive, Delete)
1. Archive: Disables after first click, shows checkmark
2. Delete: Confirmation dialog required first
3. Red warning color for visual distinction
4. 300-500ms delay before modal closes

## Features

### Smart Loading
- `isLoading` state prevents simultaneous actions
- Disabled buttons during processing
- Visual feedback throughout interaction

### Toast Notifications
- Success messages in emerald green
- Error messages in red
- Auto-dismiss after 3 seconds
- Positioned relative to menu

### Archive Status
- Shows checkmark when archived
- Button becomes disabled (grayed out)
- Prevents re-archiving

### Share Methods
- **Via App**: Uses Web Share API for native app sharing
- **Email**: Pre-fills subject and body with song details

### Export Formats
- **ChordPro**: Standard music app format (OnSong, BandHelper compatible)
- **Plain Text**: Universal readable format

## User Flow

```
Click Menu Button (⋮)
    ↓
Menu Opens (Spring animation)
    ↓
User Selects Action:
    - Save → Confirmation toast, menu closes
    - Share → Opens native share or email client, menu closes
    - Export → Downloads file, toast shows status, menu closes
    - Copy → Copies to clipboard, toast shows status, menu closes
    - Archive → Toggles archive status, disables if already archived
    - Delete → Confirmation dialog → Deletion → Modal closes after 300ms
    ↓
Toast Notification (auto-dismisses 3s)
```

## Accessibility

- `aria-label="Song actions"` on menu button
- Semantic button elements with proper contrast
- Disabled states prevent interaction
- Toast notifications announce updates
- Keyboard accessible through standard button behavior

## Mobile Responsive

- Menu positions relative to button (top-right anchor)
- Touch-friendly button sizes (44x44px minimum)
- No hover effects on mobile (handled by tap events)
- Full-width options considered for mobile if needed

## Code Integration

### Import
```typescript
import { SongActionsMenu } from '@/components/song-actions-menu'
```

### Usage
```typescript
<SongActionsMenu 
  song={song}
  onSongArchived={() => handleArchive()}
  onSongDeleted={() => handleDelete()}
/>
```

### Props
- `song`: Song data object
- `onSongArchived?`: Callback when song is archived
- `onSongDeleted?`: Callback when song is deleted

## Toast Messages

### Success Messages
- "Song saved to library"
- "Copied to clipboard"
- "ChordPro file downloaded"
- "Text file downloaded"
- "Song archived"
- "Song deleted"

### Error Messages
- "Failed to save song"
- "Failed to copy"
- "Failed to download file"
- "Failed to archive song"
- "Failed to delete song"

## Future Enhancements

- Undo functionality for delete
- Multi-song batch operations
- Custom export formats
- Share to cloud storage (Google Drive, Dropbox)
- Print to PDF option
- Setlist management integration
