'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp, ChevronDown, RotateCcw, ArrowLeft, AlignLeft, AlignCenter, AlignJustify, Music2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDisplayChordNotation } from '@/lib/use-display-chord-notation'
import { SongActionsMenu } from '@/components/song-actions-menu'
import { formatAlignedChordLine, type ChordDisplayMode } from '@/lib/use-chord-alignment'
import { pageEnter, menuSlideIn, staggerItem, tapScale, focusRing, hoverLift } from '@/lib/animations'

interface LyricsModalProps {
  song: any
  isOpen: boolean
  onClose: () => void
  onEditLyricsClick?: () => void
  onPrevSong?: () => void
  onNextSong?: () => void
}

export function LyricsModal({ song, isOpen, onClose, onEditLyricsClick, onPrevSong, onNextSong }: LyricsModalProps) {
  const [transposition, setTransposition] = useState(0)
  const [autoScroll, setAutoScroll] = useState(false)
  const [showChords, setShowChords] = useState(true)
  const [displayMode, setDisplayMode] = useState<ChordDisplayMode>('both')
  const [textAlignment, setTextAlignment] = useState<'left' | 'center' | 'justify'>('left')
  const [isEditMode, setIsEditMode] = useState(false)
  const [editedLyrics, setEditedLyrics] = useState('')
  const [selectedInstrument, setSelectedInstrument] = useState<string>('all')
  const [lastEditedDate, setLastEditedDate] = useState<string | null>(null)
  const [showABC, setShowABC] = useState(false)
  const [showHeaderABC, setShowHeaderABC] = useState(false)
  const [showEditABC, setShowEditABC] = useState(false)
  const abcContainerRef = useRef<HTMLDivElement>(null)
  const editAbcContainerRef = useRef<HTMLDivElement>(null)
  const headerAbcRef = useRef<HTMLDivElement>(null)
  const { displayChord } = useDisplayChordNotation()

  // Render ABC notation in edit mode preview
  useEffect(() => {
    if (showEditABC && editAbcContainerRef.current && editedLyrics) {
      const renderEditABC = async () => {
        try {
          const abcjs = await import('abcjs')
          // Convert edited lyrics to ABC format
          let abcNotation = `X:1\nT:${song?.title || 'Untitled'}\nC:${song?.artist || 'Unknown'}\nM:4/4\nL:1/8\nK:${song?.key || 'C'}\n\n`
          
          // Parse the edited lyrics text
          const lines = editedLyrics.split('\n')
          for (const line of lines) {
            if (line.match(/^\[[\w\s]+\]$/)) {
              abcNotation += `% ${line.slice(1, -1)}\n`
            } else if (line.trim()) {
              abcNotation += `w:${line.trim()}\n`
            }
          }

          if (abcNotation) {
            editAbcContainerRef.current!.innerHTML = ''
            abcjs.default.renderAbc('edit-abc-container', abcNotation, {
              responsive: 'resize',
              staffwidth: 700,
              scale: 0.85,
            })
          }
        } catch (error) {
          console.error('Error rendering ABC notation in edit mode:', error)
        }
      }
      renderEditABC()
    }
  }, [showEditABC, editedLyrics, song])

  // Render ABC notation in header
  useEffect(() => {
    if (showHeaderABC && headerAbcRef.current && song) {
      const abcNotation = convertLyricsToABC(song)
      if (abcNotation) {
        headerAbcRef.current.innerHTML = ''
        abcjs.renderAbc('header-abc-container', abcNotation, {
          responsive: 'resize',
          staffwidth: 600,
          scale: 0.8,
        })
      }
    }
  }, [showHeaderABC, song])

  // Render ABC notation in full view
  useEffect(() => {
    if (showABC && abcContainerRef.current && song) {
      const abcNotation = convertLyricsToABC(song)
      if (abcNotation) {
        // Clear previous notation
        abcContainerRef.current.innerHTML = ''
        // Render new notation
        abcjs.renderAbc('abc-container', abcNotation, {
          responsive: 'resize',
          staffwidth: 800,
        })
      }
    }
  }, [showABC, song])

  // Convert song data to ABC notation format
  const convertLyricsToABC = (song: any) => {
    if (!song) return ''

    let abc = `X:1\nT:${song.title}\nC:${song.artist}\nM:4/4\nL:1/8\nK:${song.key || 'C'}\n`

    if (song.sections && Array.isArray(song.sections)) {
      abc += '\n'
      song.sections.forEach((section: any) => {
        if (section.lines && Array.isArray(section.lines)) {
          abc += `% ${section.label}\n`
          section.lines.forEach((line: string) => {
            if (line.trim()) {
              abc += `w:${line.replace(/\[|\]/g, '')}\n`
            }
          })
        }
      })
    }

    return abc || null
  }

  // Initialize edited lyrics when song changes or edit mode is activated
  useEffect(() => {
    if (song && isEditMode) {
      const lyricsText = song.sections
        ?.map((section: any) => `[${section.label}]\n${section.lines.join('\n')}`)
        .join('\n\n') || ''
      setEditedLyrics(lyricsText)
    }
  }, [song?.id, isEditMode])

  // Reset transposition when song changes
  useEffect(() => {
    setTransposition(0)
  }, [song?.id])

  // Handle saving lyrics and chords
  const handleSaveLyrics = () => {
    if (!song || !editedLyrics.trim()) {
      setIsEditMode(false)
      return
    }

    const lines = editedLyrics.split('\n')
    const newSections = []
    let currentSection = null
    let currentLines = []

    for (const line of lines) {
      if (line.match(/^\[[\w\s]+\]$/)) {
        if (currentSection) {
          newSections.push({
            ...currentSection,
            lines: currentLines.filter(l => l.trim()),
          })
        }
        currentSection = {
          label: line.slice(1, -1),
          lines: [],
        }
        currentLines = []
      } else if (currentSection) {
        currentLines.push(line)
      }
    }

    if (currentSection) {
      newSections.push({
        ...currentSection,
        lines: currentLines.filter(l => l.trim()),
      })
    }

    if (song.updateSong) {
      song.updateSong({
        ...song,
        sections: newSections.length > 0 ? newSections : song.sections,
      })
    }

    setLastEditedDate(new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }))

    setIsEditMode(false)
  }

  const transposedKey = song?.key ? displayChord(song.key, transposition) : null

  if (!isOpen || !song) return null

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={pageEnter}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-600/30 bg-slate-900 shadow-2xl"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-b border-slate-600/30 px-4 md:px-8 py-4 md:py-6 flex-shrink-0 space-y-4"
        >
          {/* Header Top: Title and Controls */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1, x: 4 }}
                whileTap={{ scale: 0.95 }}
                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-700/40 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-slate-300" />
              </motion.button>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg md:text-xl font-bold text-white truncate">{song.title}</h2>
                <p className="text-xs md:text-sm text-slate-400 truncate">{song.artist}</p>
              </div>
            </div>

            {/* Right: ABC Toggle and Actions Menu */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
              <motion.button
                onClick={() => setShowHeaderABC(!showHeaderABC)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                  showHeaderABC
                    ? 'bg-[#C09060] text-white'
                    : 'bg-slate-700/40 text-slate-300 hover:bg-slate-700/60 border border-slate-600/40'
                )}
                title="Toggle music notation preview"
              >
                <Music2 className="h-3.5 w-3.5" />
                ABC
              </motion.button>
              <SongActionsMenu 
                song={song}
                onEditLyrics={() => setIsEditMode(true)}
                onViewABC={() => setShowABC(!showABC)}
                onSongDeleted={() => {
                  setTimeout(onClose, 300)
                }}
              />
            </div>
          </div>

          {/* Header ABC Notation Preview */}
          <AnimatePresence>
            {showHeaderABC && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-600/30">
                  <div
                    ref={headerAbcRef}
                    id="header-abc-container"
                    className="flex justify-center"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Content: Edit Mode or View Mode or ABC View */}
        <AnimatePresence mode="wait">
          {showABC ? (
            <motion.div
              key="abc-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-auto px-2 md:px-8 py-3 md:py-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">ABC Music Notation</h3>
                <motion.button
                  onClick={() => setShowABC(false)}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Close
                </motion.button>
              </div>
              <div
                ref={abcContainerRef}
                id="abc-container"
                className="bg-slate-800/50 rounded-lg p-4 border border-slate-600/30"
              />
            </motion.div>
          ) : isEditMode ? (
            <motion.div
              key="edit-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto px-2 md:px-8 py-3 md:py-6 flex flex-col gap-4"
            >
              {/* Instrument Selector and ABC Toggle */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-slate-300 whitespace-nowrap">Edit for instrument:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {['All', 'Guitar', 'Piano', 'Ukulele', 'Bass'].map((instrument) => (
                      <motion.button
                        key={instrument}
                        onClick={() => setSelectedInstrument(instrument.toLowerCase())}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                          selectedInstrument === instrument.toLowerCase()
                            ? 'bg-[#C09060] text-white'
                            : 'bg-slate-700/40 text-slate-300 hover:bg-slate-700/60 border border-slate-600/40'
                        )}
                      >
                        {instrument}
                      </motion.button>
                    ))}
                  </div>
                </div>
                {/* ABC Preview Toggle */}
                <motion.button
                  onClick={() => setShowEditABC(!showEditABC)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0',
                    showEditABC
                      ? 'bg-[#C09060] text-white shadow-lg shadow-[#C09060]/20'
                      : 'bg-slate-700/50 text-slate-200 hover:bg-slate-700/70 border border-slate-600/50'
                  )}
                  title="Preview ABC music notation as you edit"
                >
                  <Music2 className="h-4 w-4" />
                  <span>ABC</span>
                </motion.button>
              </div>

              {/* Edit Textarea for Lyrics and Chords */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="text-xs text-slate-500 bg-slate-800/50 rounded-lg p-3 border border-slate-600/30">
                  <p className="font-semibold text-slate-400 mb-2">Format Guide:</p>
                  <ul className="space-y-1 text-slate-400">
                    <li>• Use <code className="bg-slate-900 px-1 rounded text-[#C09060]">[Verse]</code>, <code className="bg-slate-900 px-1 rounded text-[#C09060]">[Chorus]</code>, <code className="bg-slate-900 px-1 rounded text-[#C09060]">[Bridge]</code> for sections</li>
                    <li>• Chords above lyrics: <code className="bg-slate-900 px-1 rounded text-[#C09060]">Am     G</code></li>
                    <li>• Chords per instrument (e.g., <code className="bg-slate-900 px-1 rounded text-[#C09060]">|Guitar: Cm|Piano: Dm|</code>)</li>
                  </ul>
                </div>
                <div className={cn('flex-1 flex gap-2', showEditABC ? 'flex-row' : 'flex-col')}>
                  <textarea
                    value={editedLyrics}
                    onChange={(e) => setEditedLyrics(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                        e.preventDefault()
                        handleSaveLyrics()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        setIsEditMode(false)
                      }
                    }}
                    autoFocus
                    className={cn(
                      'bg-slate-800/50 border border-slate-600 rounded-lg p-4 text-slate-100 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:border-transparent',
                      showEditABC ? 'flex-1' : 'flex-1'
                    )}
                    placeholder={`[Verse]\nAm     G\nFirst verse lyrics\n\n[Chorus]\nC      F\nChorus lyrics`}
                    spellCheck="false"
                  />
                  {/* ABC Preview in Edit Mode */}
                  <AnimatePresence>
                    {showEditABC && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="flex-1 min-w-[350px] max-h-[500px] overflow-auto bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-[#C09060]/40 rounded-lg p-4 shadow-lg shadow-[#C09060]/10"
                      >
                        <div className="text-xs text-slate-400 font-semibold mb-3 uppercase tracking-wide">ABC Music Notation Preview</div>
                        <div
                          ref={editAbcContainerRef}
                          id="edit-abc-container"
                          className="flex justify-center [&>svg]:max-w-full"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="text-xs text-slate-500">
                  Press Ctrl+S to save or Esc to cancel • Editing for: <span className="text-[#C09060] font-semibold capitalize">{selectedInstrument}</span>
                </div>
              </div>

              {/* Edit Mode Actions */}
              <div className="flex gap-2 justify-end">
                <motion.button
                  onClick={() => setIsEditMode(false)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 rounded-lg border border-slate-600 bg-slate-700/40 text-slate-300 hover:bg-slate-700/60 transition-colors font-semibold text-sm"
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handleSaveLyrics}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 rounded-lg bg-[#C09060] hover:bg-[#B8860B] text-white transition-colors font-semibold text-sm"
                >
                  Save Changes
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="view-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto px-2 md:px-8 py-3 md:py-6 space-y-4 md:space-y-6"
            >
              {song.sections && song.sections.length > 0 ? (
                <>
                  {song.sections.map((section: any, sectionIdx: number) => (
                    <motion.div key={sectionIdx} variants={staggerItem} className="space-y-1">
                      <motion.h3 className="text-xs md:text-sm font-bold text-[#C09060] uppercase tracking-wider">{section.label}</motion.h3>
                      <div className="space-y-2">
                        {section.lines.map((line: string, lineIdx: number) => (
                          <div key={lineIdx} className="space-y-0.5">
                            <div className={cn('text-sm md:text-base leading-relaxed font-mono text-slate-100', {
                              'text-center': textAlignment === 'center',
                              'text-justify': textAlignment === 'justify',
                            })}>
                              {formatAlignedChordLine(line, displayMode, transposition, displayChord)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-slate-400">No lyrics available for this song</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compact Navigation Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between border-t border-slate-600/30 px-4 md:px-8 py-3 md:py-4 flex-shrink-0 bg-slate-800/30"
        >
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setTransposition(Math.max(transposition - 1, -12))}
              disabled={transposition <= -12}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="disabled:opacity-50 disabled:cursor-not-allowed p-1.5 rounded-lg hover:bg-slate-700/40 transition-colors"
            >
              <ChevronDown className="h-4 w-4 text-slate-300" />
            </motion.button>
            <span className="w-8 text-center text-xs font-semibold text-slate-300">{transposition > 0 ? '+' : ''}{transposition}</span>
            <motion.button
              onClick={() => setTransposition(Math.min(transposition + 1, 12))}
              disabled={transposition >= 12}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="disabled:opacity-50 disabled:cursor-not-allowed p-1.5 rounded-lg hover:bg-slate-700/40 transition-colors"
            >
              <ChevronUp className="h-4 w-4 text-slate-300" />
            </motion.button>
          </div>

          {/* Song Info */}
          <div className="hidden md:flex items-center gap-4 text-xs text-slate-500">
            <span className="font-semibold text-white">{song.title}</span>
            <span>{song.artist}</span>
            {transposedKey && <span>Key: {transposedKey}</span>}
            {song.bpm && <span>BPM: {song.bpm}</span>}
            {lastEditedDate && <span className="text-slate-600">Last edited: {lastEditedDate}</span>}
          </div>

          <div className="flex items-center gap-1.5 md:gap-2">
            {onPrevSong && (
              <motion.button
                onClick={onPrevSong}
                whileHover={{ scale: 1.1, x: -2 }}
                whileTap={{ scale: 0.95 }}
                className="p-1.5 rounded-lg hover:bg-slate-700/40 transition-colors"
              >
                <ChevronUp className="h-4 w-4 text-slate-300 rotate-90" />
              </motion.button>
            )}
            {onNextSong && (
              <motion.button
                onClick={onNextSong}
                whileHover={{ scale: 1.1, x: 2 }}
                whileTap={{ scale: 0.95 }}
                className="p-1.5 rounded-lg hover:bg-slate-700/40 transition-colors"
              >
                <ChevronUp className="h-4 w-4 text-slate-300 -rotate-90" />
              </motion.button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
