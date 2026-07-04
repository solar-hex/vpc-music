'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Minus,
  Music,
  Hash,
  Gauge,
  Settings,
  Copy,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { transposeKey, calculateSemitones, getCapoPosition, suggestCapoOptions, convertToNashvilleNumbers } from '@/lib/setlist-helpers'
import type { Song } from '@/lib/use-setlist-storage'

interface SongToolsProps {
  song: Song
  onUpdate: (updatedSong: Song) => void
  isOpen: boolean
  onClose: () => void
}

type ArrangementType = 'ACOUSTIC' | 'ELECTRIC' | 'FULL_BAND' | 'STRIPPED_DOWN'

const ARRANGEMENT_TYPES: Array<{ id: ArrangementType; label: string; description: string }> = [
  {
    id: 'ACOUSTIC',
    label: 'Acoustic',
    description: 'Stripped down acoustic arrangement',
  },
  {
    id: 'ELECTRIC',
    label: 'Electric',
    description: 'Full electric band arrangement',
  },
  {
    id: 'FULL_BAND',
    label: 'Full Band',
    description: 'Complete worship band setup',
  },
  {
    id: 'STRIPPED_DOWN',
    label: 'Stripped Down',
    description: 'Minimal instrumental arrangement',
  },
]

const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function AdvancedSongTools({
  song,
  onUpdate,
  isOpen,
  onClose,
}: SongToolsProps) {
  const [transpositionSemitones, setTranspositionSemitones] = useState(0)
  const [showNashville, setShowNashville] = useState(false)
  const [selectedArrangement, setSelectedArrangement] = useState<ArrangementType>(song.arrangement || 'FULL_BAND')
  const [useCapoSuggestion, setUseCapoSuggestion] = useState(false)

  const originalKey = song.originalKey
  const currentKey = song.keyOverride || originalKey
  const transposedKey = transposeKey(currentKey, transpositionSemitones)
  const capoOptions = suggestCapoOptions(originalKey, transposedKey)

  const handleTranspose = (semitones: number) => {
    const newKey = transposeKey(currentKey, semitones)
    const updatedSong: Song = {
      ...song,
      keyOverride: newKey,
    }
    onUpdate(updatedSong)
    setTranspositionSemitones(0)
  }

  const handleQuickTranspose = (semitones: number) => {
    setTranspositionSemitones(semitones)
  }

  const handleApplyArrangement = () => {
    const updatedSong: Song = {
      ...song,
      arrangement: selectedArrangement,
    }
    onUpdate(updatedSong)
  }

  const handleApplyCapo = () => {
    if (useCapoSuggestion && capoOptions.length > 0) {
      const bestOption = capoOptions[0]
      const updatedSong: Song = {
        ...song,
        keyOverride: bestOption.resultingKey,
        capo: bestOption.capo,
      }
      onUpdate(updatedSong)
    }
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
          className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-700 bg-slate-800 p-6 z-10">
            <div>
              <h2 className="text-xl font-bold text-white">{song.title}</h2>
              <p className="text-sm text-slate-400">Advanced Music Tools</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-8">
            {/* Key Transposition */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Music className="h-5 w-5 text-[#C09060]" />
                <h3 className="text-lg font-semibold text-white">Key Transposition</h3>
              </div>

              {/* Current Key Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-slate-700/30 border border-slate-600 p-4">
                  <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Original Key</p>
                  <p className="text-3xl font-bold text-white">{originalKey}</p>
                </div>
                <div className="rounded-lg bg-slate-700/30 border border-slate-600 p-4">
                  <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Current Key</p>
                  <p className="text-3xl font-bold text-[#C09060]">{currentKey}</p>
                </div>
              </div>

              {/* Quick Transpose Buttons */}
              <div>
                <p className="text-sm text-slate-400 mb-3">Quick Transpose</p>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {[-5, -3, -1, 1, 3, 5].map(semitones => (
                    <motion.button
                      key={semitones}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTranspose(semitones)}
                      className={cn(
                        'flex items-center justify-center gap-1 rounded-lg px-3 py-2 font-semibold transition-all text-sm',
                        semitones > 0
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                      )}
                    >
                      {semitones > 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownLeft className="h-3 w-3" />
                      )}
                      {Math.abs(semitones)}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Transpose Preview */}
              {transpositionSemitones !== 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-slate-700/30 border border-slate-600 p-4"
                >
                  <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Preview</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs text-slate-500">From</p>
                      <p className="text-xl font-bold text-white">{currentKey}</p>
                    </div>
                    <div className="flex items-center justify-center">
                      <ArrowUpRight className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">To</p>
                      <p className="text-xl font-bold text-emerald-400">{transposedKey}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleTranspose(transpositionSemitones)}
                    className="w-full mt-3 px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-semibold transition-colors"
                  >
                    Apply Transposition
                  </button>
                </motion.div>
              )}

              {/* Capo Suggestions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Capo Suggestions</p>
                  <input
                    type="checkbox"
                    checked={useCapoSuggestion}
                    onChange={(e) => setUseCapoSuggestion(e.target.checked)}
                    className="rounded"
                  />
                </div>

                <div className="space-y-2">
                  {capoOptions.map((option, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        'p-3 rounded-lg border transition-all cursor-pointer',
                        useCapoSuggestion
                          ? 'bg-purple-500/20 border-purple-500/30'
                          : 'bg-slate-700/30 border-slate-600'
                      )}
                      onClick={() => setUseCapoSuggestion(true)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-white">Capo {option.capo}</p>
                          <p className="text-xs text-slate-400">
                            {option.resultingKey} ({option.difficulty})
                          </p>
                        </div>
                        {useCapoSuggestion && (
                          <CheckCircle className="h-5 w-5 text-purple-400" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {useCapoSuggestion && (
                  <button
                    onClick={handleApplyCapo}
                    className="w-full px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 font-semibold transition-colors"
                  >
                    Apply Capo Suggestion
                  </button>
                )}
              </div>
            </div>

            {/* Arrangement Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-[#C09060]" />
                <h3 className="text-lg font-semibold text-white">Arrangement Type</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {ARRANGEMENT_TYPES.map(type => (
                  <motion.button
                    key={type.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedArrangement(type.id)}
                    className={cn(
                      'p-4 rounded-lg border-2 transition-all text-center',
                      selectedArrangement === type.id
                        ? 'border-[#C09060] bg-[#C09060]/10'
                        : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                    )}
                  >
                    <p className="font-semibold text-white">{type.label}</p>
                    <p className="text-xs text-slate-400 mt-1">{type.description}</p>
                  </motion.button>
                ))}
              </div>

              <button
                onClick={handleApplyArrangement}
                className="w-full px-4 py-2 rounded-lg bg-[#C09060]/20 text-[#C09060] hover:bg-[#C09060]/30 font-semibold transition-colors"
              >
                Apply Arrangement
              </button>
            </div>

            {/* Nashville Numbers */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-[#C09060]" />
                <h3 className="text-lg font-semibold text-white">Nashville Number System</h3>
              </div>

              <div className="rounded-lg bg-slate-700/30 border border-slate-600 p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showNashville}
                    onChange={(e) => setShowNashville(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-white font-medium">
                    Use Nashville Number notation
                  </span>
                </label>
                <p className="text-xs text-slate-400 mt-3">
                  Replace standard chord notation with numerical notation based on the song key
                </p>
              </div>

              {showNashville && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-slate-700/30 border border-slate-600 p-4"
                >
                  <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Example Conversion</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Standard</p>
                      <p className="font-mono text-sm text-white">{currentKey} | {currentKey}m | {currentKey}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Nashville</p>
                      <p className="font-mono text-sm text-[#C09060]">1 | 1m | 1</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Time Signature & BPM */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-[#C09060]" />
                <h3 className="text-lg font-semibold text-white">Musical Details</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-slate-700/30 border border-slate-600 p-4">
                  <label className="block text-xs text-slate-400 uppercase font-semibold mb-2">
                    Time Signature
                  </label>
                  <p className="text-2xl font-bold text-white">{song.timeSignature || '4/4'}</p>
                </div>
                <div className="rounded-lg bg-slate-700/30 border border-slate-600 p-4">
                  <label className="block text-xs text-slate-400 uppercase font-semibold mb-2">
                    BPM
                  </label>
                  <p className="text-2xl font-bold text-white">{song.bpm || '--'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex gap-3 border-t border-slate-700 bg-slate-800 p-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/50 font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
