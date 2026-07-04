'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AppShell } from '@/components/app-shell'
import { Plus, GripVertical, X, Edit2, Music, Tag, ArrowLeft, Archive, Clock, Settings, Share2, Trash2, ChevronDown, Star, PencilIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SetlistSong {
  id: string
  title: string
  artist: string
  keyOverride?: string
  originalKey?: string
  position: number
}

interface Setlist {
  id: string
  title: string
  category: string
  songs: SetlistSong[]
  createdDate: string
  description?: string
}

interface AvailableSong {
  id: string
  title: string
  artist: string
  originalKey: string
}

const AVAILABLE_SONGS: AvailableSong[] = [
  { id: 's1', title: 'GOODNESS OF GOD', artist: 'Bethel Music', originalKey: 'G' },
  { id: 's2', title: 'LIVING WATERS', artist: 'Various', originalKey: 'D' },
  { id: 's3', title: 'GRACE ALONE', artist: 'Modern Hymn', originalKey: 'A' },
  { id: 's4', title: 'HOW GREAT IS OUR GOD', artist: 'Chris Tomlin', originalKey: 'C' },
  { id: 's5', title: 'WORTHY IS THE LAMB', artist: 'Traditional', originalKey: 'F' },
  { id: 's6', title: 'AMAZING GRACE', artist: 'Traditional', originalKey: 'G' },
  { id: 's7', title: 'JOY TO THE WORLD', artist: 'Isaac Watts', originalKey: 'D' },
]

const CATEGORIES = ['CHURCH', 'WORSHIP', 'YOUTH', 'SPECIAL EVENTS', 'ACOUSTIC', 'CONTEMPORARY']
const KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C#', 'D#', 'F#', 'G#', 'A#']

function SortableSongItem({ song, onRemove, onKeyChange, position }: { 
  song: SetlistSong
  onRemove: () => void
  onKeyChange: (key: string) => void
  position: number
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      className={cn(
        'flex items-center gap-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4 transition-all',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-[#C09060]'
      )}
    >
      {/* Drag Handle */}
      <motion.button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.95 }}
      >
        <GripVertical className="h-5 w-5" />
      </motion.button>

      {/* Position Indicator */}
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C09060]/20 text-xs font-bold text-[#C09060] flex-shrink-0">
        {position}
      </div>

      {/* Song Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate">{song.title}</p>
        <p className="text-xs text-slate-400">{song.artist}</p>
      </div>

      {/* Key Override */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <select
          value={song.keyOverride || song.originalKey || ''}
          onChange={(e) => onKeyChange(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-700/50 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-[#C09060] transition-all"
        >
          <option value="">{song.originalKey}</option>
          {KEYS.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
        {song.keyOverride && song.keyOverride !== song.originalKey && (
          <span className="text-xs font-bold text-amber-400">Override</span>
        )}
      </div>

      {/* Remove Button */}
      <motion.button
        onClick={onRemove}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.95 }}
        className="text-slate-400 hover:text-red-400 transition-colors flex-shrink-0"
      >
        <X className="h-5 w-5" />
      </motion.button>
    </motion.div>
  )
}

export default function SetlistsPage() {
  const [mode, setMode] = useState<'view' | 'create'>('view')
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [newSetlist, setNewSetlist] = useState({
    title: '',
    category: CATEGORIES[0],
    description: '',
    songs: [] as SetlistSong[],
  })
  const [filterMode, setFilterMode] = useState<'all' | 'reorder' | 'keys' | 'tags' | 'archive'>('all')
  const [showArchived, setShowArchived] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { distance: 8 }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleAddSong = (song: AvailableSong) => {
    const newSong: SetlistSong = {
      id: `${song.id}-${Date.now()}`,
      title: song.title,
      artist: song.artist,
      originalKey: song.originalKey,
      keyOverride: undefined,
      position: newSetlist.songs.length + 1,
    }
    setNewSetlist({
      ...newSetlist,
      songs: [...newSetlist.songs, newSong],
    })
    setShowAddSongModal(false)
  }

  const handleRemoveSong = (id: string) => {
    const filtered = newSetlist.songs.filter((s) => s.id !== id)
    const updated = filtered.map((s, idx) => ({
      ...s,
      position: idx + 1,
    }))
    setNewSetlist({
      ...newSetlist,
      songs: updated,
    })
  }

  const handleDragEnd = (event: any) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = newSetlist.songs.findIndex((s) => s.id === active.id)
      const newIndex = newSetlist.songs.findIndex((s) => s.id === over.id)

      const newSongs = arrayMove(newSetlist.songs, oldIndex, newIndex).map(
        (s, idx) => ({
          ...s,
          position: idx + 1,
        })
      )

      setNewSetlist({
        ...newSetlist,
        songs: newSongs,
      })
    }
  }

  const handleKeyChange = (songId: string, key: string) => {
    setNewSetlist({
      ...newSetlist,
      songs: newSetlist.songs.map((s) =>
        s.id === songId ? { ...s, keyOverride: key === s.originalKey ? undefined : key } : s
      ),
    })
  }

  const handleCreateSetlist = () => {
    if (!newSetlist.title.trim() || newSetlist.songs.length === 0) {
      return
    }

    const setlist: Setlist = {
      id: `setlist-${Date.now()}`,
      title: newSetlist.title,
      category: newSetlist.category,
      description: newSetlist.description,
      songs: newSetlist.songs,
      createdDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    }

    setSetlists([...setlists, setlist])
    setNewSetlist({
      title: '',
      category: CATEGORIES[0],
      description: '',
      songs: [],
    })
    setMode('view')
  }

  if (mode === 'create') {
    return (
      <AppShell>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950">
        <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center gap-4"
          >
            <motion.button
              onClick={() => setMode('view')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-lg border border-slate-600 bg-slate-700/50 p-3 text-slate-400 hover:bg-slate-600 hover:text-white transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <div>
              <h1 className="text-3xl font-bold text-white">Create New Setlist</h1>
              <p className="mt-1 text-sm text-slate-400">Add songs, set keys, and organize your worship flow</p>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Title Input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-white">Setlist Title</label>
              <input
                type="text"
                value={newSetlist.title}
                onChange={(e) => setNewSetlist({ ...newSetlist, title: e.target.value })}
                placeholder="e.g., Sunday Morning Worship"
                className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C09060] transition-all"
              />
            </div>

            {/* Category & Description */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">Category</label>
                <select
                  value={newSetlist.category}
                  onChange={(e) => setNewSetlist({ ...newSetlist, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#C09060] transition-all"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">Description (Optional)</label>
                <input
                  type="text"
                  value={newSetlist.description || ''}
                  onChange={(e) => setNewSetlist({ ...newSetlist, description: e.target.value })}
                  placeholder="Add notes about this setlist"
                  className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C09060] transition-all"
                />
              </div>
            </div>

            {/* Songs Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Songs</h2>
                  <p className="text-xs text-slate-400">Drag to reorder, click keys to override, remove with X</p>
                </div>
                <motion.button
                  onClick={() => setShowAddSongModal(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 rounded-lg bg-[#C09060] px-4 py-2 font-semibold text-white hover:bg-[#B8860B] transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Add Song
                </motion.button>
              </div>

              {/* Sortable Songs List */}
              {newSetlist.songs.length > 0 ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={newSetlist.songs.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <motion.div className="space-y-3">
                      <AnimatePresence>
                        {newSetlist.songs.map((song, idx) => (
                          <SortableSongItem
                            key={song.id}
                            song={song}
                            position={idx + 1}
                            onRemove={() => handleRemoveSong(song.id)}
                            onKeyChange={(key) => handleKeyChange(song.id, key)}
                          />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-600 bg-slate-800/30 p-8 text-center">
                  <Music className="mx-auto h-8 w-8 text-slate-500 mb-2" />
                  <p className="text-sm text-slate-400">No songs added yet. Click "Add Song" to get started.</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <motion.button
                onClick={() => setMode('view')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800/50 py-3 font-semibold text-white hover:bg-slate-700 transition-all"
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={handleCreateSetlist}
                disabled={!newSetlist.title.trim() || newSetlist.songs.length === 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 rounded-lg bg-[#C09060] py-3 font-semibold text-white hover:bg-[#B8860B] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Create Setlist
              </motion.button>
            </div>
          </motion.div>

          {/* Add Song Modal */}
          <AnimatePresence>
            {showAddSongModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAddSongModal(false)}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6"
                >
                  <h3 className="mb-4 text-lg font-bold text-white">Add Song to Setlist</h3>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {AVAILABLE_SONGS.map((song) => (
                      <motion.button
                        key={song.id}
                        onClick={() => handleAddSong(song)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full text-left rounded-lg border border-slate-600 bg-slate-700/50 p-4 hover:bg-slate-700 transition-all"
                      >
                        <p className="font-semibold text-white">{song.title}</p>
                        <p className="text-xs text-slate-400 flex gap-2 items-center mt-1">
                          <span>{song.artist}</span>
                          <span className="text-[#C09060] font-semibold">{song.originalKey}</span>
                        </p>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>
      </AppShell>
    )
  }

  // View mode
  const archivedSetlists = setlists.filter(s => s.description?.includes('ARCHIVED'))
  const activeSetlists = setlists.filter(s => !s.description?.includes('ARCHIVED'))

  return (
    <AppShell>
      <div className="flex h-full bg-gradient-to-br from-slate-900 to-slate-950">
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl px-6 py-8">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 flex items-center justify-between"
            >
              <div>
                <h1 className="text-4xl font-bold text-white tracking-tight">SETLISTS</h1>
                <p className="mt-2 text-sm text-slate-400">Organize, arrange and prepare your worship setlists.</p>
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={() => setShowArchived(!showArchived)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-all"
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </motion.button>
                <motion.button
                  onClick={() => setMode('create')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 rounded-lg bg-[#C09060] px-6 py-2 font-semibold text-white hover:bg-[#B8860B] transition-all"
                >
                  <Plus className="h-5 w-5" />
                  NEW SETLIST
                </motion.button>
              </div>
            </motion.div>

            {/* Filter Tabs */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-8 flex items-center gap-2 border-b border-slate-700 pb-4"
            >
              {[
                { id: 'all', label: 'Reorder', icon: GripVertical, desc: 'Drag to reorder' },
                { id: 'keys', label: 'Override Keys', icon: Settings, desc: 'Override any range' },
                { id: 'tags', label: 'Tags', icon: Tag, desc: 'Tag categories' },
                { id: 'archive', label: 'Archive', icon: Archive, desc: 'View archived setlists' },
              ].map((filter) => (
                <motion.button
                  key={filter.id}
                  onClick={() => setFilterMode(filter.id as any)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all',
                    filterMode === filter.id
                      ? 'bg-slate-700 text-[#C09060]'
                      : 'text-slate-400 hover:text-slate-300'
                  )}
                >
                  <filter.icon className="h-4 w-4" />
                  <div className="text-left">
                    <div>{filter.label}</div>
                    <div className="text-xs text-slate-500 font-normal">{filter.desc}</div>
                  </div>
                </motion.button>
              ))}
            </motion.div>

            {/* Active Setlists */}
            {activeSetlists.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
              >
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">ACTIVE SETLISTS <span className="text-[#C09060]">{activeSetlists.length}</span></h2>
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                      <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                      </svg>
                    </button>
                    <button className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                      <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>

                <motion.div
                  className="grid grid-cols-1 gap-4 md:grid-cols-3"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.05 },
                    },
                  }}
                  initial="hidden"
                  animate="visible"
                >
                  {activeSetlists.map((setlist, idx) => (
                    <motion.div
                      key={setlist.id}
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0 },
                      }}
                      className="group rounded-xl border border-slate-700 bg-slate-800/50 p-6 hover:border-[#C09060]/50 hover:bg-slate-800 transition-all"
                    >
                      {/* Card Header */}
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            READY
                          </span>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          className="text-slate-400 hover:text-[#C09060] transition-colors"
                        >
                          <Star className="h-5 w-5" />
                        </motion.button>
                      </div>

                      {/* Title */}
                      <h3 className="mb-4 text-lg font-bold text-white uppercase">{setlist.title}</h3>

                      {/* Metrics */}
                      <div className="mb-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-slate-400">
                            <Clock className="h-4 w-4" />
                            Duration
                          </span>
                          <span className="font-semibold text-white">28:00</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-slate-400">
                            <Music className="h-4 w-4" />
                            Songs
                          </span>
                          <span className="font-semibold text-white">{setlist.songs.length}</span>
                        </div>
                      </div>

                      {/* Key Range */}
                      <div className="mb-4 rounded-lg bg-slate-900/50 p-3">
                        <p className="text-xs text-slate-500 font-semibold mb-1">KEY RANGE</p>
                        <p className="font-semibold text-white">D → G</p>
                        <p className="text-xs text-slate-400 mt-1">FLOW 85%</p>
                      </div>

                      {/* Tags */}
                      <div className="mb-4 flex flex-wrap gap-2">
                        {['WORSHIP', 'PRAISE', 'CONTEMPORARY'].map((tag) => (
                          <span key={tag} className="inline-flex rounded-full bg-slate-700/50 px-3 py-1 text-xs font-semibold text-slate-300">
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Performers */}
                      <div className="mb-4 pb-4 border-t border-slate-700 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500 font-semibold">Lead Vocal / Instruments</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="inline-flex rounded-full bg-[#C09060]/20 px-2 py-1 text-xs font-semibold text-[#C09060]">
                            Church
                          </span>
                          <span className="inline-flex rounded-full bg-slate-700/50 px-2 py-1 text-xs font-semibold text-slate-300">
                            Michael T.
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/songs?editSongId=${song.id}`}>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-700/30 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700/50 transition-all"
                            title="Edit lyrics"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                            Edit
                          </motion.button>
                        </Link>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="rounded-lg border border-slate-600 bg-slate-700/30 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700/50 transition-all"
                        >
                          <Archive className="h-4 w-4" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="rounded-lg border border-red-900/50 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border border-dashed border-slate-700 bg-slate-800/30 p-12 text-center"
              >
                <Music className="mx-auto h-12 w-12 text-slate-600 mb-4" />
                <h2 className="text-lg font-semibold text-white mb-2">No active setlists</h2>
                <p className="text-sm text-slate-400 mb-6">Create your first setlist to get started</p>
                <motion.button
                  onClick={() => setMode('create')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#C09060] px-6 py-3 font-semibold text-white hover:bg-[#B8860B] transition-all"
                >
                  <Plus className="h-5 w-5" />
                  Create Your First Setlist
                </motion.button>
              </motion.div>
            )}

            {/* Drag & Drop Hint */}
            {activeSetlists.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-12 rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/30 p-8 text-center"
              >
                <GripVertical className="mx-auto h-8 w-8 text-slate-600 mb-3" />
                <p className="text-slate-400">
                  DRAG & DROP TO REORDER SETLISTS
                </p>
                <p className="mt-1 text-xs text-slate-500">Changes are saved automatically</p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Archived Setlists */}
        {showArchived && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-80 border-l border-slate-700 bg-slate-900 p-6 overflow-auto"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">ARCHIVED SETLISTS</h2>
              <motion.button
                onClick={() => setShowArchived(false)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="text-slate-400 hover:text-slate-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            <div className="space-y-4">
              {['MAY 2024', 'APRIL 2024', 'MARCH 2024', 'FEBRUARY 2024'].map((month) => (
                <motion.div key={month} className="space-y-2">
                  <button className="flex items-center justify-between w-full text-sm font-semibold text-slate-400 hover:text-slate-300 transition-colors">
                    <span>{month}</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  
                  <div className="space-y-2 pl-2">
                    {['EVENING SERVICE', 'YOUTH WORSHIP NIGHT', 'GOOD FRIDAY SERVICE', 'EASTER SUNDAY', 'ACOUSTIC WORSHIP'].slice(0, 2).map((setlist) => (
                      <motion.div
                        key={setlist}
                        whileHover={{ x: 4 }}
                        className="flex items-center justify-between rounded-lg bg-slate-800/50 p-2 text-xs hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="text-slate-300 font-semibold">{setlist}</p>
                          <p className="text-slate-500 text-xs">May 12, 2024 • 3 songs</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                          <button className="text-slate-400 hover:text-emerald-400 transition-colors">
                            <Share2 className="h-3.5 w-3.5" />
                          </button>
                          <button className="text-slate-400 hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.button
              className="mt-6 w-full rounded-lg border border-slate-600 bg-slate-700/30 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700/50 transition-all text-center"
            >
              View All Archived
            </motion.button>
          </motion.div>
        )}
      </div>
    </AppShell>
  )
}
