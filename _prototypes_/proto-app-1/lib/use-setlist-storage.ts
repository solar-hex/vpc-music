/**
 * Setlist Storage Hook
 * Handles localStorage persistence, auto-save, trash recovery, and state sync
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export interface Song {
  id: string
  title: string
  artist: string
  originalKey: string
  keyOverride?: string
  position: number
  duration?: number
  bpm?: number
  // Advanced music details
  timeSignature?: string // e.g., "4/4", "3/4"
  capo?: number
  difficulty?: 'EASY' | 'INTERMEDIATE' | 'ADVANCED'
  status?: 'READY' | 'NEEDS_REVIEW' | 'IN_REHEARSAL' | 'UPDATED' | 'MISSING_CHORDS' | 'ARCHIVED'
  // Role assignments
  vocalLead?: string // vocalist name/ID
  harmonies?: string[] // additional vocalists
  instruments?: string[] // e.g., ["Guitar", "Keys", "Bass", "Drums"]
  // Transition & flow
  transitionNotes?: string
  speakingCues?: string
  prayerMoment?: boolean
  countdownTimer?: number // in seconds
  spontaneousMarker?: boolean
  // Arrangement & variations
  arrangement?: 'ACOUSTIC' | 'ELECTRIC' | 'FULL_BAND' | 'STRIPPED_DOWN'
  nashvilleNumbers?: boolean
  hasChordDiagrams?: boolean
  // Metadata
  tags?: string[]
  notes?: string
  choreography?: string // worship choreography notes
  comments?: Array<{
    id: string
    author: string
    text: string
    timestamp: string
    mentions?: string[] // @mentions of team members
  }>
}

export interface Setlist {
  id: string
  title: string
  category: string
  songs: Song[]
  createdDate: string
  modifiedDate?: string
  isArchived?: boolean
  archivedDate?: string
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

export interface TrashItem {
  id: string
  setlist: Setlist
  deletedDate: string
}

interface StorageData {
  setlists: Setlist[]
  trash: TrashItem[]
  lastModified: string
}

const SETLISTS_STORAGE_KEY = 'vpc_music_setlists'
const TRASH_STORAGE_KEY = 'vpc_music_trash'

/**
 * Initialize storage with empty data
 */
function getDefaultStorage(): StorageData {
  const now = new Date().toISOString()
  
  // Sample setlists
  const sampleSetlists: Setlist[] = [
    {
      id: 'sample_1',
      title: 'SUNDAY MORNING WORSHIP',
      category: 'WORSHIP',
      leader: 'MICHAEL T.',
      status: 'READY',
      keyRange: 'D → G',
      totalDuration: 5280,
      flowScore: 92,
      createdDate: new Date(Date.now() - 86400000 * 7).toISOString(),
      modifiedDate: now,
      songs: [
        {
          id: 'song_1',
          title: 'Goodness of God',
          artist: 'JENN JOHNSON',
          originalKey: 'D',
          position: 1,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_2',
          title: 'Living Hope',
          artist: 'PHIL WICKHAM',
          originalKey: 'G',
          position: 2,
          status: 'READY',
          duration: 240,
        },
        {
          id: 'song_3',
          title: 'What A Beautiful Name',
          artist: 'BROOKE LIGERTWOOD',
          originalKey: 'E',
          position: 3,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_4',
          title: 'The Goodness of Jesus',
          artist: 'JENN JOHNSON',
          originalKey: 'D',
          position: 4,
          status: 'READY',
          duration: 360,
        },
        {
          id: 'song_5',
          title: 'Way Maker',
          artist: 'SINACH',
          originalKey: 'F#',
          position: 5,
          status: 'READY',
          duration: 240,
        },
        {
          id: 'song_6',
          title: 'In Christ Alone',
          artist: 'KEITH GETTY',
          originalKey: 'G',
          position: 6,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_7',
          title: 'Jesus I Believe',
          artist: 'PHIL WICKHAM',
          originalKey: 'D',
          position: 7,
          status: 'READY',
          duration: 240,
        },
      ],
      tags: ['WORSHIP', 'PRAISE', 'CONTEMPORARY'],
    },
    {
      id: 'sample_2',
      title: 'ACOUSTIC SET',
      category: 'ACOUSTIC',
      leader: 'JOHN D.',
      status: 'READY',
      keyRange: 'C → G',
      totalDuration: 3600,
      flowScore: 88,
      createdDate: new Date(Date.now() - 86400000 * 3).toISOString(),
      modifiedDate: now,
      songs: [
        {
          id: 'song_8',
          title: 'Such An Awesome God',
          artist: 'BEN FIELDING',
          originalKey: 'G',
          position: 1,
          status: 'READY',
          duration: 240,
        },
        {
          id: 'song_9',
          title: 'Mighty To Save',
          artist: 'REUBEN MORGAN',
          originalKey: 'D',
          position: 2,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_10',
          title: 'Spontaneous Worship',
          artist: 'SPONTANEOUS',
          originalKey: 'C',
          position: 3,
          status: 'READY',
          duration: 180,
        },
        {
          id: 'song_11',
          title: 'Graves Into Gardens',
          artist: 'BRANDON LAKE',
          originalKey: 'E',
          position: 4,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_12',
          title: 'No Longer Slaves',
          artist: 'JONATHAN DAVID',
          originalKey: 'G',
          position: 5,
          status: 'READY',
          duration: 360,
        },
        {
          id: 'song_13',
          title: 'Breath Of Heaven',
          artist: 'AMY GRANT',
          originalKey: 'C',
          position: 6,
          status: 'READY',
          duration: 240,
        },
      ],
      tags: ['ACOUSTIC', 'WORSHIP', 'INTIMATE'],
    },
    {
      id: 'sample_3',
      title: 'YOUTH NIGHT',
      category: 'YOUTH',
      leader: 'YOU',
      status: 'READY',
      keyRange: 'D → A',
      totalDuration: 4200,
      flowScore: 85,
      createdDate: new Date(Date.now() - 86400000 * 1).toISOString(),
      modifiedDate: now,
      songs: [
        {
          id: 'song_14',
          title: 'Bethel Music Spontaneous',
          artist: 'BETHEL MUSIC',
          originalKey: 'D',
          position: 1,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_15',
          title: 'Endless Alleluia',
          artist: 'JESUS IMAGE',
          originalKey: 'A',
          position: 2,
          status: 'READY',
          duration: 240,
        },
        {
          id: 'song_16',
          title: 'Defender',
          artist: 'BRANDON LAKE',
          originalKey: 'D',
          position: 3,
          status: 'READY',
          duration: 360,
        },
        {
          id: 'song_17',
          title: 'Build My Life',
          artist: 'KRISTIAN STANFILL',
          originalKey: 'E',
          position: 4,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_18',
          title: 'Raise A Hallelujah',
          artist: 'BETHEL MUSIC',
          originalKey: 'F#',
          position: 5,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_19',
          title: 'Glory To God Forever',
          artist: 'JESUS CULTURE',
          originalKey: 'D',
          position: 6,
          status: 'READY',
          duration: 240,
        },
        {
          id: 'song_20',
          title: 'Every Season',
          artist: 'MADNESS',
          originalKey: 'A',
          position: 7,
          status: 'READY',
          duration: 300,
        },
      ],
      tags: ['YOUTH', 'CONTEMPORARY', 'UPBEAT', 'ELECTRIC'],
    },
    {
      id: 'sample_4',
      title: 'EVENING PRAYER VIGIL',
      category: 'PRAYER',
      leader: 'SARAH M.',
      status: 'READY',
      keyRange: 'Am → Em',
      totalDuration: 4320,
      flowScore: 90,
      createdDate: new Date(Date.now() - 86400000 * 2).toISOString(),
      modifiedDate: now,
      songs: [
        {
          id: 'song_21',
          title: 'Moment Of Surrender',
          artist: 'JESUS CULTURE',
          originalKey: 'Am',
          position: 1,
          status: 'READY',
          duration: 360,
        },
        {
          id: 'song_22',
          title: 'Nothing But The Blood',
          artist: 'ANDY PARK',
          originalKey: 'Em',
          position: 2,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_23',
          title: 'How Great Is Our God',
          artist: 'CHRIS TOMLIN',
          originalKey: 'D',
          position: 3,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_24',
          title: 'Endless Alleluia',
          artist: 'JESUS IMAGE',
          originalKey: 'A',
          position: 4,
          status: 'READY',
          duration: 240,
        },
        {
          id: 'song_25',
          title: 'Communion',
          artist: 'BETHEL MUSIC',
          originalKey: 'G',
          position: 5,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_26',
          title: 'Jesus Draw Me Close',
          artist: 'RICK FOUNDS',
          originalKey: 'C',
          position: 6,
          status: 'READY',
          duration: 240,
        },
      ],
      tags: ['PRAYER', 'CONTEMPLATIVE', 'INTIMATE', 'EVENING'],
    },
    {
      id: 'sample_5',
      title: 'SUNDAY EVENING PRAISE',
      category: 'PRAISE',
      leader: 'DAVID K.',
      status: 'READY',
      keyRange: 'E → B',
      totalDuration: 5040,
      flowScore: 94,
      createdDate: new Date(Date.now() - 86400000 * 1).toISOString(),
      modifiedDate: now,
      songs: [
        {
          id: 'song_27',
          title: 'Oceans',
          artist: 'HILLSONG UNITED',
          originalKey: 'E',
          position: 1,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_28',
          title: 'Taya',
          artist: 'BETHEL MUSIC',
          originalKey: 'B',
          position: 2,
          status: 'READY',
          duration: 360,
        },
        {
          id: 'song_29',
          title: 'Lion And The Lamb',
          artist: 'BETHEL MUSIC',
          originalKey: 'F#',
          position: 3,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_30',
          title: 'Tremble',
          artist: 'LAURA MVULA',
          originalKey: 'Bm',
          position: 4,
          status: 'READY',
          duration: 240,
        },
        {
          id: 'song_31',
          title: 'Jesus Lover Of My Soul',
          artist: 'GATEWAY WORSHIP',
          originalKey: 'E',
          position: 5,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_32',
          title: 'Blessed Assurance',
          artist: 'HYMN ARRANGEMENT',
          originalKey: 'D',
          position: 6,
          status: 'READY',
          duration: 240,
        },
        {
          id: 'song_33',
          title: 'Great Are You Lord',
          artist: 'BRANDON LAKE',
          originalKey: 'F#',
          position: 7,
          status: 'READY',
          duration: 300,
        },
      ],
      tags: ['PRAISE', 'WORSHIP', 'EVENING', 'CELEBRATION'],
    },
    {
      id: 'sample_6',
      title: 'MIDWEEK REVIVAL',
      category: 'REVIVAL',
      leader: 'PASTOR JAMES',
      status: 'READY',
      keyRange: 'G → D',
      totalDuration: 4680,
      flowScore: 87,
      createdDate: new Date(Date.now() - 86400000 * 1).toISOString(),
      modifiedDate: now,
      songs: [
        {
          id: 'song_34',
          title: 'Revival Fire',
          artist: 'JESUS CULTURE',
          originalKey: 'G',
          position: 1,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_35',
          title: 'Set A Fire',
          artist: 'JESUS CULTURE',
          originalKey: 'D',
          position: 2,
          status: 'READY',
          duration: 360,
        },
        {
          id: 'song_36',
          title: 'Power In The Blood',
          artist: 'HYMN ARRANGEMENT',
          originalKey: 'G',
          position: 3,
          status: 'READY',
          duration: 240,
        },
        {
          id: 'song_37',
          title: 'Holy Forever',
          artist: 'JESUS CULTURE',
          originalKey: 'A',
          position: 4,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_38',
          title: 'Release The Power',
          artist: 'SPONTANEOUS WORSHIP',
          originalKey: 'D',
          position: 5,
          status: 'READY',
          duration: 240,
        },
        {
          id: 'song_39',
          title: 'Lamb Of God',
          artist: 'TWILA PARIS',
          originalKey: 'Em',
          position: 6,
          status: 'READY',
          duration: 300,
        },
        {
          id: 'song_40',
          title: 'His Glory Appears',
          artist: 'JESUS CULTURE',
          originalKey: 'G',
          position: 7,
          status: 'READY',
          duration: 300,
        },
      ],
      tags: ['REVIVAL', 'WORSHIP', 'SPIRITUAL', 'MIDWEEK'],
    },
  ]
  
  return {
    setlists: sampleSetlists,
    trash: [],
    lastModified: now,
  }
}

/**
 * Load setlists from localStorage
 */
export function loadSetlistsFromStorage(): Setlist[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(SETLISTS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('[v0] Failed to load setlists from storage:', error)
    return []
  }
}

/**
 * Save setlists to localStorage
 */
export function saveSetlistsToStorage(setlists: Setlist[]): boolean {
  if (typeof window === 'undefined') return false

  try {
    localStorage.setItem(SETLISTS_STORAGE_KEY, JSON.stringify(setlists))
    return true
  } catch (error) {
    console.error('[v0] Failed to save setlists to storage:', error)
    return false
  }
}

/**
 * Load trash items from localStorage
 */
export function loadTrashFromStorage(): TrashItem[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(TRASH_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('[v0] Failed to load trash from storage:', error)
    return []
  }
}

/**
 * Save trash items to localStorage
 */
export function saveTrashToStorage(trash: TrashItem[]): boolean {
  if (typeof window === 'undefined') return false

  try {
    localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(trash))
    return true
  } catch (error) {
    console.error('[v0] Failed to save trash to storage:', error)
    return false
  }
}

/**
 * Custom hook for managing setlist state with auto-save
 */
export function useSetlistStorage() {
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [trash, setTrash] = useState<TrashItem[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isLoaded, setIsLoaded] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load setlists and trash from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      let loadedSetlists = loadSetlistsFromStorage()
      const loadedTrash = loadTrashFromStorage()
      
      // If no setlists exist, use sample data
      if (loadedSetlists.length === 0) {
        const defaultData = getDefaultStorage()
        loadedSetlists = defaultData.setlists
        // Auto-save sample data to localStorage
        saveSetlistsToStorage(loadedSetlists)
      }
      
      setSetlists(loadedSetlists)
      setTrash(loadedTrash)
      setIsLoaded(true)
    } catch (error) {
      console.error('[v0] Failed to initialize storage:', error)
      setIsLoaded(true)
    }
  }, [])

  // Auto-save setlists to localStorage with debouncing
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return

    setSaveStatus('saving')

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      const success = saveSetlistsToStorage(setlists)
      setSaveStatus(success ? 'saved' : 'idle')

      const resetTimeout = setTimeout(() => setSaveStatus('idle'), 2000)
      return () => clearTimeout(resetTimeout)
    }, 500)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [setlists, isLoaded])

  // Auto-save trash to localStorage
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return

    saveTrashToStorage(trash)
  }, [trash, isLoaded])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  // Add a new setlist
  const addSetlist = useCallback((setlist: Setlist) => {
    setSetlists(prev => [...prev, setlist])
  }, [])

  // Update a setlist
  const updateSetlist = useCallback((id: string, updates: Partial<Setlist>) => {
    setSetlists(prev =>
      prev.map(sl =>
        sl.id === id
          ? { ...sl, ...updates, modifiedDate: new Date().toISOString() }
          : sl
      )
    )
  }, [])

  // Delete a setlist (move to trash)
  const deleteSetlist = useCallback((id: string) => {
    const setlist = setlists.find(sl => sl.id === id)
    if (!setlist) return

    setSetlists(prev => prev.filter(sl => sl.id !== id))
    setTrash(prev => [
      ...prev,
      { id: `trash_${Date.now()}`, setlist, deletedDate: new Date().toISOString() },
    ])
  }, [setlists])

  // Archive a setlist
  const archiveSetlist = useCallback((id: string) => {
    updateSetlist(id, { isArchived: true, archivedDate: new Date().toISOString() })
  }, [updateSetlist])

  // Permanently delete an archived setlist
  const permanentlyDeleteArchived = useCallback((id: string) => {
    setSetlists(prev => prev.filter(sl => sl.id !== id))
  }, [])

  // Restore an archived setlist
  const restoreArchived = useCallback((id: string) => {
    updateSetlist(id, { isArchived: false })
  }, [updateSetlist])

  // Restore a setlist from trash
  const restoreFromTrash = useCallback((trashId: string) => {
    const trashItem = trash.find(t => t.id === trashId)
    if (!trashItem) return

    setSetlists(prev => [...prev, trashItem.setlist])
    setTrash(prev => prev.filter(t => t.id !== trashId))
  }, [trash])

  // Permanently delete from trash
  const permanentlyDeleteFromTrash = useCallback((trashId: string) => {
    setTrash(prev => prev.filter(t => t.id !== trashId))
  }, [])

  // Empty trash
  const emptyTrash = useCallback(() => {
    setTrash([])
  }, [])

  // Reorder songs in a setlist
  const reorderSongs = useCallback((setlistId: string, songs: Song[]) => {
    updateSetlist(setlistId, { 
      songs: songs.map((s, idx) => ({ ...s, position: idx + 1 }))
    })
  }, [updateSetlist])

  return {
    setlists,
    trash,
    saveStatus,
    isLoaded,
    addSetlist,
    updateSetlist,
    deleteSetlist,
    archiveSetlist,
    permanentlyDeleteArchived,
    restoreArchived,
    restoreFromTrash,
    permanentlyDeleteFromTrash,
    emptyTrash,
    reorderSongs,
  }
}
