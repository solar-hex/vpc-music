'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronRight, 
  Music2, 
  PencilIcon, 
  Printer, 
  Share2, 
  Bookmark,
  Home,
  MoreVertical,
  X,
  Bookmark as BookmarkIcon,
  Mail,
  Copy,
  FileText,
  Star,
  Tag,
  StickyNote,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDisplayChordNotation } from '@/lib/use-display-chord-notation'

// Mock data - replace with actual data fetching
const SONGS = [
  {
    id: '1',
    title: 'Way Maker',
    artist: 'Sinach',
    key: 'D',
    bpm: 68,
    genre: 'Contemporary Worship',
    sections: [
      {
        label: 'Verse 1',
        lines: ['D                    A', 'You are here moving in our midst', 'Bm                   G', 'I worship You I worship You'],
      },
      {
        label: 'Chorus',
        lines: ['D                 A', 'Way maker miracle worker', 'Bm                G', 'Promise keeper light in the darkness'],
      },
      {
        label: 'Intro Melody',
        type: 'staff',
        content: 'D2 F2 A2 d2 | f4 e4 | d2 c2 B2 A2 | G4 F4 | E2 D2 E2 F2 | A4 G4 | F2 E2 D2 C2 | D8 |',
      },
      {
        label: 'Chorus Harmony',
        type: 'staff',
        content: '[D2F2A2] [E2G2B2] | [F2A2c2]4 | [G2B2d2]2 [A2c2e2]2 | [D2F2A2]8 |: D4 A4 | d2 c2 B2 A2 | G4 E4 | D8 :|',
      },
    ],
  },
  {
    id: '2',
    title: 'Good Good Father',
    artist: 'Chris Tomlin',
    key: 'G',
    bpm: 72,
    genre: 'Contemporary',
    sections: [
      {
        label: 'Verse 1',
        lines: ['G                 D', 'I have heard a thousand stories', 'Em                C', 'Of what they think You are like'],
      },
    ],
  },
]

// Sticky Note Component
function StickyNoteComponent({
  note,
  onUpdate,
  onDelete,
  onDetach,
  sections,
  isFloating = false,
  isCompact = false,
}: {
  note: {
    id: number
    text: string
    position: { x: number; y: number }
    snapTo: string | null
    snapPosition: 'floating' | 'top' | 'bottom' | 'right'
    isExpanded: boolean
  }
  onUpdate: (updates: Partial<typeof note>) => void
  onDelete: () => void
  onDetach: () => void
  sections: string[]
  isFloating?: boolean
  isCompact?: boolean
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [showSnapMenu, setShowSnapMenu] = useState(false)
  const noteRef = useRef<HTMLDivElement>(null)

  const handleDragEnd = (event: any, info: any) => {
    setIsDragging(false)
    if (isFloating) {
      onUpdate({ position: { x: info.point.x - 100, y: info.point.y - 50 } })
    }
  }

  return (
    <motion.div
      ref={noteRef}
      drag={isFloating}
      dragMomentum={false}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      initial={isFloating ? { x: note.position.x, y: note.position.y } : { opacity: 0, scale: 0.9 }}
      animate={isFloating ? { x: note.position.x, y: note.position.y } : { opacity: 1, scale: 1 }}
      className={cn(
        'bg-amber-100 rounded-lg shadow-lg border border-amber-300 overflow-hidden',
        isFloating && 'fixed z-40 cursor-move',
        isDragging && 'shadow-2xl scale-105',
        isCompact ? 'w-full' : note.isExpanded ? 'min-w-[300px] max-w-[400px]' : 'min-w-[200px] max-w-[280px]',
        !isFloating && 'mt-2 mb-2'
      )}
      style={isFloating ? { position: 'fixed' } : {}}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-amber-200/50 border-b border-amber-300/50">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-amber-700" />
          <span className="text-xs font-medium text-amber-800">Sticky Note</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Snap Menu */}
          <div className="relative">
            <button
              onClick={() => setShowSnapMenu(!showSnapMenu)}
              className="p-1 rounded hover:bg-amber-300/50 text-amber-700 transition-colors"
              title="Snap to section"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
            <AnimatePresence>
              {showSnapMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50 min-w-[180px]"
                >
                  <div className="px-2 py-1 text-xs text-slate-500 font-medium">Snap to Section</div>
                  {sections.map((sectionId, idx) => (
                    <div key={sectionId} className="px-1">
                      <div className="text-xs text-slate-400 px-2 py-1">Section {idx + 1}</div>
                      <button
                        onClick={() => { onUpdate({ snapTo: sectionId, snapPosition: 'top' }); setShowSnapMenu(false) }}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-slate-700 hover:bg-amber-50 rounded"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        Top
                      </button>
                      <button
                        onClick={() => { onUpdate({ snapTo: sectionId, snapPosition: 'right' }); setShowSnapMenu(false) }}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-slate-700 hover:bg-amber-50 rounded"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Right
                      </button>
                      <button
                        onClick={() => { onUpdate({ snapTo: sectionId, snapPosition: 'bottom' }); setShowSnapMenu(false) }}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-slate-700 hover:bg-amber-50 rounded"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Bottom
                      </button>
                    </div>
                  ))}
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={() => { onUpdate({ snapTo: null, snapPosition: 'floating' }); setShowSnapMenu(false) }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-slate-700 hover:bg-amber-50 rounded"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                      Float (Drag freely)
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Expand/Collapse */}
          <button
            onClick={() => onUpdate({ isExpanded: !note.isExpanded })}
            className="p-1 rounded hover:bg-amber-300/50 text-amber-700 transition-colors"
            title={note.isExpanded ? 'Collapse' : 'Expand'}
          >
            {note.isExpanded ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
          
          {/* Detach (if snapped) */}
          {note.snapTo && (
            <button
              onClick={onDetach}
              className="p-1 rounded hover:bg-amber-300/50 text-amber-700 transition-colors"
              title="Detach from section"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </button>
          )}
          
          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-200 text-amber-700 hover:text-red-600 transition-colors"
            title="Delete note"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className={cn('p-3', note.isExpanded ? 'min-h-[150px]' : 'min-h-[60px]')}>
        <textarea
          value={note.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder="Add your note..."
          className={cn(
            'w-full bg-transparent text-amber-900 placeholder:text-amber-400 resize-none focus:outline-none text-sm',
            note.isExpanded ? 'min-h-[130px]' : 'min-h-[40px]'
          )}
        />
      </div>
    </motion.div>
  )
}

// Expanded Staff Modal Component
function ExpandedStaffModal({
  section,
  song,
  onClose,
}: {
  section: { label: string; content: string }
  song: { title?: string; artist?: string; key?: string; bpm?: string } | null
  onClose: () => void
}) {
  const staffId = `expanded-staff-${section.label.replace(/\s+/g, '-')}`

  useEffect(() => {
    const renderStaff = async () => {
      try {
        const abcjs = await import('abcjs')
        const fullABC = [
          'X:1',
          'M:4/4',
          'L:1/8',
          `K:${song?.key || 'C'}`,
          section.content || 'x8 |'
        ].join('\n')
        abcjs.default.renderAbc(staffId, fullABC, {
          responsive: 'resize',
          staffwidth: 800,
          scale: 1.2,
          paddingtop: 20,
          paddingbottom: 20,
        })
      } catch (err) {
        console.error('Error rendering expanded staff:', err)
      }
    }
    
    const timeoutId = setTimeout(renderStaff, 50)
    return () => clearTimeout(timeoutId)
  }, [section.content, song?.key, staffId])

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed z-50 inset-4 md:inset-8 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 text-xs font-medium bg-purple-900/50 text-purple-300 rounded border border-purple-700/50">
              Staff Notation
            </span>
            <h2 className="text-lg font-semibold text-white">{section.label}</h2>
          </div>
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <X className="h-5 w-5 text-slate-300" />
          </motion.button>
        </div>

        {/* Staff Content - Scrollable */}
        <div className="flex-1 overflow-auto p-6 bg-white/5">
          <div className="w-full max-w-4xl mx-auto">
            <div id={staffId} className="w-full min-h-[200px]" />
          </div>
        </div>

        {/* Footer with song info */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/30">
          <div className="flex items-center justify-center gap-6 text-sm text-slate-400">
            {song?.key && (
              <span>Key: <span className="text-[#C09060] font-medium">{song.key}</span></span>
            )}
            {song?.bpm && (
              <span>Tempo: <span className="text-slate-300">{song.bpm} BPM</span></span>
            )}
            <span>Time: <span className="text-slate-300">4/4</span></span>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// Staff Section Preview Component (for view mode)
function StaffSectionPreview({
  idx,
  section,
  songKey,
  onExpand,
}: {
  idx: number
  section: { label: string; content: string }
  songKey: string
  onExpand: () => void
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const staffId = `staff-preview-${idx}-${section.label.replace(/\s+/g, '-')}`

  useEffect(() => {
    if (isCollapsed) return
    
    const renderStaff = async () => {
      try {
        const abcjs = await import('abcjs')
        const fullABC = [
          'X:1',
          'M:4/4',
          'L:1/8',
          `K:${songKey}`,
          section.content || 'x8 |'
        ].join('\n')
        abcjs.default.renderAbc(staffId, fullABC, {
          responsive: 'resize',
          staffwidth: 600,
          scale: 0.8,
          paddingtop: 10,
          paddingbottom: 10,
        })
      } catch (err) {
        console.error('Error rendering staff preview:', err)
      }
    }
    
    const timeoutId = setTimeout(renderStaff, 50)
    return () => clearTimeout(timeoutId)
  }, [section.content, songKey, staffId, isCollapsed])

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="bg-slate-800/20 rounded-xl p-4 border border-purple-700/30 transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-medium bg-purple-900/50 text-purple-300 rounded border border-purple-700/50">
            Staff
          </span>
          <h2 className="text-sm md:text-base font-bold text-[#C09060] uppercase tracking-wider">
            {section.label}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Collapse/Expand Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsCollapsed(!isCollapsed)
            }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700/50"
          >
            <svg 
              className={cn("w-4 h-4 transition-transform", isCollapsed ? "" : "rotate-180")} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {isCollapsed ? 'Show' : 'Hide'}
          </button>
          {/* Expand to Modal */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onExpand()
            }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700/50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Expand
          </button>
        </div>
      </div>
      {/* Staff Preview - Full height, collapsible */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-white/5 rounded-lg p-3">
              <div id={staffId} className="w-full" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

// Staff Notation Editor Component
function StaffNotationEditor({
  section,
  songMeta,
  onContentChange,
  onFocus,
  onBlur,
}: {
  section: { id: string; label: string; content: string; type: 'lyrics' | 'staff' }
  songMeta: { title: string; artist: string; key: string; tempo: string; timeSignature: string }
  onContentChange: (content: string) => void
  onFocus: () => void
  onBlur: () => void
}) {
  const [editorMode, setEditorMode] = useState<'visual' | 'abc'>('visual')
  const [showHelpPopup, setShowHelpPopup] = useState(false)
  const [selectedDuration, setSelectedDuration] = useState<string>('2') // quarter note default
  const [isRestMode, setIsRestMode] = useState(false)
  const [hoverNote, setHoverNote] = useState<{ note: string; x: number; y: number } | null>(null)

  // Note durations
  const durations = [
    { value: '8', label: 'Whole', symbol: '𝅝' },
    { value: '4', label: 'Half', symbol: '𝅗𝅥' },
    { value: '2', label: 'Quarter', symbol: '♩' },
    { value: '', label: 'Eighth', symbol: '♪' },
    { value: '/2', label: '16th', symbol: '𝅘𝅥𝅯' },
  ]

  // Staff line to note mapping (treble clef)
  const trebleNotes = ['e\'', 'd\'', 'c\'', 'b', 'a', 'g', 'f', 'e', 'd', 'c', 'B', 'A', 'G']
  // Staff line to note mapping (bass clef)  
  const bassNotes = ['g', 'f', 'e', 'd', 'c', 'B', 'A', 'G', 'F', 'E', 'D', 'C', 'B,']

  // Check if content has treble or bass clef
  const hasTrebleClef = !section.content.includes('K:bass') && !section.content.startsWith('%%staves')
  const hasBassClef = section.content.includes('K:bass') || section.content.includes('clef=bass')

  // Generate ABC for treble clef staff
  const generateTrebleABC = (notesOnly: string) => {
    // Filter out bass clef content if mixed
    const trebleContent = notesOnly.replace(/%%staves.*\n?/g, '').replace(/V:2.*\n?/g, '').replace(/\[K:bass\].*?\[K:treble\]/g, '')
    return `X:1\nM:${songMeta.timeSignature || '4/4'}\nL:1/8\nK:${songMeta.key || 'C'} clef=treble\n${trebleContent || 'x8 |'}`
  }

  // Generate ABC for bass clef staff
  const generateBassABC = () => {
    return `X:1\nM:${songMeta.timeSignature || '4/4'}\nL:1/8\nK:${songMeta.key || 'C'} clef=bass\nx8 |`
  }

  // Render staffs using unique IDs to avoid React DOM conflicts
  const trebleId = `treble-${section.id}`
  const bassId = `bass-${section.id}`
  const previewId = `preview-${section.id}`

  useEffect(() => {
    let mounted = true
    
    const renderStaffs = async () => {
      try {
        const abcjs = await import('abcjs')
        
        if (!mounted) return
        
        // Render treble clef using ID selector
        const trebleABC = generateTrebleABC(section.content)
        abcjs.default.renderAbc(trebleId, trebleABC, {
          responsive: 'resize',
          staffwidth: 550,
          scale: 1,
          add_classes: true,
          paddingtop: 10,
          paddingbottom: 10,
        })
        
        // Render bass clef using ID selector
        const bassABC = generateBassABC()
        abcjs.default.renderAbc(bassId, bassABC, {
          responsive: 'resize',
          staffwidth: 550,
          scale: 1,
          add_classes: true,
          paddingtop: 10,
          paddingbottom: 10,
        })
        
        // Also render preview staff if in ABC mode
        if (editorMode === 'abc') {
          const fullABC = `X:1\nM:${songMeta.timeSignature || '4/4'}\nL:1/8\nK:${songMeta.key || 'C'}\n${section.content || 'x8 |'}`
          abcjs.default.renderAbc(previewId, fullABC, {
            responsive: 'resize',
            staffwidth: 550,
            scale: 1,
          })
        }
      } catch (err) {
        console.error('Error rendering ABC notation:', err)
      }
    }
    
    // Small delay to ensure DOM elements exist
    const timeoutId = setTimeout(renderStaffs, 50)
    
    return () => {
      mounted = false
      clearTimeout(timeoutId)
    }
  }, [section.id, section.content, songMeta, editorMode, trebleId, bassId, previewId])

  // Handle click on staff to add note
  const handleStaffClick = (e: React.MouseEvent<HTMLDivElement>, clef: 'treble' | 'bass') => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const staffHeight = rect.height
    
    // Calculate which note based on vertical position
    const notes = clef === 'treble' ? trebleNotes : bassNotes
    const noteIndex = Math.floor((y / staffHeight) * notes.length)
    const clampedIndex = Math.max(0, Math.min(notes.length - 1, noteIndex))
    const note = notes[clampedIndex]
    
    // Build the note or rest string
    let noteStr: string
    if (isRestMode) {
      noteStr = `z${selectedDuration}`
    } else {
      noteStr = `${note}${selectedDuration}`
    }
    
    // Append to content
    const newContent = section.content ? `${section.content} ${noteStr}` : noteStr
    onContentChange(newContent)
  }

  // Handle mouse move for hover preview
  const handleStaffHover = (e: React.MouseEvent<HTMLDivElement>, clef: 'treble' | 'bass') => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const x = e.clientX - rect.left
    const staffHeight = rect.height
    
    const notes = clef === 'treble' ? trebleNotes : bassNotes
    const noteIndex = Math.floor((y / staffHeight) * notes.length)
    const clampedIndex = Math.max(0, Math.min(notes.length - 1, noteIndex))
    const note = notes[clampedIndex]
    
    setHoverNote({ note: isRestMode ? 'rest' : note, x, y })
  }

  return (
    <div className="p-4 space-y-3">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-slate-700/30 rounded-lg p-0.5">
          <button
            onClick={() => setEditorMode('visual')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded transition-colors',
              editorMode === 'visual' ? 'bg-[#C09060] text-white' : 'text-slate-400 hover:text-slate-300'
            )}
          >
            Staff Editor
          </button>
          <button
            onClick={() => setEditorMode('abc')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded transition-colors',
              editorMode === 'abc' ? 'bg-[#C09060] text-white' : 'text-slate-400 hover:text-slate-300'
            )}
          >
            ABC Notation
          </button>
        </div>
      </div>

      {editorMode === 'visual' ? (
        <>
          {/* Note Duration & Rest Toggle */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Note/Rest Toggle */}
              <div className="flex items-center bg-slate-700/50 rounded-lg p-0.5">
                <button
                  onClick={() => setIsRestMode(false)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5',
                    !isRestMode ? 'bg-[#C09060] text-white' : 'text-slate-400 hover:text-slate-300'
                  )}
                >
                  <span className="text-base">♩</span>
                  Note
                </button>
                <button
                  onClick={() => setIsRestMode(true)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5',
                    isRestMode ? 'bg-[#C09060] text-white' : 'text-slate-400 hover:text-slate-300'
                  )}
                >
                  <span className="text-base">𝄽</span>
                  Rest
                </button>
              </div>

              {/* Duration Selection */}
              <div className="flex items-center gap-1">
                {durations.map((dur) => (
                  <button
                    key={dur.value}
                    onClick={() => setSelectedDuration(dur.value)}
                    className={cn(
                      'flex flex-col items-center px-2.5 py-1.5 rounded-lg border transition-all min-w-[45px]',
                      selectedDuration === dur.value
                        ? 'bg-[#C09060] border-[#C09060] text-white'
                        : 'bg-slate-700/50 border-slate-600/50 text-slate-400 hover:border-slate-500'
                    )}
                    title={dur.label}
                  >
                    <span className="text-lg leading-none">{dur.symbol}</span>
                    <span className="text-[9px] mt-0.5">{dur.label}</span>
                  </button>
                ))}
              </div>

              {/* Bar line button */}
              <button
                onClick={() => {
                  const newContent = section.content ? `${section.content} |` : '|'
                  onContentChange(newContent)
                }}
                className="flex flex-col items-center px-2.5 py-1.5 rounded-lg border bg-slate-700/50 border-slate-600/50 text-slate-400 hover:border-slate-500 transition-all min-w-[45px]"
                title="Add bar line"
              >
                <span className="text-lg leading-none font-bold">|</span>
                <span className="text-[9px] mt-0.5">Bar</span>
              </button>
            </div>
          </div>

          {/* Treble Clef Staff */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Treble Clef</span>
              <span className="text-[10px] text-slate-600">Click on staff to place {isRestMode ? 'rest' : 'note'}</span>
            </div>
            <div 
              onClick={(e) => handleStaffClick(e, 'treble')}
              onMouseMove={(e) => handleStaffHover(e, 'treble')}
              onMouseLeave={() => setHoverNote(null)}
              className="bg-white/5 rounded-lg p-4 border border-slate-700/30 min-h-[100px] cursor-crosshair relative overflow-hidden"
            >
              <div id={trebleId} className="w-full" />
              {/* Hover indicator */}
              {hoverNote && (
                <div 
                  className="absolute pointer-events-none bg-[#C09060]/30 rounded-full w-4 h-4 -translate-x-1/2 -translate-y-1/2 border-2 border-[#C09060]"
                  style={{ left: hoverNote.x, top: hoverNote.y }}
                />
              )}
            </div>
          </div>

          {/* Bass Clef Staff */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Bass Clef</span>
              <span className="text-[10px] text-slate-600">Click on staff to place {isRestMode ? 'rest' : 'note'}</span>
            </div>
            <div 
              onClick={(e) => handleStaffClick(e, 'bass')}
              onMouseMove={(e) => handleStaffHover(e, 'bass')}
              onMouseLeave={() => setHoverNote(null)}
              className="bg-white/5 rounded-lg p-4 border border-slate-700/30 min-h-[100px] cursor-crosshair relative overflow-hidden"
            >
              <div id={bassId} className="w-full" />
              {/* Hover indicator */}
              {hoverNote && (
                <div 
                  className="absolute pointer-events-none bg-[#C09060]/30 rounded-full w-4 h-4 -translate-x-1/2 -translate-y-1/2 border-2 border-[#C09060]"
                  style={{ left: hoverNote.x, top: hoverNote.y }}
                />
              )}
            </div>
          </div>

          {/* Clear button */}
          {section.content && (
            <div className="flex justify-end">
              <button
                onClick={() => onContentChange('')}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Clear all notes
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* ABC Text Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Notes only (header auto-generated from song info)</span>
              <button 
                onClick={() => setShowHelpPopup(true)}
                className="text-xs text-[#C09060] hover:text-[#D4A574] flex items-center gap-1 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ABC Help
              </button>
            </div>
            <textarea
              value={section.content}
              onChange={(e) => onContentChange(e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              placeholder="C D E F | G4 A4 | B c d e |"
              className="w-full min-h-[80px] bg-slate-900/50 border border-slate-600/50 rounded-lg p-3 text-slate-100 font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-[#C09060] placeholder:text-slate-600"
              spellCheck={false}
            />
            
            {/* Quick Insert */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '|:', insert: '|: ' },
                { label: ':|', insert: ' :|' },
                { label: '|', insert: ' | ' },
                { label: 'z', insert: 'z ' },
                { label: 'z2', insert: 'z2 ' },
                { label: '[CEG]', insert: '[CEG] ' },
                { label: '(3', insert: '(3' },
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={() => onContentChange(section.content + btn.insert)}
                  className="px-2 py-1 text-xs font-mono bg-slate-700/40 hover:bg-slate-600 text-slate-400 rounded border border-slate-600/30 transition-colors"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white/5 rounded-lg p-4 border border-slate-700/30">
            <span className="text-xs text-slate-500 block mb-2">Preview</span>
            <div id={previewId} className="w-full min-h-[80px]" />
          </div>
        </>
      )}

      {/* ABC Help Popup */}
      <AnimatePresence>
        {showHelpPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowHelpPopup(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">ABC Notation Reference</h3>
                <button
                  onClick={() => setShowHelpPopup(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Notes Section */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-[#C09060]">Notes</h4>
                  <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-sm">
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      <div><span className="text-slate-500">C D E F G A B</span> - Lower octave</div>
                      <div><span className="text-slate-500">c d e f g a b</span> - Higher octave</div>
                      <div><span className="text-slate-500">C, D, E,</span> - Even lower</div>
                      <div><span className="text-slate-500">{"c' d' e'"}</span> - Even higher</div>
                    </div>
                  </div>
                </div>

                {/* Durations Section */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-[#C09060]">Note Durations</h4>
                  <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-sm">
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      <div><span className="text-slate-500">C8</span> - Whole note</div>
                      <div><span className="text-slate-500">C4</span> - Half note</div>
                      <div><span className="text-slate-500">C2</span> - Quarter note</div>
                      <div><span className="text-slate-500">C</span> - Eighth note</div>
                      <div><span className="text-slate-500">C/2</span> - Sixteenth note</div>
                      <div><span className="text-slate-500">C3</span> - Dotted quarter</div>
                    </div>
                  </div>
                </div>

                {/* Rests & Bars */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-[#C09060]">Rests & Bar Lines</h4>
                  <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-sm">
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      <div><span className="text-slate-500">z</span> - Eighth rest</div>
                      <div><span className="text-slate-500">z2</span> - Quarter rest</div>
                      <div><span className="text-slate-500">|</span> - Bar line</div>
                      <div><span className="text-slate-500">|:</span> - Repeat start</div>
                      <div><span className="text-slate-500">:|</span> - Repeat end</div>
                      <div><span className="text-slate-500">|]</span> - Final bar</div>
                    </div>
                  </div>
                </div>

                {/* Chords & Ties */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-[#C09060]">Chords & Special</h4>
                  <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-sm">
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      <div><span className="text-slate-500">[CEG]</span> - Chord</div>
                      <div><span className="text-slate-500">(3CDE</span> - Triplet</div>
                      <div><span className="text-slate-500">C-C</span> - Tie</div>
                      <div><span className="text-slate-500">^C</span> - Sharp</div>
                      <div><span className="text-slate-500">_C</span> - Flat</div>
                      <div><span className="text-slate-500">=C</span> - Natural</div>
                    </div>
                  </div>
                </div>

                {/* Template */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-[#C09060]">Example Templates</h4>
                  <div className="space-y-2">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500">Simple Scale</span>
                        <button
                          onClick={() => {
                            onContentChange('C D E F | G A B c |')
                            setShowHelpPopup(false)
                          }}
                          className="text-xs px-2 py-1 bg-[#C09060] hover:bg-[#D4A574] text-white rounded transition-colors"
                        >
                          Use
                        </button>
                      </div>
                      <code className="text-sm text-slate-300 font-mono">C D E F | G A B c |</code>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500">With Chords</span>
                        <button
                          onClick={() => {
                            onContentChange('[CEG]4 [FAc]4 | [GBd]4 [CEG]4 |')
                            setShowHelpPopup(false)
                          }}
                          className="text-xs px-2 py-1 bg-[#C09060] hover:bg-[#D4A574] text-white rounded transition-colors"
                        >
                          Use
                        </button>
                      </div>
                      <code className="text-sm text-slate-300 font-mono">[CEG]4 [FAc]4 | [GBd]4 [CEG]4 |</code>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500">With Repeats</span>
                        <button
                          onClick={() => {
                            onContentChange('|: C2 D2 E2 F2 | G4 G4 :|')
                            setShowHelpPopup(false)
                          }}
                          className="text-xs px-2 py-1 bg-[#C09060] hover:bg-[#D4A574] text-white rounded transition-colors"
                        >
                          Use
                        </button>
                      </div>
                      <code className="text-sm text-slate-300 font-mono">|: C2 D2 E2 F2 | G4 G4 :|</code>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function SongLyricsPage() {
  const params = useParams()
  const router = useRouter()
  const songId = params.id as string

  const [song, setSong] = useState<any>(null)
  const [transposition, setTransposition] = useState(0)
  const [showABC, setShowABC] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showInstrument, setShowInstrument] = useState(false)
  const [showChords, setShowChords] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const [metaExpanded, setMetaExpanded] = useState(false)
  const [editSongMeta, setEditSongMeta] = useState({
    title: '',
    artist: '',
    key: '',
    tempo: '',
    timeSignature: '4/4',
    capo: '',
    tags: [] as string[],
  })
  const [editSections, setEditSections] = useState<Array<{
    id: string
    label: string
    content: string
    type: 'lyrics' | 'staff'
  }>>([])
  const [draggedSection, setDraggedSection] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [showActionsModal, setShowActionsModal] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [songNotes, setSongNotes] = useState<Array<{
    id: number
    text: string
    position: { x: number; y: number }
    snapTo: string | null
    snapPosition: 'floating' | 'top' | 'bottom' | 'right'
    isExpanded: boolean
  }>>([])
  const [expandedStaffSection, setExpandedStaffSection] = useState<{
    label: string
    content: string
  } | null>(null)
  const [sectionToDelete, setSectionToDelete] = useState<{
    id: string
    label: string
    type: 'lyrics' | 'staff'
  } | null>(null)

  const abcContainerRef = useRef<HTMLDivElement>(null)
  const { displayChord } = useDisplayChordNotation()

  // Load song
  useEffect(() => {
    const foundSong = SONGS.find((s) => s.id === songId)
    if (foundSong) {
      setSong(foundSong)
      // Initialize song metadata
      setEditSongMeta({
        title: foundSong.title || '',
        artist: foundSong.artist || '',
        key: foundSong.key || '',
        tempo: foundSong.bpm?.toString() || '',
        timeSignature: '4/4',
        capo: '',
        tags: foundSong.tags || [],
      })
      // Initialize edit sections from song data - preserve type and handle both lyrics and staff
      const sections = foundSong.sections?.map((section: any, idx: number) => {
        // Check if this is a staff section
        if (section.type === 'staff') {
          return {
            id: `section-${idx}`,
            label: section.label,
            type: 'staff' as const,
            content: section.content || ''
          }
        }
        
        // Otherwise it's a lyrics section - convert to ChordPro inline format
        return {
          id: `section-${idx}`,
          label: section.label,
          type: 'lyrics' as const,
          // Convert to ChordPro format: merge chord lines with lyric lines
          content: section.lines?.map((line: any) => {
            if (typeof line === 'string') return line
            // If line has chords and lyrics, merge them inline
            if (line.chords && line.lyrics) {
              let result = ''
              let chordIdx = 0
              const chords = line.chords.split(/\s+/).filter(Boolean)
              const words = line.lyrics.split(' ')
              words.forEach((word: string, i: number) => {
                if (chords[chordIdx] && i % 2 === 0) {
                  result += `[${chords[chordIdx]}]${word} `
                  chordIdx++
                } else {
                  result += word + ' '
                }
              })
              return result.trim()
            }
            return line.lyrics || line
          }).join('\n') || ''
        }
      }) || []
      setEditSections(sections)
    } else {
      router.push('/songs')
    }
  }, [songId, router])

  // Render ABC notation
  useEffect(() => {
    if (showABC && abcContainerRef.current && song) {
      const renderABC = async () => {
        try {
          const abcjs = await import('abcjs')
          let abc = `X:1\nT:${song.title}\nC:${song.artist}\nM:4/4\nL:1/8\nK:${song.key || 'C'}\n\n`
          song.sections?.forEach((section: any) => {
            abc += `% ${section.label}\n`
            section.lines?.forEach((line: string) => {
              if (line.trim()) abc += `w:${line.replace(/\[|\]/g, '')}\n`
            })
          })
          abcContainerRef.current!.innerHTML = ''
          abcjs.default.renderAbc('abc-container', abc, {
            responsive: 'resize',
            staffwidth: 800,
          })
        } catch (error) {
          console.error('Error rendering ABC:', error)
        }
      }
      renderABC()
    }
  }, [showABC, song])

  const transposedKey = song?.key ? displayChord(song.key, transposition) : null

  if (!song) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Compressed Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-lg"
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Left: Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-sm min-w-0" aria-label="Breadcrumb">
            <Link 
              href="/dashboard" 
              className="flex items-center text-slate-400 hover:text-white transition-colors flex-shrink-0"
            >
              <Home className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-600 flex-shrink-0" />
            <Link 
              href="/songs" 
              className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
            >
              Songs
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-600 flex-shrink-0" />
            <span className="text-white font-medium truncate">{song.title}</span>
          </nav>

          {/* Center: Song Info */}
          <div className="hidden md:flex items-center gap-4 text-sm text-slate-400">
            <span className="text-slate-300 font-medium">{song.artist}</span>
            <span className="text-slate-600">|</span>
            <span>Key: <span className="text-[#C09060] font-semibold">{transposedKey}</span></span>
            {song.bpm && <><span className="text-slate-600">|</span><span>BPM: {song.bpm}</span></>}
          </div>

          {/* Right: Transpose + Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Quick Transpose */}
            <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg px-2 py-1">
              <motion.button
                onClick={() => setTransposition(Math.max(transposition - 1, -12))}
                disabled={transposition <= -12}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-1 disabled:opacity-40"
              >
                <ChevronDown className="h-4 w-4 text-slate-300" />
              </motion.button>
              <span className="w-8 text-center text-sm font-semibold text-[#C09060]">
                {transposition > 0 ? '+' : ''}{transposition}
              </span>
              <motion.button
                onClick={() => setTransposition(Math.min(transposition + 1, 12))}
                disabled={transposition >= 12}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-1 disabled:opacity-40"
              >
                <ChevronUp className="h-4 w-4 text-slate-300" />
              </motion.button>
            </div>

            {/* Ellipsis Menu Button */}
            <motion.button
              onClick={() => setShowActionsModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <MoreVertical className="h-5 w-5" />
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main Lyrics Content - Full Width */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {showABC ? (
            <motion.div
              key="abc-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-slate-800/30 rounded-xl p-6 md:p-8 border border-slate-600/20"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-300">Music Notation (ABC)</h2>
                <motion.button
                  onClick={() => setShowABC(false)}
                  whileHover={{ scale: 1.05 }}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  Close
                </motion.button>
              </div>
              <div ref={abcContainerRef} id="abc-container" className="flex justify-center [&>svg]:max-w-full" />
            </motion.div>
          ) : isEditMode ? (
            <motion.div
              key="edit-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Collapsible Song Info */}
              <motion.div 
                className="bg-slate-800/50 rounded-xl border border-slate-600/30 overflow-hidden"
                layout
              >
                {/* Collapsed Header / Toggle */}
                <button
                  onClick={() => setMetaExpanded(!metaExpanded)}
                  className="w-full p-3 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: metaExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </motion.div>
                      <span className="text-sm font-medium text-slate-300">Song Info</span>
                    </div>
                    {!metaExpanded && (
                      <div className="flex items-center gap-3 text-xs text-slate-500 truncate">
                        <span className="text-white font-medium truncate max-w-[150px]">{editSongMeta.title || 'Untitled'}</span>
                        <span className="hidden sm:inline">by {editSongMeta.artist || 'Unknown'}</span>
                        {editSongMeta.key && (
                          <span className="px-1.5 py-0.5 bg-slate-700/50 rounded text-[#C09060]">Key: {editSongMeta.key}</span>
                        )}
                        {editSongMeta.tempo && (
                          <span className="px-1.5 py-0.5 bg-slate-700/50 rounded">{editSongMeta.tempo} BPM</span>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-slate-500 transition-transform",
                    metaExpanded && "rotate-180"
                  )} />
                </button>

                {/* Expanded Form */}
                <AnimatePresence>
                  {metaExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-slate-700/50"
                    >
                      <div className="p-4 space-y-4">
                        {/* Row 1: Title & Artist */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-500 font-medium">Song Title</label>
                            <input
                              type="text"
                              value={editSongMeta.title}
                              onChange={(e) => setEditSongMeta({ ...editSongMeta, title: e.target.value })}
                              className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C09060]"
                              placeholder="Enter song title"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-500 font-medium">Artist</label>
                            <input
                              type="text"
                              value={editSongMeta.artist}
                              onChange={(e) => setEditSongMeta({ ...editSongMeta, artist: e.target.value })}
                              className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C09060]"
                              placeholder="Enter artist name"
                            />
                          </div>
                        </div>

                        {/* Row 2: Key, Tempo, Time Signature, Capo */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-500 font-medium">Key</label>
                            <select
                              value={editSongMeta.key}
                              onChange={(e) => setEditSongMeta({ ...editSongMeta, key: e.target.value })}
                              className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C09060]"
                            >
                              <option value="">Select key</option>
                              {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
                                'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'].map(k => (
                                <option key={k} value={k}>{k}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-500 font-medium">Tempo (BPM)</label>
                            <input
                              type="number"
                              value={editSongMeta.tempo}
                              onChange={(e) => setEditSongMeta({ ...editSongMeta, tempo: e.target.value })}
                              className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C09060]"
                              placeholder="120"
                              min="40"
                              max="240"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-500 font-medium">Time Signature</label>
                            <select
                              value={editSongMeta.timeSignature}
                              onChange={(e) => setEditSongMeta({ ...editSongMeta, timeSignature: e.target.value })}
                              className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C09060]"
                            >
                              {['4/4', '3/4', '6/8', '2/4', '12/8', '5/4', '7/8'].map(ts => (
                                <option key={ts} value={ts}>{ts}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-500 font-medium">Capo</label>
                            <select
                              value={editSongMeta.capo}
                              onChange={(e) => setEditSongMeta({ ...editSongMeta, capo: e.target.value })}
                              className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C09060]"
                            >
                              <option value="">No capo</option>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(c => (
                                <option key={c} value={c}>Fret {c}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Edit Header */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-600/30 sticky top-0 z-10 backdrop-blur-sm">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-white">Edit Song</h2>
                    <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded">ChordPro Format</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button
                      onClick={() => setIsEditMode(false)}
                      whileHover={{ scale: 1.02 }}
                      className="px-3 py-1.5 rounded-lg bg-slate-700/40 hover:bg-slate-700/60 text-slate-300 text-sm font-medium"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      onClick={() => setIsEditMode(false)}
                      whileHover={{ scale: 1.02 }}
                      className="px-3 py-1.5 rounded-lg bg-[#C09060] hover:bg-[#B8860B] text-white text-sm font-medium"
                    >
                      Save Changes
                    </motion.button>
                  </div>
                </div>

                {/* ChordPro Quick Insert Toolbar */}
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-xs text-slate-500 mb-2">Quick Insert (ChordPro)</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '[C]', title: 'C Major', insert: '[C]' },
                      { label: '[G]', title: 'G Major', insert: '[G]' },
                      { label: '[Am]', title: 'A Minor', insert: '[Am]' },
                      { label: '[F]', title: 'F Major', insert: '[F]' },
                      { label: '[D]', title: 'D Major', insert: '[D]' },
                      { label: '[Em]', title: 'E Minor', insert: '[Em]' },
                      { label: '[Dm]', title: 'D Minor', insert: '[Dm]' },
                      { label: '[E]', title: 'E Major', insert: '[E]' },
                      { label: '[A]', title: 'A Major', insert: '[A]' },
                      { label: '[Bm]', title: 'B Minor', insert: '[Bm]' },
                      { label: '|', title: 'Bar line', insert: ' | ' },
                    ].map((btn) => (
                      <motion.button
                        key={btn.label}
                        title={btn.title}
                        onClick={() => {
                          if (activeSection) {
                            setEditSections(sections => sections.map(s => 
                              s.id === activeSection 
                                ? { ...s, content: s.content + btn.insert }
                                : s
                            ))
                          }
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-2 py-1 text-xs font-mono bg-slate-700/60 hover:bg-slate-600 text-slate-300 rounded border border-slate-600/50 transition-colors"
                      >
                        {btn.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-3">
                {editSections.map((section, idx) => (
                  <motion.div
                    key={section.id}
                    layout
                    draggable
                    onDragStart={() => setDraggedSection(section.id)}
                    onDragEnd={() => setDraggedSection(null)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (draggedSection && draggedSection !== section.id) {
                        const dragIdx = editSections.findIndex(s => s.id === draggedSection)
                        const hoverIdx = idx
                        if (dragIdx !== hoverIdx) {
                          const newSections = [...editSections]
                          const [removed] = newSections.splice(dragIdx, 1)
                          newSections.splice(hoverIdx, 0, removed)
                          setEditSections(newSections)
                        }
                      }
                    }}
                    className={cn(
                      'bg-slate-800/30 rounded-xl border transition-all cursor-move',
                      draggedSection === section.id 
                        ? 'border-[#C09060] shadow-lg shadow-[#C09060]/20 opacity-50' 
                        : activeSection === section.id
                          ? 'border-[#C09060]/50'
                          : 'border-slate-600/20 hover:border-slate-500/40'
                    )}
                  >
                    {/* Section Header */}
                    <div className="flex items-center gap-3 p-3 border-b border-slate-700/30">
                      <div className="flex items-center gap-2 text-slate-500 cursor-grab active:cursor-grabbing">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                      </div>
                      {/* Section Type Badge (not editable - delete section to change type) */}
                      <span className={cn(
                        'px-2 py-1 text-xs font-medium rounded',
                        section.type === 'staff' 
                          ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50' 
                          : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
                      )}>
                        {section.type === 'staff' ? 'Staff' : 'Lyrics'}
                      </span>
                      <select
                        value={section.label}
                        onChange={(e) => {
                          setEditSections(sections => sections.map(s =>
                            s.id === section.id ? { ...s, label: e.target.value } : s
                          ))
                        }}
                        className="bg-slate-700/50 border border-slate-600/50 rounded px-2 py-1 text-sm text-[#C09060] font-semibold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[#C09060]"
                      >
                        {['Verse', 'Verse 1', 'Verse 2', 'Verse 3', 'Chorus', 'Pre-Chorus', 'Bridge', 'Outro', 'Intro', 'Instrumental', 'Tag', 'Ending', 'Staff Notation'].map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <div className="flex-1" />
                      <motion.button
                        onClick={() => {
                          if (editSections.length > 1) {
                            setSectionToDelete({ id: section.id, label: section.label, type: section.type })
                          }
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className={cn(
                          "p-1.5 rounded hover:bg-red-900/30 text-slate-500 hover:text-red-400 transition-colors",
                          editSections.length <= 1 && "opacity-30 cursor-not-allowed"
                        )}
                        title={editSections.length <= 1 ? "Cannot delete last section" : "Remove section"}
                        disabled={editSections.length <= 1}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </motion.button>
                    </div>
                    
                    {/* Section Content - Different UI for lyrics vs staff */}
                    {section.type === 'staff' ? (
                      <StaffNotationEditor
                        section={section}
                        songMeta={editSongMeta}
                        onContentChange={(content) => {
                          setEditSections(sections => sections.map(s =>
                            s.id === section.id ? { ...s, content } : s
                          ))
                        }}
                        onFocus={() => setActiveSection(section.id)}
                        onBlur={() => setActiveSection(null)}
                      />
                    ) : (
                      <textarea
                        value={section.content}
                        onChange={(e) => {
                          setEditSections(sections => sections.map(s =>
                            s.id === section.id ? { ...s, content: e.target.value } : s
                          ))
                        }}
                        onFocus={() => setActiveSection(section.id)}
                        onBlur={() => setActiveSection(null)}
                        placeholder="Enter lyrics with chords in [brackets]... e.g. [Am]Amazing [G]grace"
                        className="w-full min-h-[120px] bg-transparent p-4 text-slate-100 font-mono text-sm leading-relaxed resize-y focus:outline-none placeholder:text-slate-600"
                        spellCheck={false}
                      />
                    )}
                  </motion.div>
                ))}

                {/* Add Section Buttons */}
                <div className="flex gap-3">
                  <motion.button
                    onClick={() => {
                      const newSection = {
                        id: `section-${Date.now()}`,
                        label: 'Verse',
                        type: 'lyrics' as const,
                        content: ''
                      }
                      setEditSections([...editSections, newSection])
                    }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="flex-1 p-4 rounded-xl border-2 border-dashed border-slate-600/40 hover:border-[#C09060]/50 text-slate-500 hover:text-[#C09060] transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="font-medium">Add Lyrics Section</span>
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      const newSection = {
                        id: `section-${Date.now()}`,
                        label: 'Staff Notation',
                        type: 'staff' as const,
                        content: 'X:1\nM:4/4\nL:1/8\nK:C\n'
                      }
                      setEditSections([...editSections, newSection])
                    }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="flex-1 p-4 rounded-xl border-2 border-dashed border-slate-600/40 hover:border-[#C09060]/50 text-slate-500 hover:text-[#C09060] transition-colors flex items-center justify-center gap-2"
                  >
                    <Music2 className="w-5 h-5" />
                    <span className="font-medium">Add Staff Section</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="lyrics-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 relative"
            >
              {song.sections?.map((section: any, idx: number) => (
                <div key={idx} className="relative" data-section-id={`section-${idx}`}>
                  {/* Sticky notes snapped to TOP of this section */}
                  {showNotes && songNotes.filter(n => n.snapTo === `section-${idx}` && n.snapPosition === 'top').map((note) => (
                    <StickyNoteComponent
                      key={note.id}
                      note={note}
                      onUpdate={(updates) => setSongNotes(notes => notes.map(n => n.id === note.id ? { ...n, ...updates } : n))}
                      onDelete={() => setSongNotes(notes => notes.filter(n => n.id !== note.id))}
                      onDetach={() => setSongNotes(notes => notes.map(n => n.id === note.id ? { ...n, snapTo: null, snapPosition: 'floating' } : n))}
                      sections={song.sections?.map((_: any, i: number) => `section-${i}`) || []}
                    />
                  ))}
                  
                  <div className="flex gap-4">
                    {/* Main Section Content */}
                    <div className="flex-1">
                      {section.type === 'staff' ? (
                        /* Staff Section - Compressed View */
                        <StaffSectionPreview 
                          idx={idx}
                          section={section}
                          songKey={song?.key || 'C'}
                          onExpand={() => setExpandedStaffSection({ label: section.label, content: section.content || '' })}
                        />
                      ) : (
                        /* Lyrics Section - Normal View */
                        <motion.section
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="bg-slate-800/20 rounded-xl p-6 md:p-8 border border-slate-700/20"
                        >
                          <h2 className="text-lg md:text-xl font-bold text-[#C09060] mb-4 uppercase tracking-wider">
                            {section.label}
                          </h2>
                          <div className="space-y-2 text-base md:text-lg leading-relaxed text-slate-100 font-mono text-left">
                            {section.lines?.map((line: string, lineIdx: number) => (
                              <div key={lineIdx} className="whitespace-pre-wrap">
                                {line}
                              </div>
                            ))}
                          </div>
                        </motion.section>
                      )}
                    </div>
                    
                    {/* Sticky notes snapped to RIGHT of this section */}
                    {showNotes && songNotes.filter(n => n.snapTo === `section-${idx}` && n.snapPosition === 'right').map((note) => (
                      <div key={note.id} className="w-64 flex-shrink-0">
                        <StickyNoteComponent
                          note={note}
                          onUpdate={(updates) => setSongNotes(notes => notes.map(n => n.id === note.id ? { ...n, ...updates } : n))}
                          onDelete={() => setSongNotes(notes => notes.filter(n => n.id !== note.id))}
                          onDetach={() => setSongNotes(notes => notes.map(n => n.id === note.id ? { ...n, snapTo: null, snapPosition: 'floating' } : n))}
                          sections={song.sections?.map((_: any, i: number) => `section-${i}`) || []}
                          isCompact
                        />
                      </div>
                    ))}
                  </div>
                  
                  {/* Sticky notes snapped to BOTTOM of this section */}
                  {showNotes && songNotes.filter(n => n.snapTo === `section-${idx}` && n.snapPosition === 'bottom').map((note) => (
                    <StickyNoteComponent
                      key={note.id}
                      note={note}
                      onUpdate={(updates) => setSongNotes(notes => notes.map(n => n.id === note.id ? { ...n, ...updates } : n))}
                      onDelete={() => setSongNotes(notes => notes.filter(n => n.id !== note.id))}
                      onDetach={() => setSongNotes(notes => notes.map(n => n.id === note.id ? { ...n, snapTo: null, snapPosition: 'floating' } : n))}
                      sections={song.sections?.map((_: any, i: number) => `section-${i}`) || []}
                    />
                  ))}
                </div>
              ))}
              
              {/* Floating Sticky Notes */}
              {showNotes && songNotes.filter(n => n.snapPosition === 'floating' || !n.snapTo).map((note) => (
                <StickyNoteComponent
                  key={note.id}
                  note={note}
                  onUpdate={(updates) => setSongNotes(notes => notes.map(n => n.id === note.id ? { ...n, ...updates } : n))}
                  onDelete={() => setSongNotes(notes => notes.filter(n => n.id !== note.id))}
                  onDetach={() => {}}
                  sections={song.sections?.map((_: any, i: number) => `section-${i}`) || []}
                  isFloating
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Actions Modal */}
      <AnimatePresence>
        {showActionsModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowActionsModal(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed z-50 inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[700px] md:max-h-[80vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header - Mobile */}
              <div className="flex items-center justify-between p-4 border-b border-slate-700 md:hidden">
                <h2 className="text-lg font-semibold text-white">Actions</h2>
                <motion.button
                  onClick={() => setShowActionsModal(false)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700"
                >
                  <X className="h-5 w-5 text-slate-300" />
                </motion.button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-auto p-4 md:p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {/* Column 1: Settings & Share */}
                  <div className="space-y-6">
                    {/* Settings Section */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Settings</h3>
                      <div className="space-y-1">
                        <button
                          onClick={() => setIsFavorite(!isFavorite)}
                          className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-800 transition-colors text-left"
                        >
                          <Star className={cn("h-5 w-5", isFavorite ? "text-[#C09060] fill-[#C09060]" : "text-slate-400")} />
                          <div>
                            <div className="text-sm font-medium text-slate-200">Favorite</div>
                            <div className="text-xs text-slate-500">Mark as favorite</div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Share Section */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Share</h3>
                      <div className="space-y-1">
                        <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-800 transition-colors text-left">
                          <Share2 className="h-5 w-5 text-slate-400" />
                          <div>
                            <div className="text-sm font-medium text-slate-200">Via App</div>
                            <div className="text-xs text-slate-500">Send to others</div>
                          </div>
                        </button>
                        <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-800 transition-colors text-left">
                          <Mail className="h-5 w-5 text-slate-400" />
                          <div>
                            <div className="text-sm font-medium text-slate-200">Email</div>
                            <div className="text-xs text-slate-500">Send by email</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Export */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Export</h3>
                    <div className="space-y-1">
                      <button 
                        onClick={() => { window.print(); setShowActionsModal(false); }}
                        className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-800 transition-colors text-left"
                      >
                        <Printer className="h-5 w-5 text-slate-400" />
                        <div>
                          <div className="text-sm font-medium text-slate-200">Print</div>
                          <div className="text-xs text-slate-500">Print song sheet</div>
                        </div>
                      </button>
                      <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-800 transition-colors text-left">
                        <Music2 className="h-5 w-5 text-slate-400" />
                        <div>
                          <div className="text-sm font-medium text-slate-200">ChordPro</div>
                          <div className="text-xs text-slate-500">.pro format</div>
                        </div>
                      </button>
                      <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-800 transition-colors text-left">
                        <FileText className="h-5 w-5 text-slate-400" />
                        <div>
                          <div className="text-sm font-medium text-slate-200">Plain Text</div>
                          <div className="text-xs text-slate-500">.txt format</div>
                        </div>
                      </button>
                      <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-800 transition-colors text-left">
                        <Copy className="h-5 w-5 text-slate-400" />
                        <div>
                          <div className="text-sm font-medium text-slate-200">Copy</div>
                          <div className="text-xs text-slate-500">To clipboard</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Column 3: Notes & Settings */}
                  <div className="space-y-6">
                    {/* Notes Section */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Sticky Notes</h3>
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            const newNote = {
                              id: Date.now(),
                              text: '',
                              position: { x: 100, y: 200 },
                              snapTo: null as string | null,
                              snapPosition: 'floating' as 'floating' | 'top' | 'bottom' | 'right',
                              isExpanded: false
                            }
                            setSongNotes([...songNotes, newNote])
                            setShowActionsModal(false)
                            setShowNotes(true)
                          }}
                          className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-800 transition-colors text-left border border-dashed border-slate-600"
                        >
                          <Plus className="h-5 w-5 text-[#C09060]" />
                          <div>
                            <div className="text-sm font-medium text-slate-200">Add Sticky Note</div>
                            <div className="text-xs text-slate-500">Create draggable sticky note</div>
                          </div>
                        </button>
                        <p className="text-xs text-slate-500 px-2">
                          Sticky notes can be dragged freely or snapped to sections
                        </p>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Bottom Toggle Buttons */}
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <div className="grid grid-cols-5 gap-3">
                    <motion.button
                      onClick={() => { setIsEditMode(true); setShowActionsModal(false); }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#C09060] hover:bg-[#A07850] transition-colors col-span-2"
                    >
                      <PencilIcon className="h-5 w-5 text-white" />
                      <span className="text-xs text-white font-medium">Edit Song</span>
                    </motion.button>
                    <motion.button
                      onClick={() => setShowNotes(!showNotes)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors",
                        showNotes ? "bg-[#C09060] text-white" : "bg-slate-800 hover:bg-slate-700"
                      )}
                    >
                      <StickyNote className={cn("h-5 w-5", showNotes ? "text-white" : "text-slate-300")} />
                      <span className={cn("text-xs", showNotes ? "text-white" : "text-slate-400")}>Notes</span>
                    </motion.button>
                    <motion.button
                      onClick={() => { setShowABC(!showABC); }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors",
                        showABC ? "bg-[#C09060] text-white" : "bg-slate-800 hover:bg-slate-700"
                      )}
                    >
                      <Music2 className={cn("h-5 w-5", showABC ? "text-white" : "text-slate-300")} />
                      <span className={cn("text-xs", showABC ? "text-white" : "text-slate-400")}>ABC</span>
                    </motion.button>
                    <motion.button
                      onClick={() => setShowInstrument(!showInstrument)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors",
                        showInstrument ? "bg-[#C09060] text-white" : "bg-slate-800 hover:bg-slate-700"
                      )}
                    >
                      <Tag className={cn("h-5 w-5", showInstrument ? "text-white" : "text-slate-300")} />
                      <span className={cn("text-xs", showInstrument ? "text-white" : "text-slate-400")}>Instrument</span>
                    </motion.button>
                    <motion.button
                      onClick={() => setShowChords(!showChords)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors",
                        showChords ? "bg-[#C09060] text-white" : "bg-slate-800 hover:bg-slate-700"
                      )}
                    >
                      <Music2 className={cn("h-5 w-5", showChords ? "text-white" : "text-slate-300")} />
                      <span className={cn("text-xs", showChords ? "text-white" : "text-slate-400")}>Chords</span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Expanded Staff Section Modal */}
      <AnimatePresence>
        {expandedStaffSection && (
          <ExpandedStaffModal
            section={expandedStaffSection}
            song={song}
            onClose={() => setExpandedStaffSection(null)}
          />
        )}
      </AnimatePresence>

      {/* Delete Section Confirmation Modal */}
      <AnimatePresence>
        {sectionToDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSectionToDelete(null)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-full bg-red-900/30">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Delete Section</h3>
                </div>
                <p className="text-slate-300 mb-2">
                  Are you sure you want to delete this section?
                </p>
                <div className="bg-slate-900/50 rounded-lg p-3 mb-4 border border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'px-2 py-0.5 text-xs font-medium rounded',
                      sectionToDelete.type === 'staff' 
                        ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50' 
                        : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
                    )}>
                      {sectionToDelete.type === 'staff' ? 'Staff' : 'Lyrics'}
                    </span>
                    <span className="text-[#C09060] font-semibold">{sectionToDelete.label}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mb-6">
                  This action cannot be undone. All content in this section will be permanently removed.
                </p>
                <div className="flex gap-3 justify-end">
                  <motion.button
                    onClick={() => setSectionToDelete(null)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      setEditSections(sections => sections.filter(s => s.id !== sectionToDelete.id))
                      setSectionToDelete(null)
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
                  >
                    Delete Section
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
