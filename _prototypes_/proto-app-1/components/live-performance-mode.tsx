'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Settings,
  Music,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  MessageSquare,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Song, Setlist } from '@/lib/use-setlist-storage'

interface LivePerformanceModeProps {
  setlist: Setlist
  isOpen: boolean
  onClose: () => void
}

interface PerformanceSettings {
  fontSize: number
  autoScroll: boolean
  showChords: boolean
  showCues: boolean
  brightness: number
  contrast: number
}

export function LivePerformanceMode({
  setlist,
  isOpen,
  onClose,
}: LivePerformanceModeProps) {
  const [currentSongIndex, setCurrentSongIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [settings, setSettings] = useState<PerformanceSettings>({
    fontSize: 32,
    autoScroll: true,
    showChords: true,
    showCues: true,
    brightness: 100,
    contrast: 100,
  })
  const [showControls, setShowControls] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()

  const currentSong = setlist.songs[currentSongIndex]

  // Auto-hide controls
  useEffect(() => {
    if (!isPlaying) return

    const hideControls = () => setShowControls(false)
    const resetTimeout = () => {
      clearTimeout(controlsTimeoutRef.current)
      controlsTimeoutRef.current = setTimeout(hideControls, 5000)
      setShowControls(true)
    }

    const element = contentRef.current
    if (element) {
      element.addEventListener('mousemove', resetTimeout)
      element.addEventListener('touchstart', resetTimeout)
      return () => {
        element.removeEventListener('mousemove', resetTimeout)
        element.removeEventListener('touchstart', resetTimeout)
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [isPlaying])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowUp':
          setCurrentSongIndex(prev => Math.max(0, prev - 1))
          e.preventDefault()
          break
        case 'ArrowDown':
          setCurrentSongIndex(prev => Math.min(setlist.songs.length - 1, prev + 1))
          e.preventDefault()
          break
        case ' ':
          setIsPlaying(!isPlaying)
          e.preventDefault()
          break
        case 'Escape':
          onClose()
          break
        case '+':
        case '=':
          setSettings(prev => ({ ...prev, fontSize: Math.min(48, prev.fontSize + 2) }))
          e.preventDefault()
          break
        case '-':
          setSettings(prev => ({ ...prev, fontSize: Math.max(16, prev.fontSize - 2) }))
          e.preventDefault()
          break
        case 'c':
          setSettings(prev => ({ ...prev, showChords: !prev.showChords }))
          break
        case 'n':
          setSettings(prev => ({ ...prev, showCues: !prev.showCues }))
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, setlist.songs.length, isPlaying, onClose])

  // Auto-scroll
  useEffect(() => {
    if (!isPlaying || !settings.autoScroll || !contentRef.current) return

    const interval = setInterval(() => {
      if (contentRef.current) {
        contentRef.current.scrollTop += 2
        const progress = Math.min(
          100,
          (contentRef.current.scrollTop / (contentRef.current.scrollHeight - contentRef.current.clientHeight)) * 100
        )
        setScrollProgress(progress)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [isPlaying, settings.autoScroll])

  // Scroll position tracking
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget
    const progress = Math.min(
      100,
      (element.scrollTop / (element.scrollHeight - element.clientHeight)) * 100
    )
    setScrollProgress(progress)
  }

  if (!isOpen || !currentSong) return null

  const filteredSongs = setlist.songs.filter(s => s.status !== 'ARCHIVED')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
      style={{
        filter: `brightness(${settings.brightness}%) contrast(${settings.contrast}%)`,
      }}
    >
      {/* Close Button - Always Visible */}
      <div className="absolute top-4 right-4 z-10">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          <X className="h-5 w-5 text-white" />
        </motion.button>
      </div>

      {/* Main Content Area */}
      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto pt-20 pb-32 px-6 md:px-12 flex items-center justify-center"
        style={{
          fontSize: `${settings.fontSize}px`,
          scrollBehavior: 'smooth',
        }}
      >
        <div className="w-full max-w-4xl text-center text-white/90 leading-relaxed">
          {/* Song Title */}
          <motion.h1
            key={`title-${currentSong.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-6xl font-bold mb-4 text-white"
          >
            {currentSong.title}
          </motion.h1>

          {/* Artist & Key */}
          <motion.p
            key={`artist-${currentSong.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm md:text-base text-white/60 mb-8"
          >
            {currentSong.artist}
            {currentSong.keyOverride && ` • Key: ${currentSong.keyOverride}`}
            {currentSong.bpm && ` • ${currentSong.bpm} BPM`}
          </motion.p>

          {/* Placeholder for Lyrics */}
          <motion.div
            key={`lyrics-${currentSong.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6 my-12"
          >
            <div className="text-2xl whitespace-pre-line opacity-70">
              [Verse 1]<br />
              <br />
              Lorem ipsum dolor sit amet<br />
              Consectetur adipiscing elit<br />
              <br />
              [Chorus]<br />
              <br />
              Glory to the Lord<br />
              Praise His holy name<br />
            </div>
          </motion.div>

          {/* Chords Display */}
          {settings.showChords && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 p-4 rounded-lg bg-white/5 border border-white/10"
            >
              <p className="text-sm text-white/50 mb-2">Chords:</p>
              <p className="font-mono text-lg text-[#C09060]">
                {currentSong.keyOverride || currentSong.originalKey} | {currentSong.keyOverride || currentSong.originalKey} | {currentSong.keyOverride || currentSong.originalKey}m
              </p>
            </motion.div>
          )}

          {/* Transition Cues */}
          {settings.showCues && (currentSong.speakingCues || currentSong.transitionNotes) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20"
            >
              <p className="text-sm text-amber-300 font-semibold mb-2">Cue:</p>
              <p className="text-base text-amber-100">
                {currentSong.speakingCues || currentSong.transitionNotes}
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-white/10">
        <motion.div
          animate={{ width: `${scrollProgress}%` }}
          className="h-full bg-[#C09060]"
        />
      </div>

      {/* Bottom Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="border-t border-white/10 bg-black/80 backdrop-blur-md p-4 md:p-6 space-y-4"
          >
            {/* Song Navigation */}
            <div className="flex items-center justify-between gap-4">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentSongIndex(Math.max(0, currentSongIndex - 1))}
                disabled={currentSongIndex === 0}
                className="p-3 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-all"
              >
                <SkipBack className="h-5 w-5 text-white" />
              </motion.button>

              <div className="flex-1">
                <p className="text-center text-sm text-white/60 mb-2">
                  Song {currentSongIndex + 1} of {setlist.songs.length}
                </p>
                <div className="flex items-center gap-2 justify-center">
                  <span className="text-white font-semibold">{currentSong.title}</span>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentSongIndex(Math.min(setlist.songs.length - 1, currentSongIndex + 1))}
                disabled={currentSongIndex === setlist.songs.length - 1}
                className="p-3 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-all"
              >
                <SkipForward className="h-5 w-5 text-white" />
              </motion.button>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-4 rounded-full bg-[#C09060] hover:bg-[#B8860B] transition-colors"
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6 text-white" />
                ) : (
                  <Play className="h-6 w-6 text-white" />
                )}
              </motion.button>

              <p className="text-white/60 text-sm">
                {isPlaying ? 'Playing' : 'Paused'}
              </p>
            </div>

            {/* Settings Controls */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Font Size */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSettings(prev => ({ ...prev, fontSize: Math.max(16, prev.fontSize - 2) }))}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                >
                  <ChevronDown className="h-4 w-4 text-white" />
                </button>
                <span className="text-white text-sm">{settings.fontSize}px</span>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, fontSize: Math.min(48, prev.fontSize + 2) }))}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                >
                  <ChevronUp className="h-4 w-4 text-white" />
                </button>
              </div>

              {/* Chords Toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSettings(prev => ({ ...prev, showChords: !prev.showChords }))}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  settings.showChords
                    ? 'bg-[#C09060]/20 text-[#C09060]'
                    : 'bg-white/10 text-white/60'
                )}
              >
                <Music className="h-4 w-4" />
                Chords
              </motion.button>

              {/* Cues Toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSettings(prev => ({ ...prev, showCues: !prev.showCues }))}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  settings.showCues
                    ? 'bg-[#C09060]/20 text-[#C09060]'
                    : 'bg-white/10 text-white/60'
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Cues
              </motion.button>

              {/* Auto-Scroll Toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSettings(prev => ({ ...prev, autoScroll: !prev.autoScroll }))}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  settings.autoScroll
                    ? 'bg-[#C09060]/20 text-[#C09060]'
                    : 'bg-white/10 text-white/60'
                )}
              >
                {settings.autoScroll ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
                Scroll
              </motion.button>
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div className="text-center text-xs text-white/40 pt-2">
              <span>↑/↓ Songs • SPACE Play/Pause • +/- Font • C Chords • N Cues • ESC Exit</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
