'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Trash2, RotateCcw, SortAsc, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Setlist } from '@/lib/use-setlist-storage'

interface ArchivedSetlistsPanelProps {
  isOpen: boolean
  onClose: () => void
  archivedSetlists: Setlist[]
  onRestore: (id: string) => void
  onPermanentlyDelete: (id: string) => void
}

type SortBy = 'date-newest' | 'date-oldest' | 'title'

export function ArchivedSetlistsPanel({
  isOpen,
  onClose,
  archivedSetlists,
  onRestore,
  onPermanentlyDelete,
}: ArchivedSetlistsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('date-newest')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Filter and sort archived setlists
  const filteredAndSorted = useMemo(() => {
    let result = archivedSetlists.filter(sl =>
      sl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sl.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sl.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ?? false)
    )

    switch (sortBy) {
      case 'date-oldest':
        result = result.sort((a, b) => 
          new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime()
        )
        break
      case 'date-newest':
        result = result.sort((a, b) => 
          new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
        )
        break
      case 'title':
        result = result.sort((a, b) => a.title.localeCompare(b.title))
        break
    }

    return result
  }, [archivedSetlists, searchQuery, sortBy])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50"
        />

        {/* Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute right-0 top-0 bottom-0 w-full max-w-2xl sm:max-w-2xl md:max-w-2xl bg-slate-900 shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="border-b border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6 flex items-center justify-between flex-shrink-0">
            <h2 className="text-2xl font-bold text-white">Archived Setlists</h2>
            <motion.button
              onClick={onClose}
              whileHover={{ rotate: 90 }}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </motion.button>
          </div>

          {/* Search and Sort */}
          <div className="border-b border-slate-700 bg-slate-800/50 p-4 flex-shrink-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search archived setlists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:border-[#C09060] focus:outline-none focus:ring-1 focus:ring-[#C09060]"
                />
              </div>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-[#C09060] focus:outline-none focus:ring-1 focus:ring-[#C09060]"
              >
                <option value="date-newest">Newest First</option>
                <option value="date-oldest">Oldest First</option>
                <option value="title">Title (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {filteredAndSorted.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <p className="text-slate-400 mb-2">
                    {searchQuery ? 'No setlists match your search.' : 'No archived setlists yet.'}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-sm text-[#C09060] hover:text-[#B8860B] transition-colors"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredAndSorted.map((setlist) => (
                  <motion.div
                    key={setlist.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="rounded-lg border border-slate-600 bg-slate-800/50 p-4 hover:bg-slate-800 transition-colors"
                  >
                    {/* Setlist Info */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white truncate">{setlist.title}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          <span className="px-2 py-1 rounded bg-slate-700 text-slate-300">{setlist.category}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {setlist.createdDate}
                          </span>
                        </div>
                      </div>

                      {/* Song Count */}
                      <div className="flex-shrink-0 text-right">
                        <p className="text-2xl font-bold text-[#C09060]">{setlist.songs.length}</p>
                        <p className="text-xs text-slate-500">songs</p>
                      </div>
                    </div>

                    {/* Tags */}
                    {setlist.tags && setlist.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {setlist.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                        {setlist.tags.length > 3 && (
                          <span className="text-xs px-2 py-1 text-slate-500">
                            +{setlist.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {deleteConfirm === setlist.id ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-2 pt-3 border-t border-slate-700"
                      >
                        <button
                          onClick={() => {
                            onPermanentlyDelete(setlist.id)
                            setDeleteConfirm(null)
                          }}
                          className="flex-1 rounded px-3 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="flex-1 rounded px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </motion.div>
                    ) : (
                      <div className="flex gap-2 pt-3 border-t border-slate-700">
                        <motion.button
                          onClick={() => onRestore(setlist.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#C09060] to-[#B8860B] hover:from-[#B8860B] hover:to-[#A0722E] transition-all"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Restore
                        </motion.button>
                        <motion.button
                          onClick={() => setDeleteConfirm(setlist.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold text-red-300 bg-red-900/20 hover:bg-red-900/30 border border-red-900/50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Footer */}
          {filteredAndSorted.length > 0 && (
            <div className="border-t border-slate-700 bg-slate-800/50 p-4 flex-shrink-0 text-xs text-slate-400">
              Showing {filteredAndSorted.length} of {archivedSetlists.length} archived setlists
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
