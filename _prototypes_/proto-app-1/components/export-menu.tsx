'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  Copy,
  Share2,
  Mail,
  Check,
  FileText,
  Music,
  Loader,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  generateChordProFile,
  generateTextFile,
  downloadFile,
  copyToClipboard,
  generateFilename,
  generateEmailContent,
} from '@/lib/chordpro-export'

interface Song {
  id: string
  key: string
  title: string
  artist: string
  bpm?: number
  sections?: {
    label: string
    lines: { chords?: string; lyrics: string }[]
  }[]
}

interface ExportMenuProps {
  song: Song | null
  className?: string
}

export function ExportMenu({ song, className }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  if (!song) return null

  const handleDownloadChordPro = async () => {
    setLoading(true)
    try {
      const blob = generateChordProFile(song)
      downloadFile(blob, generateFilename(song, 'chordpro'))
      setFeedback({ type: 'success', message: 'ChordPro file downloaded' })
      setTimeout(() => setFeedback(null), 2000)
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to download file' })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadText = async () => {
    setLoading(true)
    try {
      const blob = generateTextFile(song)
      downloadFile(blob, generateFilename(song, 'txt'))
      setFeedback({ type: 'success', message: 'Text file downloaded' })
      setTimeout(() => setFeedback(null), 2000)
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to download file' })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyToClipboard = async () => {
    setLoading(true)
    try {
      await copyToClipboard(song)
      setFeedback({ type: 'success', message: 'Copied to clipboard' })
      setTimeout(() => setFeedback(null), 2000)
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to copy to clipboard' })
    } finally {
      setLoading(false)
    }
  }

  const handleShareEmail = () => {
    const { subject, body } = generateEmailContent(song)
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailtoLink
    setFeedback({ type: 'success', message: 'Opening email client' })
    setTimeout(() => setFeedback(null), 2000)
  }

  const handleShareWeb = async () => {
    if (!navigator.share) {
      // Fallback to copy
      await handleCopyToClipboard()
      return
    }

    try {
      await navigator.share({
        title: `${song.title} by ${song.artist}`,
        text: `Check out this song: ${song.title} by ${song.artist}`,
      })
      setFeedback({ type: 'success', message: 'Shared successfully' })
      setTimeout(() => setFeedback(null), 2000)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setFeedback({ type: 'error', message: 'Failed to share' })
      }
    }
  }

  return (
    <div className={cn('relative', className)}>
      {/* Main Export Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all',
          isOpen
            ? 'bg-[#C09060] text-white shadow-lg'
            : 'bg-[#C09060]/20 text-[#C09060] border border-[#C09060]/50 hover:bg-[#C09060]/30'
        )}
        disabled={loading}
      >
        {loading ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Export, Share & Save
      </motion.button>

      {/* Feedback Message */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'absolute top-full right-0 mt-2 px-3 py-2 rounded text-xs font-medium whitespace-nowrap z-50',
              feedback.type === 'success'
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-red-500/20 text-red-400 border border-red-500/50'
            )}
          >
            {feedback.type === 'success' && <Check className="inline h-3 w-3 mr-1" />}
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full right-0 mt-2 w-56 rounded-lg bg-slate-800 border border-slate-700 shadow-xl z-50 overflow-hidden"
          >
            <div className="p-2 space-y-1">
              {/* Download Section */}
              <div className="px-2 py-1.5 border-b border-slate-700">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Download</p>
              </div>

              <motion.button
                onClick={handleDownloadChordPro}
                whileHover={{ x: 4 }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Music className="h-4 w-4 text-[#C09060]" />
                <div className="text-left flex-1">
                  <p className="font-medium">ChordPro Format</p>
                  <p className="text-xs text-slate-500">For OnSong, BandHelper, etc.</p>
                </div>
              </motion.button>

              <motion.button
                onClick={handleDownloadText}
                whileHover={{ x: 4 }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <FileText className="h-4 w-4 text-blue-400" />
                <div className="text-left flex-1">
                  <p className="font-medium">Plain Text</p>
                  <p className="text-xs text-slate-500">For any text viewer</p>
                </div>
              </motion.button>

              {/* Copy Section */}
              <div className="px-2 py-1.5 border-t border-slate-700">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Copy</p>
              </div>

              <motion.button
                onClick={handleCopyToClipboard}
                whileHover={{ x: 4 }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Copy className="h-4 w-4 text-amber-400" />
                <div className="text-left flex-1">
                  <p className="font-medium">Copy to Clipboard</p>
                  <p className="text-xs text-slate-500">Paste anywhere</p>
                </div>
              </motion.button>

              {/* Share Section */}
              <div className="px-2 py-1.5 border-t border-slate-700">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Share</p>
              </div>

              <motion.button
                onClick={handleShareWeb}
                whileHover={{ x: 4 }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Share2 className="h-4 w-4 text-purple-400" />
                <div className="text-left flex-1">
                  <p className="font-medium">Share Via App</p>
                  <p className="text-xs text-slate-500">Messages, social, etc.</p>
                </div>
              </motion.button>

              <motion.button
                onClick={handleShareEmail}
                whileHover={{ x: 4 }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Mail className="h-4 w-4 text-green-400" />
                <div className="text-left flex-1">
                  <p className="font-medium">Email</p>
                  <p className="text-xs text-slate-500">Send to collaborators</p>
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay click handler */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
