'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Music, Tag, X, Edit, Trash2, Share2, Copy, Download, GripVertical, Check, Clock, Zap, TrendingUp, Users, RotateCcw, Archive, FileText, CalendarDays, BarChart3, Send, MapPin, ExternalLink, Settings, Lock, Unlock, Star, MoreVertical, Wand2, Palette, Search, Bell, BarChart2, Activity, Gauge, Volume2, ChevronRight, FileText as FileTextIcon, Mic, Move, FileJson, Layers } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useSetlistStorage, type Setlist, type Song } from '@/lib/use-setlist-storage'
import { AppShell } from '@/components/app-shell'

const CATEGORIES = ['CHURCH', 'WORSHIP', 'YOUTH', 'SPECIAL EVENTS', 'ACOUSTIC', 'CONTEMPORARY']
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const TAGS = ['Worship', 'Praise', 'Communion', 'Altar Call', 'Contemporary', 'Traditional', 'Upbeat', 'Reflective']

export default function SetlistHub() {
  const router = useRouter()
  const { setlists, createSetlist, updateSetlist, deleteSetlist, archiveSetlist, restoreArchived, permanentlyDeleteArchived } = useSetlistStorage()
  
  // State
  const [isDetailView, setIsDetailView] = useState(false)
  const [editingSetlist, setEditingSetlist] = useState<Setlist | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [activeView, setActiveView] = useState<'grid' | 'create' | 'edit' | 'archive'>('grid')
  const [newSetlistTitle, setNewSetlistTitle] = useState('')
  const [newSetlistCategory, setNewSetlistCategory] = useState('CHURCH')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'edited' | 'upcoming' | 'alphabetical' | 'usage' | 'duration'>('edited')
  const [showNotificationCenter, setShowNotificationCenter] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showArchivedSidebar, setShowArchivedSidebar] = useState(false)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set(['MAY 2024', 'APRIL 2024']))
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [undoNotification, setUndoNotification] = useState<{
    id: string
    message: string
    type: 'archive' | 'delete'
    timestamp: number
  } | null>(null)
  
  const handleBackToGrid = () => {
    setActiveView('grid')
    setEditingSetlist(null)
    setIsCreateModalOpen(false)
  }
  
  const undoTimeoutRef = useCallback((id: string, type: 'archive' | 'delete') => {
    return setTimeout(() => {
      setUndoNotification(null)
    }, 5000)
  }, [])

  // Filter and sort logic
  const activeSetlists = setlists.filter(sl => !sl.isArchived)
  const archivedSetlists = setlists.filter(sl => sl.isArchived)

  // Utility function to format date for grouping
  const getDateGroup = (date: string) => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    if (d.getTime() > today.getTime() - 7 * 24 * 60 * 60 * 1000) return 'This Week'
    if (d.getTime() > today.getTime() - 30 * 24 * 60 * 60 * 1000) return 'This Month'
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  // Group archived setlists by date
  const groupedArchivedSetlists = useCallback(() => {
    const groups: { [key: string]: Setlist[] } = {}
    const dateOrder = ['Today', 'Yesterday', 'This Week', 'This Month']
    
    archivedSetlists.forEach((setlist) => {
      const group = getDateGroup(setlist.modifiedDate || setlist.createdDate)
      if (!groups[group]) {
        groups[group] = []
      }
      groups[group].push(setlist)
    })

    // Sort groups
    const sortedGroups = Object.entries(groups).sort((a, b) => {
      const aIndex = dateOrder.indexOf(a[0])
      const bIndex = dateOrder.indexOf(b[0])
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return b[0].localeCompare(a[0])
    })

    return sortedGroups
  }, [archivedSetlists])

  const filteredSetlists = activeSetlists.filter(sl => {
    const searchLower = searchQuery.toLowerCase()
    return (
      sl.title.toLowerCase().includes(searchLower) ||
      sl.category.toLowerCase().includes(searchLower) ||
      sl.leader.toLowerCase().includes(searchLower)
    )
  })

  const sortedSetlists = [...filteredSetlists].sort((a, b) => {
    switch (sortBy) {
      case 'edited':
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
      case 'alphabetical':
        return a.title.localeCompare(b.title)
      case 'duration':
        return (b.totalDuration || 0) - (a.totalDuration || 0)
      case 'usage':
        return (b.performanceCount || 0) - (a.performanceCount || 0)
      case 'upcoming':
        return (a.eventDate || '').localeCompare(b.eventDate || '')
      default:
        return 0
    }
  })

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 },
    },
  }

  const handleCreateSetlist = () => {
    if (newSetlistTitle.trim()) {
      const newSetlist: Setlist = {
        id: `setlist-${Date.now()}`,
        title: newSetlistTitle,
        category: newSetlistCategory,
        leader: 'Worship Team',
        songs: [],
        keyRange: 'C → A',
        flowScore: 85,
        status: 'READY',
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalDuration: 0,
        performanceCount: 0,
        isArchived: false,
      }
      createSetlist(newSetlist)
      setNewSetlistTitle('')
      setNewSetlistCategory('CHURCH')
      setIsCreateModalOpen(false)
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <AnimatePresence>
              {activeView !== 'grid' && (
                <motion.button
                  onClick={handleBackToGrid}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  whileHover={{ scale: 1.1, x: -4 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center justify-center h-10 w-10 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-600 hover:border-[#C09060]/40"
                  title="Back to setlists"
                >
                  <ArrowLeft className="h-5 w-5 text-slate-300" />
                </motion.button>
              )}
            </AnimatePresence>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">
                {activeView === 'create' ? 'Create Setlist' : activeView === 'edit' ? 'Edit Setlist' : activeView === 'archive' ? 'Archived Setlists' : 'Setlists'}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {activeView === 'create' ? 'Create a new worship setlist for your next service.' : activeView === 'edit' ? 'Edit your setlist details and songs.' : activeView === 'archive' ? 'Manage your archived setlists.' : 'Organize, arrange and prepare your worship setlists.'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <AnimatePresence>
              {activeView === 'grid' && (
                <>
                  <motion.button
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onClick={() => setActiveView('archive')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                  >
                    <Archive className="h-4 w-4" />
                    Archive
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onClick={() => setActiveView('create')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#C09060] to-[#B8860B] px-4 py-2 text-sm font-bold text-white hover:from-[#B8860B] hover:to-[#A0722E] transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    New Setlist
                  </motion.button>
                </>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

      {/* Quick Action Toolbar - Only show in grid view */}
      <AnimatePresence>
        {activeView === 'grid' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.1 }}
            className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
          >
        {[
          { icon: GripVertical, label: 'Reorder', desc: 'Drag to reorder', color: 'blue' },
          { icon: Music, label: 'Override Keys', desc: 'Override key range', color: 'purple' },
          { icon: Palette, label: 'Tags', desc: 'Tag categories', color: 'pink' },
          { icon: BarChart2, label: 'Analytics', desc: 'View insights', color: 'green' },
        ].map((action, idx) => (
          <motion.div
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + idx * 0.05 }}
            whileHover={{ y: -4 }}
            className={cn(
              'rounded-xl border p-4 cursor-pointer transition-all',
              action.color === 'blue' && 'border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20',
              action.color === 'purple' && 'border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20',
              action.color === 'pink' && 'border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/20',
              action.color === 'green' && 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20'
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <action.icon className={cn(
                'h-5 w-5',
                action.color === 'blue' && 'text-blue-400',
                action.color === 'purple' && 'text-purple-400',
                action.color === 'pink' && 'text-pink-400',
                action.color === 'green' && 'text-emerald-400'
              )} />
              <span className="font-bold text-white">{action.label}</span>
            </div>
            <p className="text-xs text-slate-400">{action.desc}</p>
          </motion.div>
        ))}
      </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Sort Bar - Only show in grid view */}
      <AnimatePresence>
        {activeView === 'grid' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
          >
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search setlists, songs, leaders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-800/50 pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:border-[#C09060] focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-[#C09060] focus:outline-none transition-colors"
          >
            <option value="edited">Recently Edited</option>
            <option value="upcoming">Upcoming Service</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="usage">Most Used</option>
            <option value="duration">Longest</option>
          </select>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors text-slate-300 hover:text-white"
            title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
          >
            {viewMode === 'grid' ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotificationCenter(!showNotificationCenter)}
            className="relative p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors text-slate-300 hover:text-white"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
          </motion.button>
        </div>
      </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content - Grid View */}
      <AnimatePresence>
        {activeView === 'grid' && (
          <div className="flex gap-6">
        {/* Left Side - Active Setlists */}
        <div className="flex-1">
          {/* Active Setlists Header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mb-6 flex items-center justify-between"
          >
            <h2 className="text-xl font-bold text-white">
              ACTIVE SETLISTS <span className="text-[#C09060]">{activeSetlists.length}</span>
            </h2>
          </motion.div>

          {/* Setlist Grid/List */}
          <motion.div
            className={cn(
              viewMode === 'grid' ? 'grid gap-6 md:grid-cols-2 lg:grid-cols-3' : 'space-y-4'
            )}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {sortedSetlists.length > 0 ? (
              sortedSetlists.map((setlist, idx) => (
                <motion.div
                  key={setlist.id}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{ 
                    y: -6,
                    boxShadow: "0 20px 40px rgba(192, 144, 96, 0.15)"
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                    delay: idx * 0.05,
                  }}
                  className="rounded-xl border border-slate-600 bg-slate-800/30 p-4 backdrop-blur transition-all hover:border-[#C09060]/40 hover:bg-slate-800/50 group"
                >
                  {/* Card Header */}
                  <div className="mb-4 flex items-start justify-between">
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider',
                      setlist.status === 'READY' && 'bg-green-500/20 text-green-400',
                      setlist.status === 'MISSING_CHORDS' && 'bg-amber-500/20 text-amber-400',
                      setlist.status === 'SYNCED' && 'bg-blue-500/20 text-blue-400'
                    )}>
                      {setlist.status === 'READY' && <Check className="h-3 w-3" />}
                      {setlist.status?.replace('_', ' ')}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        className="text-slate-400 hover:text-[#C09060] transition-colors"
                        title="Add to favorites"
                      >
                        <Star className="h-5 w-5 fill-none" />
                      </motion.button>
                      <motion.button
                        onClick={() => setOpenMenuId(openMenuId === setlist.id ? null : setlist.id)}
                        whileHover={{ scale: 1.1 }}
                        className="relative text-slate-400 hover:text-slate-300 transition-colors p-1"
                        title="More options"
                      >
                        <MoreVertical className="h-5 w-5" />
                        
                        <AnimatePresence>
                          {openMenuId === setlist.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.92, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.92, y: -10 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                              className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-slate-600 bg-slate-900/95 backdrop-blur shadow-xl z-50"
                            >
                              <motion.div 
                                className="py-1"
                                variants={{
                                  visible: {
                                    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
                                  },
                                }}
                                animate="visible"
                              >
                                {[
                                  { icon: Edit, label: 'Edit Lyrics', action: () => console.log('Edit Lyrics') },
                                  { icon: Music, label: 'Edit Chords', action: () => console.log('Edit Chords') },
                                  { icon: FileTextIcon, label: 'Presenter Notes', action: () => console.log('Presenter Notes') },
                                  { icon: Copy, label: 'Duplicate Setlist', action: () => console.log('Duplicate') },
                                  { icon: Move, label: 'Move to Another Set', action: () => console.log('Move') },
                                  { icon: Download, label: 'Export', action: () => console.log('Export') },
                                  { 
                                    icon: Archive, 
                                    label: 'Archive', 
                                    action: () => {
                                      archiveSetlist(setlist.id)
                                      setUndoNotification({
                                        id: setlist.id,
                                        message: `${setlist.title} archived`,
                                        type: 'archive',
                                        timestamp: Date.now(),
                                      })
                                      undoTimeoutRef(setlist.id, 'archive')
                                    }
                                  },
                                  { 
                                    icon: Trash2, 
                                    label: 'Delete', 
                                    action: () => {
                                      deleteSetlist(setlist.id)
                                      setUndoNotification({
                                        id: setlist.id,
                                        message: `${setlist.title} deleted`,
                                        type: 'delete',
                                        timestamp: Date.now(),
                                      })
                                      undoTimeoutRef(setlist.id, 'delete')
                                    }
                                  },
                                ].map((item, itemIdx) => (
                                  <motion.button
                                    key={item.label}
                                    onClick={() => {
                                      item.action()
                                      setOpenMenuId(null)
                                    }}
                                    variants={{
                                      hidden: { opacity: 0, x: -10 },
                                      visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
                                    }}
                                    initial="hidden"
                                    animate="visible"
                                    whileHover={{ 
                                      backgroundColor: 'rgba(100, 116, 139, 0.3)',
                                      x: 2,
                                    }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors group"
                                  >
                                    <item.icon className={cn(
                                      'h-4 w-4 transition-colors',
                                      itemIdx === 7 ? 'text-red-400 group-hover:text-red-300' : 'text-slate-400 group-hover:text-slate-300'
                                    )} />
                                    <span>{item.label}</span>
                                  </motion.button>
                                ))}
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="mb-4">
                    <h3 className="text-lg font-black text-white leading-tight mb-3 uppercase tracking-wide">{setlist.title}</h3>

                    {/* Metrics Grid - 2x2 with Staggered Animation */}
                    <motion.div 
                      className="grid grid-cols-2 gap-2 mb-4"
                      variants={{
                        hidden: { opacity: 0 },
                        visible: {
                          opacity: 1,
                          transition: {
                            staggerChildren: 0.05,
                            delayChildren: 0.1,
                          },
                        },
                      }}
                      initial="hidden"
                      animate="visible"
                    >
                      {[
                        { label: 'Duration', icon: Clock, value: `${String(Math.floor(setlist.totalDuration / 60)).padStart(2, '0')}:00`, color: 'text-slate-400' },
                        { label: 'Songs', icon: Music, value: `${setlist.songs.length}`, color: 'text-slate-400' },
                        { label: 'Key Range', icon: null, value: `${setlist.keyRange || 'N/A'}`, color: 'text-slate-400' },
                        { label: 'Flow', icon: null, value: `${setlist.flowScore}%`, color: 'text-emerald-400' },
                      ].map((metric, metricIdx) => (
                        <motion.div
                          key={metric.label}
                          variants={{
                            hidden: { opacity: 0, y: 10 },
                            visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
                          }}
                          className="rounded border border-slate-600 bg-slate-700/40 px-2 py-1.5 hover:border-[#C09060]/40 transition-colors"
                        >
                          <p className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">{metric.label}</p>
                          <div className="flex items-baseline gap-1">
                            {metric.icon && <metric.icon className="h-3 w-3 text-slate-400" />}
                            <p className={cn("text-xs font-bold", metric.color)}>{metric.value}</p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>

                    {/* Tags/Categories */}
                    {setlist.tags && setlist.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {setlist.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="inline-flex items-center rounded-full bg-purple-500/25 px-2 py-0.5 text-[9px] font-bold text-purple-300 uppercase tracking-wider">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Leader & Category Footer */}
                  <div className="border-t border-slate-600/50 pt-2.5 flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Music className="h-3 w-3 text-slate-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{setlist.category}</span>
                    </div>
                    <span className="text-[10px] font-bold text-[#C09060] uppercase tracking-wide">{setlist.leader}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-1.5">
                    <motion.button
                      onClick={() => setEditingSetlist(setlist)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-slate-700/60 px-2 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors uppercase"
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </motion.button>
                    <motion.button
                      onClick={() => archiveSetlist(setlist.id)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      title={setlist.archivedDate ? `Archived on ${new Date(setlist.archivedDate).toLocaleDateString()}` : 'Archive this setlist'}
                      className={`flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-colors uppercase ${
                        setlist.isArchived 
                          ? 'bg-amber-900/40 text-amber-300 hover:bg-amber-900/60 border border-amber-900/40' 
                          : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <Archive className="h-3 w-3" />
                      {setlist.isArchived ? 'Archived' : 'Archive'}
                      {setlist.archivedDate && (
                        <span className="text-[8px]">
                          {new Date(setlist.archivedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </motion.button>
                    <motion.button
                      onClick={() => deleteSetlist(setlist.id)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-red-900/40 px-2 py-1.5 text-[10px] font-bold text-red-400 hover:bg-red-900/60 border border-red-900/40 transition-colors uppercase"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </motion.button>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-full rounded-xl border border-dashed border-slate-600 bg-slate-800/30 p-12 text-center"
              >
                <Music className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  {searchQuery ? 'No setlists match your search' : 'No active setlists'}
                </h3>
                <p className="text-sm text-slate-400 mb-6">
                  {searchQuery 
                    ? 'Try adjusting your search terms'
                    : 'Create your first setlist to get started building your worship flow'
                  }
                </p>
                {!searchQuery && (
                  <motion.button
                    onClick={() => setIsCreateModalOpen(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#C09060] to-[#B8860B] px-8 py-3 font-bold text-white hover:from-[#B8860B] hover:to-[#A0722E] transition-all"
                  >
                    <Plus className="h-5 w-5" />
                    Create Your First Setlist
                  </motion.button>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Drag & Drop Hint */}
          {activeSetlists.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/30 p-8 text-center mt-12"
            >
              <GripVertical className="mx-auto h-8 w-8 text-slate-600 mb-3" />
              <p className="text-slate-400 font-semibold">DRAG & DROP TO REORDER SETLISTS</p>
              <p className="mt-1 text-xs text-slate-500">Changes are saved automatically</p>
            </motion.div>
          )}
        </div>

        {/* Right Sidebar - Archived Setlists */}
        <AnimatePresence>
          {showArchivedSidebar && (
            <motion.div
              initial={{ opacity: 0, x: 350 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 350 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-80 rounded-xl border border-slate-600 bg-slate-800/50 p-4 backdrop-blur max-h-[calc(100vh-200px)] overflow-y-auto shadow-lg"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">ARCHIVED SETLISTS</h2>
                <motion.button
                  onClick={() => setShowArchivedSidebar(false)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-slate-400 hover:text-slate-300 transition-colors"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              {/* Search Box */}
              <div className="mb-6 relative">
                <input
                  type="text"
                  placeholder="Search archived setlists..."
                  className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2 pl-10 text-sm text-white placeholder-slate-500 focus:border-[#C09060] focus:outline-none transition-colors"
                />
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>

              {archivedSetlists.length > 0 ? (
                <div className="space-y-4">
                  {['MAY 2024', 'APRIL 2024', 'MARCH 2024', 'FEBRUARY 2024'].map((monthGroup) => {
                    const monthSetlists = archivedSetlists.filter(s => s.createdDate?.includes(monthGroup.split(' ')[0]) || true)
                    if (monthSetlists.length === 0) return null
                    
                    const isExpanded = expandedMonths.has(monthGroup)
                    
                    return (
                      <motion.div key={monthGroup} className="space-y-2">
                        <motion.button
                          onClick={() => {
                            const newExpanded = new Set(expandedMonths)
                            if (isExpanded) {
                              newExpanded.delete(monthGroup)
                            } else {
                              newExpanded.add(monthGroup)
                            }
                            setExpandedMonths(newExpanded)
                          }}
                          className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-300 transition-colors uppercase tracking-wider"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          whileHover={{ paddingLeft: 8 }}
                        >
                          <div className="flex items-center gap-2">
                            <motion.div
                              animate={{ rotate: isExpanded ? 90 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronRight className="h-3 w-3" />
                            </motion.div>
                            <span>{monthGroup}</span>
                          </div>
                          <span className="text-[10px] font-bold text-[#C09060] bg-slate-700/40 px-1.5 py-0.5 rounded">{monthSetlists.length}</span>
                        </motion.button>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-2 pl-2 border-l border-slate-700"
                            >
                              {monthSetlists.map((setlist) => (
                                <motion.div
                                  key={setlist.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -10 }}
                                  whileHover={{ x: 4 }}
                                  className="flex items-start justify-between rounded-lg bg-slate-800/50 p-2.5 hover:bg-slate-800 transition-colors cursor-pointer group"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-300 truncate uppercase tracking-wide">{setlist.title}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                      {setlist.createdAt ? new Date(setlist.createdAt).toLocaleDateString() : ''} • {setlist.songs.length} song{setlist.songs.length !== 1 ? 's' : ''}
                                    </p>
                                    {setlist.category && (
                                      <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold mt-1">{setlist.category}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2 transition-opacity">
                                    <motion.button
                                      onClick={() => restoreArchived(setlist.id)}
                                      whileHover={{ scale: 1.15 }}
                                      whileTap={{ scale: 0.9 }}
                                      className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-700/50 transition-colors"
                                      title="Restore"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                    </motion.button>
                                    <motion.button
                                      onClick={() => permanentlyDeleteArchived(setlist.id)}
                                      whileHover={{ scale: 1.15 }}
                                      whileTap={{ scale: 0.9 }}
                                      className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </motion.button>
                                  </div>
                                </motion.div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}

                  {/* View All Archived Link */}
                  <div className="mt-6 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Can't find a setlist?</span>
                    <motion.button
                      className="font-semibold text-[#C09060] hover:text-[#B8860B] transition-colors flex items-center gap-1"
                      whileHover={{ x: 2 }}
                    >
                      View All Archived
                      <ExternalLink className="h-3 w-3" />
                    </motion.button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">No archived setlists</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
        )}
      </AnimatePresence>

      {/* Create View */}
      <AnimatePresence>
        {activeView === 'create' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="rounded-xl border border-slate-600 bg-slate-800/50 p-8 backdrop-blur"
          >
            <h2 className="mb-6 text-2xl font-bold text-white">Create New Setlist</h2>
            <div className="max-w-2xl space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Setlist Title</label>
                <input
                  type="text"
                  value={newSetlistTitle}
                  onChange={(e) => setNewSetlistTitle(e.target.value)}
                  placeholder="E.g. Sunday Morning Worship"
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:border-[#C09060] focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Category</label>
                <select
                  value={newSetlistCategory}
                  onChange={(e) => setNewSetlistCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-white focus:border-[#C09060] focus:outline-none transition-colors"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-slate-400">After creating, you can add songs and configure details.</p>
              <div className="flex gap-3 pt-4">
                <motion.button
                  onClick={handleBackToGrid}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-lg border border-slate-600 px-6 py-3 font-semibold text-white hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={() => {
                    handleCreateSetlist()
                    handleBackToGrid()
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-lg bg-gradient-to-r from-[#C09060] to-[#B8860B] px-6 py-3 font-bold text-white hover:from-[#B8860B] hover:to-[#A0722E] transition-all"
                >
                  Create Setlist
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Archive View */}
      <AnimatePresence>
        {activeView === 'archive' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="rounded-xl border border-slate-600 bg-slate-800/50 p-8 backdrop-blur"
          >
            <h2 className="mb-6 text-2xl font-bold text-white">Archived Setlists</h2>
            {archivedSetlists.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-center">
                <div>
                  <Archive className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No archived setlists yet.</p>
                  <p className="text-sm text-slate-500 mt-1">Setlists you archive will appear here.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-4xl">
                {groupedArchivedSetlists().map(([dateGroup, setlistsInGroup]) => (
                  <motion.div
                    key={dateGroup}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3"
                  >
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-[#C09060]" />
                      {dateGroup}
                    </h3>
                    <div className="space-y-2">
                      {setlistsInGroup.map((setlist) => (
                        <motion.div
                          key={setlist.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          whileHover={{ x: 4 }}
                          className="flex items-center justify-between rounded-lg border border-slate-600 bg-slate-700/50 p-4 hover:bg-slate-700 transition-colors"
                        >
                          <div className="flex-1">
                            <h4 className="font-semibold text-white">{setlist.title}</h4>
                            <p className="text-sm text-slate-400">{setlist.category} • {setlist.songs.length} songs • Led by {setlist.leader}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <motion.button
                              onClick={() => {
                                restoreArchived(setlist.id)
                                setUndoNotification({
                                  id: setlist.id,
                                  message: `${setlist.title} restored`,
                                  type: 'archive',
                                  timestamp: Date.now(),
                                })
                                undoTimeoutRef(setlist.id, 'archive')
                              }}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="rounded bg-[#C09060] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B8860B] transition-colors flex items-center gap-2"
                            >
                              <RotateCcw className="h-4 w-4" />
                              Restore
                            </motion.button>
                            <motion.button
                              onClick={() => {
                                permanentlyDeleteArchived(setlist.id)
                                setUndoNotification({
                                  id: setlist.id,
                                  message: `${setlist.title} permanently deleted`,
                                  type: 'delete',
                                  timestamp: Date.now(),
                                })
                                undoTimeoutRef(setlist.id, 'delete')
                              }}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="rounded bg-red-900/40 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900 transition-colors flex items-center gap-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {undoNotification && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20, x: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-6 right-6 rounded-lg border border-slate-600 bg-slate-900 p-4 shadow-xl backdrop-blur flex items-center gap-3 z-40 max-w-sm"
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-200">{undoNotification.message}</p>
            </div>
            <motion.button
              onClick={() => {
                setUndoNotification(null)
                restoreArchived(undoNotification.id)
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-shrink-0 rounded bg-[#C09060] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#B8860B] transition-colors"
            >
              UNDO
            </motion.button>
            <motion.button
              onClick={() => setUndoNotification(null)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="flex-shrink-0 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </AppShell>
  )
}
