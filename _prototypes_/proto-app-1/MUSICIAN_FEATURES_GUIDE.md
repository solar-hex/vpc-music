# Musician Features Implementation Guide

## Overview
Comprehensive musician features for the VPC Music worship app, enabling real-time sync, metronome, instruments display, and more.

## Features Implemented

### 1. Audio Track Sync (🎵)
**Location**: Song detail view, Tools tab
**Status**: ✅ Implemented with localStorage persistence

**Functionality:**
- Visual progress bar showing audio sync status
- BPM display synchronized with current speed
- Audio playback timeline indicator
- Real-time sync visualization with smooth animations

**How to Use:**
1. Open a song in the Songs page
2. Click the Tools tab
3. Enable "Audio Track Sync" in Musician Features modal
4. Audio sync panel appears showing playback progress and BPM

**State Management:**
- Persists to localStorage as `musicianFeatures_audioTrackSync`
- Automatically loads on app restart

---

### 2. Capo & Fingering Tips (🎸)
**Location**: Song detail view, top controls
**Status**: ✅ Implemented with full functionality

**Functionality:**
- Displays capo position based on transposition
- Shows fret position for guitar players
- Visual dropdown with capo information
- Real-time updates when transposition changes

**How to Use:**
1. Open a song in the Songs page
2. Adjust the transpose slider to change key
3. Click the 🎸 button in top controls to view capo position
4. Capo tip adjusts automatically based on transposition

**Integration:**
- Linked to transpose controls
- Works with capo slider settings
- Updates in real-time as key changes

---

### 3. Show Scales & Modes (🎹)
**Location**: Song detail view, top controls
**Status**: ✅ Implemented with chord information

**Functionality:**
- Displays chord scale information dropdown
- Shows current song key
- Provides improvisation guidance
- Real-time key updates with transposition

**How to Use:**
1. Open a song in the Songs page
2. Click the 🎹 button in top controls
3. View key and scale information
4. Information updates when transposition changes

**Data Displayed:**
- Current key (updates with transpose)
- Scale description
- Improvisation tips

---

### 4. Metronome (🔊)
**Location**: Song detail view, both toolbar and dedicated panel
**Status**: ✅ Fully implemented with BPM control

**Functionality:**
- Metronome widget with play/stop controls
- BPM display and adjustment
- Visual beat indicator (pulsing dot)
- Playing/ready status display
- Both toolbar button and dedicated panel

**How to Use:**
1. Open a song in the Songs page
2. Click the 🔊 button to toggle metronome
3. Use BPM slider to adjust tempo
4. Click Start/Stop in the metronome panel or toolbar dropdown

**Features:**
- Real-time BPM sync
- Visual feedback during playback
- Persistent state across sessions

---

### 5. Type of Instruments (🎺)
**Location**: Song detail view, dedicated panel
**Status**: ✅ Implemented with default instruments

**Functionality:**
- Displays recommended instruments for each song
- Visual instrument badges
- Extensible instrument list
- Real-time display based on song settings

**How to Use:**
1. Open a song in the Songs page
2. Enable "Type of Instruments" in Musician Features modal
3. Instruments panel displays at bottom of display area
4. Shows: Vocals, Guitar, Bass, Drums, Keys (default set)

**Instrument Management:**
- Default instruments: Vocals, Guitar, Bass, Drums, Keys
- Can be extended per song in Song interface
- Visual badges with hover effects

---

## localStorage Persistence

All five musician features persist their enable/disable state to localStorage:

```javascript
musicianFeatures_audioTrackSync  // Boolean: true/false
musicianFeatures_capoTips        // Boolean: true/false
musicianFeatures_showScales      // Boolean: true/false
musicianFeatures_metronome       // Boolean: true/false
musicianFeatures_showInstruments // Boolean: true/false
```

**Behavior:**
- Preferences load on app startup
- Changes update localStorage immediately
- Preferences persist across browser sessions
- Works with page refreshes and app restarts

---

## UI Components

### MetronomeWidget
```tsx
<MetronomeWidget 
  bpm={120} 
  playing={false} 
  onToggle={() => setMetronomePlaying(!metronomePlaying)} 
/>
```
Displays metronome controls and BPM display.

### AudioTrackSync
```tsx
<AudioTrackSync 
  bpm={120} 
  progress={50} 
/>
```
Shows audio sync progress bar and status.

### InstrumentsPanel
```tsx
<InstrumentsPanel song={song} />
```
Displays recommended instruments for a song.

---

## Integration Points

### ToolsTab Component (`app/songs/page.tsx`)
All features are integrated into the ToolsTab component which:
- Manages feature state with localStorage persistence
- Renders feature panels conditionally
- Updates BPM and transpose controls
- Syncs all feature states

### Feature Toggles
Located in Musician Features modal:
- Each checkbox updates its respective feature
- Changes persist to localStorage
- Real-time UI updates when toggled

### Display Area
Features render in the main song display:
- Audio sync progress bar
- Metronome widget
- Instruments panel
- All positioned below the song title/controls

---

## Technical Details

### State Management
- localStorage-backed useState for persistence
- Update functions handle both state and storage updates
- SSR-safe default values

### Component Updates
- Features render conditionally based on toggle state
- Real-time updates when settings change
- Smooth Framer Motion animations

### Theme Support
- Supports both "night" and default themes
- Color coordination with worship app accent (#C09060)
- Responsive design for mobile and desktop

---

## Future Enhancements

Possible additions:
- Audio click sound for metronome
- Custom instrument sets per song
- Fingering diagram display
- Scale visualization overlay
- Multi-client sync for team metronome
- Recording capability with audio track

---

## Troubleshooting

**Features not persisting after page refresh?**
- Check browser's localStorage is enabled
- Check console for errors
- Clear localStorage and reload app

**Metronome not starting?**
- Ensure audio permissions are granted
- Check browser console for audio errors
- Try different browser if issue persists

**Instruments not showing?**
- Verify feature is enabled in Musician Features modal
- Check song has instruments field populated
- Reload page if not appearing

---

## File Locations

- **Main Implementation**: `/app/songs/page.tsx` (ToolsTab, feature components)
- **Components**: 
  - MetronomeWidget
  - AudioTrackSync
  - InstrumentsPanel
- **State Management**: localStorage with useState hooks
- **Chord Notation Integration**: `/lib/use-display-chord-notation.ts`

