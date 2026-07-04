'use client'

// Song archive, delete, and share actions

export interface SongActionCallbacks {
  onArchive?: (songId: string) => Promise<void> | void
  onDelete?: (songId: string) => Promise<void> | void
  onShare?: (song: any) => Promise<void> | void
}

// Archive a song - moves it to archived collection
export async function archiveSong(
  songId: string,
  title: string,
  onArchiveCallback?: (songId: string) => Promise<void> | void
) {
  try {
    // Store in localStorage for demo purposes
    const archivedSongs = JSON.parse(localStorage.getItem('archivedSongs') || '[]')
    if (!archivedSongs.includes(songId)) {
      archivedSongs.push(songId)
      localStorage.setItem('archivedSongs', JSON.stringify(archivedSongs))
    }

    // Call optional callback
    if (onArchiveCallback) {
      await onArchiveCallback(songId)
    }

    return {
      success: true,
      message: `"${title}" archived successfully`
    }
  } catch (error) {
    console.error('Archive failed:', error)
    return {
      success: false,
      message: 'Failed to archive song'
    }
  }
}

// Delete a song permanently
export async function deleteSong(
  songId: string,
  title: string,
  onDeleteCallback?: (songId: string) => Promise<void> | void
) {
  try {
    // Store deletion in localStorage for demo purposes
    const deletedSongs = JSON.parse(localStorage.getItem('deletedSongs') || '[]')
    if (!deletedSongs.includes(songId)) {
      deletedSongs.push(songId)
      localStorage.setItem('deletedSongs', JSON.stringify(deletedSongs))
    }

    // Remove from archived if present
    const archivedSongs = JSON.parse(localStorage.getItem('archivedSongs') || '[]')
    const updatedArchived = archivedSongs.filter((id: string) => id !== songId)
    localStorage.setItem('archivedSongs', JSON.stringify(updatedArchived))

    // Call optional callback
    if (onDeleteCallback) {
      await onDeleteCallback(songId)
    }

    return {
      success: true,
      message: `"${title}" deleted permanently`
    }
  } catch (error) {
    console.error('Delete failed:', error)
    return {
      success: false,
      message: 'Failed to delete song'
    }
  }
}

// Share a song via multiple methods
export async function shareSong(
  song: any,
  method: 'copy' | 'web-share' | 'email',
  onShareCallback?: (song: any) => Promise<void> | void
) {
  try {
    const shareContent = `Check out "${song.title}" by ${song.artist} - Perfect for worship!`
    const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/songs/${song.id}`

    if (method === 'copy') {
      // Copy to clipboard
      const textToCopy = `${shareContent}\n${shareUrl}`
      await navigator.clipboard.writeText(textToCopy)
      return {
        success: true,
        message: 'Song link copied to clipboard'
      }
    } else if (method === 'web-share') {
      // Web Share API
      if (navigator.share) {
        await navigator.share({
          title: song.title,
          text: shareContent,
          url: shareUrl
        })
        return {
          success: true,
          message: 'Song shared successfully'
        }
      } else {
        // Fallback to copy
        const textToCopy = `${shareContent}\n${shareUrl}`
        await navigator.clipboard.writeText(textToCopy)
        return {
          success: true,
          message: 'Song link copied to clipboard'
        }
      }
    } else if (method === 'email') {
      // Email share
      const subject = encodeURIComponent(`Check out: ${song.title} by ${song.artist}`)
      const body = encodeURIComponent(
        `${shareContent}\n\nLink: ${shareUrl}\n\nKey: ${song.key}\nBPM: ${song.bpm || 'N/A'}\nGenre: ${song.genre || 'N/A'}`
      )
      window.location.href = `mailto:?subject=${subject}&body=${body}`
      return {
        success: true,
        message: 'Email client opened'
      }
    }

    // Call optional callback
    if (onShareCallback) {
      await onShareCallback(song)
    }

    return {
      success: true,
      message: 'Song shared'
    }
  } catch (error) {
    console.error('Share failed:', error)
    return {
      success: false,
      message: 'Failed to share song'
    }
  }
}

// Check if song is archived
export function isArchived(songId: string): boolean {
  if (typeof window === 'undefined') return false
  const archivedSongs = JSON.parse(localStorage.getItem('archivedSongs') || '[]')
  return archivedSongs.includes(songId)
}

// Check if song is deleted
export function isDeleted(songId: string): boolean {
  if (typeof window === 'undefined') return false
  const deletedSongs = JSON.parse(localStorage.getItem('deletedSongs') || '[]')
  return deletedSongs.includes(songId)
}

// Get all archived songs
export function getArchivedSongs(): string[] {
  if (typeof window === 'undefined') return []
  return JSON.parse(localStorage.getItem('archivedSongs') || '[]')
}

// Get all deleted songs
export function getDeletedSongs(): string[] {
  if (typeof window === 'undefined') return []
  return JSON.parse(localStorage.getItem('deletedSongs') || '[]')
}

// Unarchive a song
export async function unarchiveSong(
  songId: string,
  title: string
) {
  try {
    const archivedSongs = JSON.parse(localStorage.getItem('archivedSongs') || '[]')
    const updated = archivedSongs.filter((id: string) => id !== songId)
    localStorage.setItem('archivedSongs', JSON.stringify(updated))
    return {
      success: true,
      message: `"${title}" unarchived successfully`
    }
  } catch (error) {
    console.error('Unarchive failed:', error)
    return {
      success: false,
      message: 'Failed to unarchive song'
    }
  }
}
