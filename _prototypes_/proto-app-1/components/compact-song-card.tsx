'use client'

import { motion } from 'framer-motion'
import { Play, Music } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hoverLift, tapScale } from '@/lib/animations'

interface CompactSongCardProps {
  song: any
  onOpenLyrics: (song: any) => void
  theme: string
}

export function CompactSongCard({ song, onOpenLyrics, theme }: CompactSongCardProps) {
  const keyColor = {
    C: 'from-red-500/20 to-red-600/10',
    'C#': 'from-orange-500/20 to-orange-600/10',
    D: 'from-amber-500/20 to-amber-600/10',
    'D#': 'from-yellow-500/20 to-yellow-600/10',
    E: 'from-lime-500/20 to-lime-600/10',
    F: 'from-green-500/20 to-green-600/10',
    'F#': 'from-emerald-500/20 to-emerald-600/10',
    G: 'from-teal-500/20 to-teal-600/10',
    'G#': 'from-cyan-500/20 to-cyan-600/10',
    A: 'from-blue-500/20 to-blue-600/10',
    'A#': 'from-indigo-500/20 to-indigo-600/10',
    B: 'from-purple-500/20 to-purple-600/10',
  }[song.key] || 'from-slate-500/20 to-slate-600/10'

  const keyTextColor = {
    C: 'text-red-400',
    'C#': 'text-orange-400',
    D: 'text-amber-400',
    'D#': 'text-yellow-400',
    E: 'text-lime-400',
    F: 'text-green-400',
    'F#': 'text-emerald-400',
    G: 'text-teal-400',
    'G#': 'text-cyan-400',
    A: 'text-blue-400',
    'A#': 'text-indigo-400',
    B: 'text-purple-400',
  }[song.key] || 'text-slate-400'

  const categoryBgColor = {
    Praise: 'bg-rose-500/20 text-rose-300',
    Worship: 'bg-indigo-500/20 text-indigo-300',
    Prayer: 'bg-sky-500/20 text-sky-300',
    Hymn: 'bg-amber-500/20 text-amber-300',
    Contemporary: 'bg-violet-500/20 text-violet-300',
    Traditional: 'bg-slate-500/20 text-slate-300',
  }[song.category] || 'bg-slate-500/20 text-slate-300'

  return (
    <motion.button
      onClick={() => onOpenLyrics(song)}
      {...hoverLift(3)}
      {...tapScale(0.12)}
      className={cn(
        'group relative w-full text-left transition-all rounded-lg overflow-hidden',
        theme === 'night'
          ? 'bg-slate-800/50 border border-slate-700/40 hover:border-[#C09060]/40 hover:bg-slate-800/70'
          : 'bg-slate-100 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
      )}
    >
      {/* Background gradient by key */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-25 group-hover:opacity-35 transition-opacity',
          keyColor
        )}
      />

      {/* Minimal Content */}
      <div className="relative p-2 space-y-0">
        {/* Single Row Layout */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Key Badge - Minimal */}
          <div className={cn(
            'inline-flex items-center justify-center flex-shrink-0 h-6 w-6 rounded font-bold text-xs',
            theme === 'night'
              ? `${keyTextColor} bg-slate-700/40 border border-slate-600/40`
              : 'bg-slate-200 text-slate-700 border border-slate-300'
          )}>
            {song.key}
          </div>

          {/* Title + Artist - Stacked, Minimal */}
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              'font-semibold text-sm leading-tight truncate',
              theme === 'night' ? 'text-white' : 'text-slate-900'
            )}>
              {song.title}
            </h3>
            <p className={cn(
              'text-xs truncate',
              theme === 'night' ? 'text-slate-500' : 'text-slate-600'
            )}>
              {song.artist}
            </p>
          </div>

          {/* Category Tag - Inline, Minimal */}
          {song.category && (
            <span className={cn(
              'inline-block px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 truncate',
              categoryBgColor
            )}>
              {song.category}
            </span>
          )}

          {/* Play Button - Hover */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileHover={{ opacity: 1, scale: 1 }}
            className="flex-shrink-0 p-1 rounded-md bg-[#C09060]/70 text-white hover:bg-[#C09060] transition-colors"
          >
            <Play className="h-3 w-3 fill-current" />
          </motion.div>
        </div>
      </div>
    </motion.button>
  )
}
