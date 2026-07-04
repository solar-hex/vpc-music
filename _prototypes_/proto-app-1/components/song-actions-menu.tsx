'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Archive,
  Trash2,
  Share2,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Bookmark,
  Copy,
  Mail,
  Music,
  FileOutput,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Star,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Printer,
  MessageSquare,
  Tag,
  FileText,
  Edit,
  PencilIcon,
  Music2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { menuSlideIn, menuItemStagger, tapScale } from '@/lib/animations'
import { archiveSong, deleteSong, shareSong, isArchived } from '@/lib/song-actions'
import {
  generateChordProFile,
  generateTextFile,
  downloadFile,
  copyToClipboard,
  generateFilename,
} from '@/lib/chordpro-export'

interface SongActionsMenuProps {
  song: any
  onSongArchived?: (songId: string) => void
  onSongDeleted?: (songId: string) => void
  onEditLyrics?: () => void
  onViewABC?: () => void
}

export function SongActionsMenu({ song, onSongArchived, onSongDeleted, onEditLyrics, onViewABC }: SongActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [archived, setArchived] = useState(isArchived(song.id))
  const [isFavorite, setIsFavorite] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left')
  const [menuPosition, setMenuPosition] = useState<'bottom' | 'top'>('bottom')
  const [isCompact, setIsCompact] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 3000)
  }

  // Calculate adaptive positioning and sizing
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return

    const handleResize = () => {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top
      const menuHeight = 550 // approximate height

      // Determine if menu should open above or below
      if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        setMenuPosition('top')
      } else {
        setMenuPosition('bottom')
      }

      // Determine if compact layout is needed (for screens < 768px)
      setIsCompact(viewportWidth < 768)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen])

  const handleDownloadChordPro = async () => {
    setIsLoading(true)
    try {
      const content = generateChordProFile(song)
      downloadFile(content, generateFilename(song, '.pro'), 'text/plain')
      showFeedback('success', 'ChordPro file downloaded')
      setIsOpen(false)
    } catch {
      showFeedback('error', 'Failed to download file')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadText = async () => {
    setIsLoading(true)
    try {
      const content = generateTextFile(song)
      downloadFile(content, generateFilename(song, '.txt'), 'text/plain')
      showFeedback('success', 'Text file downloaded')
      setIsOpen(false)
    } catch {
      showFeedback('error', 'Failed to download file')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyToClipboard = async () => {
    setIsLoading(true)
    try {
      const content = generateChordProFile(song)
      await copyToClipboard(content)
      showFeedback('success', 'Copied to clipboard')
      setIsOpen(false)
    } catch {
      showFeedback('error', 'Failed to copy')
    } finally {
      setIsLoading(false)
    }
  }

  const handleShare = async (method: 'web-share' | 'email') => {
    showFeedback('success', `Shared via ${method}`)
  }

  const handleArchive = async () => {
    setIsLoading(true)
    try {
      await archiveSong(song.id)
      setArchived(true)
      showFeedback('success', 'Song archived')
      onSongArchived?.(song.id)
      setIsOpen(false)
    } catch {
      showFeedback('error', 'Failed to archive')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await deleteSong(song.id)
      showFeedback('success', 'Song deleted')
      onSongDeleted?.(song.id)
      setIsOpen(false)
    } catch {
      showFeedback('error', 'Failed to delete')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = () => {
    setIsFavorite(!isFavorite)
    showFeedback('success', isFavorite ? 'Removed from favorites' : 'Saved to favorites')
  }

  const handleToggleFavorite = () => {
    setIsFavorite(!isFavorite)
    showFeedback('success', isFavorite ? 'Removed from favorites' : 'Added to favorites')
  }

  const handleToggleLock = () => {
    setIsLocked(!isLocked)
    showFeedback('success', isLocked ? 'Song unlocked' : 'Song locked')
  }

  const handleToggleVisibility = () => {
    setIsVisible(!isVisible)
    showFeedback('success', isVisible ? 'Hidden from view' : 'Visible to all')
  }

  const handleAlignmentChange = (align: 'left' | 'center' | 'right' | 'justify') => {
    setAlignment(align)
    const alignText = align === 'left' ? 'Left' : align === 'center' ? 'Center' : align === 'right' ? 'Right' : 'Justified'
    showFeedback('success', `Alignment set to ${alignText}`)
  }

  const handlePrint = () => {
    window.print()
    showFeedback('success', 'Print dialog opened')
    setIsOpen(false)
  }

  const handleAddNote = () => {
    showFeedback('success', 'Note feature coming soon')
  }

  const handleAddTag = () => {
    showFeedback('success', 'Tag feature coming soon')
  }

  return (
    <div className="relative">
      {/* Menu Trigger Button */}
      <motion.button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1, rotate: isOpen ? 0 : 5 }}
        whileTap={{ scale: 0.9, rotate: 0 }}
        animate={{ rotate: isOpen ? 90 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-[#C09060] focus:outline-none focus:ring-2 focus:ring-[#C09060] transition-colors"
        aria-label="Song options menu"
        aria-expanded={isOpen}
        disabled={isLoading}
      >
        <MoreVertical className="h-5 w-5 text-slate-400 hover:text-[#C09060]" />
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-30"
            />

            {/* Expanded Accessible Menu Modal - Responsive */}
            <motion.div
              ref={menuRef}
              {...menuSlideIn}
              role="menu"
              aria-label="Song actions menu"
              className={cn(
                'absolute z-40 bg-slate-900 border border-slate-600 rounded-xl shadow-2xl',
                // Positioning: Adaptive vertical placement
                menuPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
                // Horizontal positioning with screen edge awareness
                'right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2',
                // Responsive sizing: Grows from mobile to desktop
                'w-[calc(100vw-2rem)] sm:w-[90vw] md:w-[85vw] lg:w-[1000px]',
                // Minimum and maximum constraints
                'min-w-[300px] max-w-[1200px]',
                // Overflow handling: Internal scrolling with proper height
                'max-h-[85vh] overflow-y-auto overflow-x-hidden',
                // Scroll appearance
                'scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800'
              )}
            >
              {/* Menu Content - Direct Grid (No Separate Header) */}
              <div className={cn(
                'grid gap-0',
                // Responsive columns: 1 column on mobile, 3 on desktop
                isCompact ? 'grid-cols-1' : 'grid-cols-3',
                // Ensure proper overflow
                'overflow-x-hidden'
              )}>
                {/* Left Column - Save & Share */}
                <div className={cn(
                  'border-slate-700 px-4 sm:px-6 py-5 sm:py-6 space-y-4 sm:space-y-6',
                  !isCompact && 'border-r'
                )}>
                  {/* Save Button */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Library</h3>
                    <motion.button
                      onClick={handleSave}
                      disabled={isLoading}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full group px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-3 sm:gap-4 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                      role="menuitem"
                      aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
                    >
                      <Bookmark className={cn('h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0', isFavorite && 'fill-[#C09060] text-[#C09060]')} />
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-medium text-sm sm:text-base">{isFavorite ? 'Saved' : 'Save'}</div>
                        <div className="text-xs text-slate-500 group-hover:text-slate-400 truncate">Add to favorites</div>
                      </div>
                      {isFavorite && <CheckCircle2 className="h-4 sm:h-5 w-4 sm:w-5 text-emerald-400 flex-shrink-0" />}
                    </motion.button>
                  </div>

                  {/* Share Section */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Share</h3>
                    <div className="space-y-2">
                      <motion.button
                        onClick={() => handleShare('web-share')}
                        disabled={isLoading}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full group px-4 py-3 flex items-center gap-4 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                        role="menuitem"
                        aria-label="Share via app"
                      >
                        <Share2 className="h-5 w-5 flex-shrink-0" />
                        <div className="flex-1 text-left">
                          <div className="font-medium">Via App</div>
                          <div className="text-xs text-slate-500 group-hover:text-slate-400">Send to others</div>
                        </div>
                      </motion.button>

                      <motion.button
                        onClick={() => handleShare('email')}
                        disabled={isLoading}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full group px-4 py-3 flex items-center gap-4 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                        role="menuitem"
                        aria-label="Share via email"
                      >
                        <Mail className="h-5 w-5 flex-shrink-0" />
                        <div className="flex-1 text-left">
                          <div className="font-medium">Email</div>
                          <div className="text-xs text-slate-500 group-hover:text-slate-400">Send by email</div>
                        </div>
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Middle Column - Export */}
                <div className={cn(
                  'border-slate-700 px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 border-t sm:border-t-0',
                  !isCompact && 'border-r'
                )}>
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Export</h3>
                    <div className="space-y-2">
                      <motion.button
                        onClick={handleDownloadChordPro}
                        disabled={isLoading}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full group px-4 py-3 flex items-center gap-4 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                        role="menuitem"
                        aria-label="Export as ChordPro file"
                      >
                        <Music className="h-5 w-5 flex-shrink-0" />
                        <div className="flex-1 text-left">
                          <div className="font-medium">ChordPro</div>
                          <div className="text-xs text-slate-500 group-hover:text-slate-400">.pro format</div>
                        </div>
                      </motion.button>

                      <motion.button
                        onClick={handleDownloadText}
                        disabled={isLoading}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full group px-4 py-3 flex items-center gap-4 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                        role="menuitem"
                        aria-label="Export as plain text file"
                      >
                        <FileOutput className="h-5 w-5 flex-shrink-0" />
                        <div className="flex-1 text-left">
                          <div className="font-medium">Plain Text</div>
                          <div className="text-xs text-slate-500 group-hover:text-slate-400">.txt format</div>
                        </div>
                      </motion.button>

                      <motion.button
                        onClick={handleCopyToClipboard}
                        disabled={isLoading}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full group px-4 py-3 flex items-center gap-4 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                        role="menuitem"
                        aria-label="Copy song to clipboard"
                      >
                        <Copy className="h-5 w-5 flex-shrink-0" />
                        <div className="flex-1 text-left">
                          <div className="font-medium">Copy</div>
                          <div className="text-xs text-slate-500 group-hover:text-slate-400">To clipboard</div>
                        </div>
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Right Column - Formatting & Actions */}
                <div className={cn(
                  'px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 border-t sm:border-t-0'
                )}>
                  {/* Alignment Section */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Text Alignment</h3>
                    <div className="grid grid-cols-4 gap-2">
                      <motion.button
                        onClick={() => handleAlignmentChange('left')}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          'p-3 rounded-lg transition-all flex items-center justify-center border focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900',
                          alignment === 'left'
                            ? 'bg-[#C09060] text-white border-[#C09060]'
                            : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700/60 hover:border-slate-600'
                        )}
                        title="Left align"
                        role="menuitemradio"
                        aria-checked={alignment === 'left'}
                        aria-label="Align text left"
                      >
                        <AlignLeft className="h-4 w-4" />
                      </motion.button>

                      <motion.button
                        onClick={() => handleAlignmentChange('center')}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          'p-3 rounded-lg transition-all flex items-center justify-center border focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900',
                          alignment === 'center'
                            ? 'bg-[#C09060] text-white border-[#C09060]'
                            : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700/60 hover:border-slate-600'
                        )}
                        title="Center align"
                        role="menuitemradio"
                        aria-checked={alignment === 'center'}
                        aria-label="Align text center"
                      >
                        <AlignCenter className="h-4 w-4" />
                      </motion.button>

                      <motion.button
                        onClick={() => handleAlignmentChange('right')}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          'p-3 rounded-lg transition-all flex items-center justify-center border focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900',
                          alignment === 'right'
                            ? 'bg-[#C09060] text-white border-[#C09060]'
                            : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700/60 hover:border-slate-600'
                        )}
                        title="Right align"
                        role="menuitemradio"
                        aria-checked={alignment === 'right'}
                        aria-label="Align text right"
                      >
                        <AlignRight className="h-4 w-4" />
                      </motion.button>

                      <motion.button
                        onClick={() => handleAlignmentChange('justify')}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          'p-3 rounded-lg transition-all flex items-center justify-center border focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900',
                          alignment === 'justify'
                            ? 'bg-[#C09060] text-white border-[#C09060]'
                            : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700/60 hover:border-slate-600'
                        )}
                        title="Justify align"
                        role="menuitemradio"
                        aria-checked={alignment === 'justify'}
                        aria-label="Justify text"
                      >
                        <AlignJustify className="h-4 w-4" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Settings Section */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Settings</h3>
                    <div className="space-y-2">
                      <motion.button
                        onClick={handleToggleFavorite}
                        disabled={isLoading}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full group px-4 py-3 flex items-center gap-4 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                        role="menuitemcheckbox"
                        aria-checked={isFavorite}
                        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Star className={cn('h-5 w-5 flex-shrink-0', isFavorite && 'fill-[#C09060] text-[#C09060]')} />
                        <div className="flex-1 text-left">
                          <div className="font-medium">{isFavorite ? 'Favorited' : 'Favorite'}</div>
                          <div className="text-xs text-slate-500 group-hover:text-slate-400">Mark as favorite</div>
                        </div>
                      </motion.button>

                      <motion.button
                        onClick={handleToggleLock}
                        disabled={isLoading}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full group px-4 py-3 flex items-center gap-4 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                        role="menuitemcheckbox"
                        aria-checked={isLocked}
                        aria-label={isLocked ? 'Unlock song' : 'Lock song'}
                      >
                        {isLocked ? (
                          <Lock className="h-5 w-5 flex-shrink-0 text-amber-500" />
                        ) : (
                          <Unlock className="h-5 w-5 flex-shrink-0" />
                        )}
                        <div className="flex-1 text-left">
                          <div className="font-medium">{isLocked ? 'Locked' : 'Lock'}</div>
                          <div className="text-xs text-slate-500 group-hover:text-slate-400">Prevent changes</div>
                        </div>
                      </motion.button>

                      <motion.button
                        onClick={handleToggleVisibility}
                        disabled={isLoading}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full group px-4 py-3 flex items-center gap-4 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                        role="menuitemcheckbox"
                        aria-checked={isVisible}
                        aria-label={isVisible ? 'Hide from view' : 'Show'}
                      >
                        {isVisible ? (
                          <Eye className="h-5 w-5 flex-shrink-0" />
                        ) : (
                          <EyeOff className="h-5 w-5 flex-shrink-0 text-slate-500" />
                        )}
                        <div className="flex-1 text-left">
                          <div className="font-medium">{isVisible ? 'Visible' : 'Hidden'}</div>
                          <div className="text-xs text-slate-500 group-hover:text-slate-400">Visibility toggle</div>
                        </div>
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions - Full Width with Responsive Grid */}
              <motion.div 
                className={cn(
                  'grid gap-1 border-t border-slate-700 bg-slate-900/50 px-4 sm:px-6 py-3 sm:py-4',
                  isCompact ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-5',
                  'overflow-x-auto overflow-y-hidden'
                )}
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.04,
                      delayChildren: 0.1,
                    },
                  },
                }}
                initial="hidden"
                animate="visible"
              >
                <motion.button
                  onClick={handlePrint}
                  disabled={isLoading}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
                  }}
                  whileHover={{ y: -4, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group px-3 py-3 flex flex-col items-center gap-2 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                  role="menuitem"
                  aria-label="Print song"
                >
                  <Printer className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-medium">Print</span>
                </motion.button>

                <motion.button
                  onClick={handleAddNote}
                  disabled={isLoading}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
                  }}
                  whileHover={{ y: -4, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group px-3 py-3 flex flex-col items-center gap-2 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                  role="menuitem"
                  aria-label="Add note"
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-medium">Note</span>
                </motion.button>

                <motion.button
                  onClick={handleAddTag}
                  disabled={isLoading}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
                  }}
                  whileHover={{ y: -4, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group px-3 py-3 flex flex-col items-center gap-2 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                  role="menuitem"
                  aria-label="Add tag"
                >
                  <Tag className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-medium">Tag</span>
                </motion.button>

                <motion.button
                  onClick={() => {
                    // Open lyrics view
                    showFeedback('success', 'Opening lyrics view...')
                  }}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
                  }}
                  whileHover={{ y: -4, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group px-3 py-3 flex flex-col items-center gap-2 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                  role="menuitem"
                  aria-label="View lyrics"
                  title="View full lyrics"
                >
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-medium">Lyrics</span>
                </motion.button>

                <motion.button
                  onClick={onEditLyrics}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
                  }}
                  whileHover={{ y: -4, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group px-3 py-3 flex flex-col items-center gap-2 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                  role="menuitem"
                  aria-label="Edit lyrics and chords"
                >
                  <PencilIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-medium">Edit</span>
                </motion.button>

                <motion.button
                  onClick={() => {
                    if (song) {
                      window.print()
                      setFeedback({ type: 'success', message: 'Opening print dialog...' })
                      setTimeout(() => setFeedback(null), 2000)
                    }
                  }}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
                  }}
                  whileHover={{ y: -4, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group px-3 py-3 flex flex-col items-center gap-2 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                  role="menuitem"
                  aria-label="Print lyrics"
                >
                  <Printer className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-medium">Print</span>
                </motion.button>

                <motion.button
                  onClick={onEditLyrics}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
                  }}
                  whileHover={{ y: -4, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group px-3 py-3 flex flex-col items-center gap-2 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                  role="menuitem"
                  aria-label="Edit lyrics and chords"
                  title="Edit song lyrics and chords"
                >
                  <PencilIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-medium">Edit Lyrics</span>
                </motion.button>

                <motion.button
                  onClick={onViewABC}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
                  }}
                  whileHover={{ y: -4, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group px-3 py-3 flex flex-col items-center gap-2 text-slate-200 hover:bg-slate-800/60 hover:text-[#C09060] rounded-lg transition-colors border border-transparent hover:border-[#C09060]/30 focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-slate-900"
                  role="menuitem"
                  aria-label="View ABC notation"
                  title="View music notation (ABC format)"
                >
                  <Music2 className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-medium">ABC</span>
                </motion.button>

                <motion.button
                  onClick={handleDelete}
                  disabled={isLoading}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
                  }}
                  whileHover={{ y: -4, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group px-3 py-3 flex flex-col items-center gap-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-red-500/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                  role="menuitem"
                  aria-label="Delete song permanently"
                >
                  <Trash2 className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-medium">Delete</span>
                </motion.button>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Feedback Toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn(
              'absolute top-full right-0 mt-3 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium whitespace-nowrap',
              feedback.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
            )}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            )}
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
