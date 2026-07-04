'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Clock,
  Music,
  Users,
  Zap,
  MessageSquare,
  ChevronDown,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Song } from '@/lib/use-setlist-storage'

interface TransitionCue {
  id: string
  type: 'SPEAKING' | 'PRAYER' | 'INSTRUMENTAL' | 'COUNTDOWN' | 'SPONTANEOUS' | 'NOTE'
  text: string
  duration?: number // in seconds
  timestamp?: number // position in song in seconds
}

interface SongTransitionEditorProps {
  song: Song
  onUpdate: (updatedSong: Song) => void
  isOpen: boolean
  onClose: () => void
}

const TRANSITION_TYPES = [
  { id: 'SPEAKING', label: 'Speaking Cue', icon: MessageSquare, color: 'text-blue-400' },
  { id: 'PRAYER', label: 'Prayer Moment', icon: Users, color: 'text-purple-400' },
  { id: 'INSTRUMENTAL', label: 'Instrumental', icon: Music, color: 'text-amber-400' },
  { id: 'COUNTDOWN', label: 'Countdown', icon: Clock, color: 'text-red-400' },
  { id: 'SPONTANEOUS', label: 'Spontaneous', icon: Zap, color: 'text-yellow-400' },
  { id: 'NOTE', label: 'General Note', icon: MessageSquare, color: 'text-slate-400' },
]

export function SongTransitionEditor({
  song,
  onUpdate,
  isOpen,
  onClose,
}: SongTransitionEditorProps) {
  const [cues, setCues] = useState<TransitionCue[]>([
    ...(song.speakingCues ? [{ id: '1', type: 'SPEAKING' as const, text: song.speakingCues }] : []),
    ...(song.prayerMoment ? [{ id: '2', type: 'PRAYER' as const, text: 'Prayer moment', duration: 60 }] : []),
    ...(song.transitionNotes ? [{ id: '3', type: 'NOTE' as const, text: song.transitionNotes }] : []),
    ...(song.countdownTimer ? [{ id: '4', type: 'COUNTDOWN' as const, duration: song.countdownTimer }] : []),
  ])

  const [newCue, setNewCue] = useState<Partial<TransitionCue>>({ type: 'NOTE' })
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleAddCue = () => {
    if (!newCue.text && newCue.type !== 'COUNTDOWN') return

    const cueToAdd: TransitionCue = {
      id: `cue-${Date.now()}`,
      type: newCue.type as TransitionCue['type'],
      text: newCue.text || '',
      duration: newCue.duration,
      timestamp: newCue.timestamp,
    }

    setCues([...cues, cueToAdd])
    setNewCue({ type: 'NOTE' })
  }

  const handleRemoveCue = (id: string) => {
    setCues(cues.filter(c => c.id !== id))
  }

  const handleSave = () => {
    const updatedSong: Song = {
      ...song,
      speakingCues: cues.find(c => c.type === 'SPEAKING')?.text,
      prayerMoment: cues.some(c => c.type === 'PRAYER'),
      transitionNotes: cues.find(c => c.type === 'NOTE')?.text,
      countdownTimer: cues.find(c => c.type === 'COUNTDOWN')?.duration,
      spontaneousMarker: cues.some(c => c.type === 'SPONTANEOUS'),
    }
    onUpdate(updatedSong)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700 p-6">
            <div>
              <h2 className="text-xl font-bold text-white">{song.title}</h2>
              <p className="text-sm text-slate-400">Configure transitions and cues</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Existing Cues */}
            {cues.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 uppercase mb-3">
                  Configured Cues
                </h3>
                <div className="space-y-2">
                  {cues.map((cue) => {
                    const typeConfig = TRANSITION_TYPES.find(t => t.id === cue.type)
                    const Icon = typeConfig?.icon || MessageSquare

                    return (
                      <motion.div
                        key={cue.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-start gap-3 rounded-lg bg-slate-700/30 border border-slate-600 p-3"
                      >
                        <Icon className={cn('h-5 w-5 mt-1 flex-shrink-0', typeConfig?.color)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-300 uppercase">
                            {typeConfig?.label}
                          </p>
                          {cue.text && (
                            <p className="text-sm text-slate-300 mt-1 break-words">{cue.text}</p>
                          )}
                          {cue.duration && (
                            <p className="text-xs text-slate-400 mt-1">
                              Duration: {cue.duration}s
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveCue(cue.id)}
                          className="p-2 hover:bg-slate-600 rounded transition-colors flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Add New Cue */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase mb-3">
                Add Transition Cue
              </h3>
              <div className="space-y-3">
                {/* Cue Type Selector */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {TRANSITION_TYPES.map((type) => {
                    const Icon = type.icon
                    const isSelected = newCue.type === type.id

                    return (
                      <motion.button
                        key={type.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setNewCue({ ...newCue, type: type.id as TransitionCue['type'] })}
                        className={cn(
                          'flex items-center gap-2 rounded-lg p-3 transition-all text-sm font-medium',
                          isSelected
                            ? 'bg-[#C09060] text-white ring-2 ring-[#C09060]/50'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden md:inline">{type.label}</span>
                      </motion.button>
                    )
                  })}
                </div>

                {/* Cue Details */}
                {newCue.type !== 'COUNTDOWN' && (
                  <textarea
                    placeholder="Enter transition details..."
                    value={newCue.text || ''}
                    onChange={(e) => setNewCue({ ...newCue, text: e.target.value })}
                    className="w-full p-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C09060]/50 resize-none"
                    rows={2}
                  />
                )}

                {newCue.type === 'COUNTDOWN' && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Duration (seconds)"
                      value={newCue.duration || ''}
                      onChange={(e) =>
                        setNewCue({ ...newCue, duration: parseInt(e.target.value) || 0 })
                      }
                      className="flex-1 p-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C09060]/50"
                    />
                  </div>
                )}

                {/* Add Button */}
                <button
                  onClick={handleAddCue}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#C09060]/20 text-[#C09060] hover:bg-[#C09060]/30 p-3 font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Cue
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-slate-700 p-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 rounded-lg bg-[#C09060] text-white hover:bg-[#B8860B] font-medium transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Save Transitions
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
