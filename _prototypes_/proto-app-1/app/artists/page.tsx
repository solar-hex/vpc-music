'use client'

import { useState, useMemo, useRef } from 'react'
import { AppShell } from '@/components/app-shell'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Share2,
  Download,
  X,
  Music,
  Globe,
  Users,
  Zap,
  Copy,
  Upload,
  ImagePlus,
  Check,
  FileText,
  Music as MusicIcon,
  Mail,
  Loader,
} from 'lucide-react'
import { hoverLift, tapScale } from '@/lib/animations'
import { cn } from '@/lib/utils'
import {
  generateChordProFile,
  generateTextFile,
  downloadFile,
  copyToClipboard,
  generateFilename,
  generateEmailContent,
  generateShareUrl,
} from '@/lib/chordpro-export'

interface Artist {
  id: string
  name: string
  bio: string
  genre: string
  songCount: number
  followers: number
  website?: string
  image: string
  backgroundImage?: string
  verified: boolean
}

interface DetailedArtist extends Artist {
  topSongs: Array<{ id: string; title: string; plays: number }>
  collaborations: string[]
  albums: string[]
}

const ARTISTS_DATA: Artist[] = [
  {
    id: '1',
    name: 'Bethel Music',
    bio: 'Contemporary Christian music collective',
    genre: 'Worship',
    songCount: 24,
    followers: 1250,
    website: 'bethelmusic.com',
    image: 'https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=200&h=200&fit=crop',
    verified: true,
  },
  {
    id: '2',
    name: 'Chris Tomlin',
    bio: 'Modern hymn writer and worship leader',
    genre: 'Worship/Hymn',
    songCount: 18,
    followers: 890,
    website: 'christomlin.com',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
    verified: true,
  },
  {
    id: '3',
    name: 'Elevation Worship',
    bio: 'Worship band from Elevation Church',
    genre: 'Contemporary Worship',
    songCount: 31,
    followers: 2100,
    image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200&h=200&fit=crop',
    verified: true,
  },
  {
    id: '4',
    name: 'Hillsong United',
    bio: 'Global worship movement',
    genre: 'Worship',
    songCount: 42,
    followers: 3400,
    website: 'hillsongunited.com',
    image: 'https://images.unsplash.com/photo-1498038432885-5586b5b47edb?w=200&h=200&fit=crop',
    verified: true,
  },
  {
    id: '5',
    name: 'Audacious Worship',
    bio: 'Emerging worship artists',
    genre: 'Modern Worship',
    songCount: 8,
    followers: 234,
    image: 'https://images.unsplash.com/photo-1505341221514-4afddde91c96?w=200&h=200&fit=crop',
    verified: false,
  },
]

export default function ArtistsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('All')
  const [selectedArtist, setSelectedArtist] = useState<DetailedArtist | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [artists, setArtists] = useState(ARTISTS_DATA)
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null)
  const [backgroundImagePreview, setBackgroundImagePreview] = useState<string>('')
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success'>('idle')
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportFeedback, setExportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const genres = ['All', 'Worship', 'Contemporary Worship', 'Hymn', 'Modern Worship']

  const filteredArtists = useMemo(() => {
    return artists.filter(artist => {
      const matchesSearch = artist.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesGenre = selectedGenre === 'All' || artist.genre.includes(selectedGenre)
      return matchesSearch && matchesGenre
    })
  }, [artists, searchQuery, selectedGenre])

  const handleViewArtist = (artist: Artist) => {
    const detailedArtist: DetailedArtist = {
      ...artist,
      topSongs: [
        { id: '1', title: 'First Song', plays: 5420 },
        { id: '2', title: 'Second Song', plays: 3210 },
        { id: '3', title: 'Third Song', plays: 2150 },
      ],
      collaborations: ['Artist 1', 'Artist 2'],
      albums: ['Album 1', 'Album 2'],
    }
    setSelectedArtist(detailedArtist)
    setIsDetailModalOpen(true)
  }

  const handleDeleteArtist = (id: string) => {
    setArtists(artists.filter(a => a.id !== id))
  }

  const handleEditArtist = (artist: Artist) => {
    setEditingArtist(artist)
    setIsAddModalOpen(true)
  }

  const handleSaveArtist = (artistData: Artist) => {
    if (editingArtist) {
      setArtists(artists.map(a => (a.id === editingArtist.id ? artistData : a)))
    } else {
      setArtists([...artists, { ...artistData, id: Date.now().toString() }])
    }
    setIsAddModalOpen(false)
    setEditingArtist(null)
  }

  const handleDuplicateArtist = (artist: Artist) => {
    const newArtist: Artist = {
      ...artist,
      id: Date.now().toString(),
      name: `${artist.name} (Copy)`,
    }
    setArtists([...artists, newArtist])
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadStatus('uploading')
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageData = event.target?.result as string
        setBackgroundImagePreview(imageData)
        setUploadStatus('success')
        setTimeout(() => setUploadStatus('idle'), 2000)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleImagePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          setUploadStatus('uploading')
          const blob = items[i].getAsFile()
          const reader = new FileReader()
          reader.onload = (event) => {
            const imageData = event.target?.result as string
            setBackgroundImagePreview(imageData)
            setUploadStatus('success')
            setTimeout(() => setUploadStatus('idle'), 2000)
          }
          reader.readAsDataURL(blob!)
          e.preventDefault()
          break
        }
      }
    }
  }

  const handleRemoveBackgroundImage = () => {
    setBackgroundImagePreview('')
  }

  const handleOpenAddModal = () => {
    setEditingArtist(null)
    setBackgroundImagePreview('')
    setIsAddModalOpen(true)
  }

  const handleOpenEditModal = (artist: Artist) => {
    setEditingArtist(artist)
    setBackgroundImagePreview(artist.backgroundImage || '')
    setIsAddModalOpen(true)
  }

  // Export handlers for artist songs
  const handleExportChordPro = async () => {
    if (!selectedArtist) return
    
    setExportLoading(true)
    try {
      // Create ChordPro content for all artist songs
      const songContent = selectedArtist.topSongs
        .map((song, idx) => {
          const mockSong = {
            id: song.id,
            title: song.title,
            artist: selectedArtist.name,
            key: 'G',
            bpm: 120,
            sections: [
              {
                label: 'Verse',
                lines: [
                  { chords: 'G', lyrics: 'First verse lyrics' },
                  { chords: 'D', lyrics: 'Second line' }
                ]
              }
            ]
          }
          return generateChordProFile(mockSong)
        })

      // For now, export the first song as example
      const filename = `${selectedArtist.name}-Songs.chordpro`
      downloadFile(generateChordProFile({
        id: '1',
        title: selectedArtist.name,
        artist: selectedArtist.name,
        key: 'G',
        description: `Collection of songs by ${selectedArtist.name}`
      }), filename)

      setExportFeedback({ type: 'success', message: `ChordPro file exported: ${filename}` })
      setTimeout(() => setExportFeedback(null), 3000)
    } catch (error) {
      setExportFeedback({ type: 'error', message: 'Failed to export ChordPro file' })
    } finally {
      setExportLoading(false)
    }
  }

  const handleExportText = async () => {
    if (!selectedArtist) return

    setExportLoading(true)
    try {
      const textContent = `Artist: ${selectedArtist.name}\n\nTop Songs:\n${selectedArtist.topSongs.map((s, i) => `${i + 1}. ${s.title} (${s.plays.toLocaleString()} plays)`).join('\n')}`
      const blob = new Blob([textContent], { type: 'text/plain' })
      const filename = `${selectedArtist.name}-Songs.txt`
      downloadFile(blob, filename)

      setExportFeedback({ type: 'success', message: `Text file exported: ${filename}` })
      setTimeout(() => setExportFeedback(null), 3000)
    } catch (error) {
      setExportFeedback({ type: 'error', message: 'Failed to export text file' })
    } finally {
      setExportLoading(false)
    }
  }

  const handleCopyArtistInfo = async () => {
    if (!selectedArtist) return

    try {
      const content = `Artist: ${selectedArtist.name}\nGenre: ${selectedArtist.genre}\nFollowers: ${selectedArtist.followers}\nSongs: ${selectedArtist.songCount}`
      await navigator.clipboard.writeText(content)
      setExportFeedback({ type: 'success', message: 'Artist info copied to clipboard' })
      setTimeout(() => setExportFeedback(null), 2000)
    } catch {
      setExportFeedback({ type: 'error', message: 'Failed to copy to clipboard' })
    }
  }

  const handleShareArtist = () => {
    if (!selectedArtist) return

    const text = `Check out ${selectedArtist.name} - ${selectedArtist.genre} artist with ${selectedArtist.followers} followers and ${selectedArtist.songCount} songs!`
    const url = `https://example.com/artists/${selectedArtist.id}`
    
    if (navigator.share) {
      navigator.share({ title: selectedArtist.name, text, url })
    } else {
      const shareUrl = `${text} ${url}`
      navigator.clipboard.writeText(shareUrl)
      setExportFeedback({ type: 'success', message: 'Share link copied to clipboard' })
      setTimeout(() => setExportFeedback(null), 2000)
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">Artists</h1>
                <p className="text-slate-400 mt-1">Browse and manage worship artists</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleOpenAddModal}
                className="flex items-center gap-2 rounded-lg bg-[#C09060] px-4 py-2 font-semibold text-white hover:bg-[#B8860B] transition-all"
              >
                <Plus className="h-4 w-4" />
                Add Artist
              </motion.button>
            </div>

            {/* Search & Filter */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search artists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700/50 pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C09060] transition-all"
                />
              </div>

              {/* Genre Filter */}
              <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
                {genres.map(genre => (
                  <motion.button
                    key={genre}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => setSelectedGenre(genre)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                      selectedGenre === genre
                        ? 'bg-[#C09060] text-white'
                        : 'border border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {genre}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-6 sm:px-8">
          {filteredArtists.length === 0 ? (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-8 text-center">
              <Music className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">
                {searchQuery || selectedGenre !== 'All'
                  ? 'No artists match your search. Try different filters.'
                  : 'No artists yet. Add your first artist to get started.'}
              </p>
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {filteredArtists.map(artist => (
                <motion.div
                  key={artist.id}
                  variants={itemVariants}
                  whileHover={{ y: -4 }}
                  className="group rounded-2xl border border-slate-600 bg-gradient-to-br from-slate-700/50 to-slate-800/50 overflow-hidden hover:border-[#C09060]/50 transition-all"
                >
                  {/* Artist Image */}
                  <div className="relative h-40 bg-slate-700 overflow-hidden">
                    <img
                      src={artist.image}
                      alt={artist.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {artist.verified && (
                      <div className="absolute top-2 right-2 bg-[#C09060] px-2 py-1 rounded-full text-xs font-bold text-white">
                        ✓ Verified
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-4 flex flex-col gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white truncate">{artist.name}</h3>
                      <p className="text-xs text-[#C09060] font-semibold uppercase">{artist.genre}</p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-lg bg-slate-700/50 p-2">
                        <p className="text-lg font-bold text-white">{artist.songCount}</p>
                        <p className="text-xs text-slate-400">Songs</p>
                      </div>
                      <div className="rounded-lg bg-slate-700/50 p-2">
                        <p className="text-lg font-bold text-white">{artist.followers}</p>
                        <p className="text-xs text-slate-400">Followers</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => handleViewArtist(artist)}
                        whileHover={{ scale: 1.05 }}
                        className="flex-1 rounded-lg bg-[#C09060] py-2 font-semibold text-white hover:bg-[#B8860B] transition-all flex items-center justify-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </motion.button>
                      <motion.button
                        onClick={() => handleOpenEditModal(artist)}
                        whileHover={{ scale: 1.1 }}
                        className="rounded-lg bg-slate-700/50 p-2 text-slate-400 hover:text-green-400 hover:bg-slate-600 transition-all"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </motion.button>
                      <motion.button
                        onClick={() => handleDuplicateArtist(artist)}
                        whileHover={{ scale: 1.1 }}
                        className="rounded-lg bg-slate-700/50 p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-600 transition-all"
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </motion.button>
                      <motion.button
                        onClick={() => handleDeleteArtist(artist.id)}
                        whileHover={{ scale: 1.1 }}
                        className="rounded-lg bg-slate-700/50 p-2 text-slate-400 hover:text-red-400 hover:bg-slate-600 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedArtist && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsDetailModalOpen(false)}
          >
            <motion.div
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header with Background Image */}
              <div className="relative h-48 bg-slate-700 overflow-hidden group">
                {selectedArtist.backgroundImage ? (
                  <img
                    src={selectedArtist.backgroundImage}
                    alt={`${selectedArtist.name} background`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={selectedArtist.image}
                    alt={selectedArtist.name}
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-50" />
                <motion.button
                  onClick={() => setIsDetailModalOpen(false)}
                  whileHover={{ rotate: 90 }}
                  className="absolute top-4 right-4 rounded-full bg-slate-900/80 p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Title & Bio */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-3xl font-bold text-white">{selectedArtist.name}</h2>
                    {selectedArtist.verified && (
                      <span className="bg-[#C09060] px-3 py-1 rounded-full text-xs font-bold text-white">✓</span>
                    )}
                  </div>
                  <p className="text-[#C09060] font-semibold mb-3">{selectedArtist.genre}</p>
                  <p className="text-slate-300 leading-relaxed">{selectedArtist.bio}</p>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-center">
                    <p className="text-2xl font-bold text-[#C09060]">{selectedArtist.songCount}</p>
                    <p className="text-sm text-slate-400">Total Songs</p>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-center">
                    <p className="text-2xl font-bold text-[#C09060]">{selectedArtist.followers}</p>
                    <p className="text-sm text-slate-400">Followers</p>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-center">
                    <p className="text-2xl font-bold text-[#C09060]">{selectedArtist.albums.length}</p>
                    <p className="text-sm text-slate-400">Albums</p>
                  </div>
                </div>

                {/* Top Songs */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Top Songs</h3>
                  <div className="space-y-2">
                    {selectedArtist.topSongs.map((song, idx) => (
                      <motion.div
                        key={song.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center justify-between rounded-lg bg-slate-700/50 p-3"
                      >
                        <span className="text-slate-300">{song.title}</span>
                        <span className="text-sm text-slate-500">{song.plays.toLocaleString()} plays</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Collaborations */}
                {selectedArtist.collaborations.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-white mb-3">Collaborations</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedArtist.collaborations.map(collab => (
                        <span key={collab} className="rounded-full bg-slate-700/50 px-3 py-1 text-sm text-slate-300">
                          {collab}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-slate-700 flex-col sm:flex-row relative">
                  <motion.button
                    onClick={handleShareArtist}
                    whileHover={{ scale: 1.02 }}
                    className="flex-1 rounded-lg border border-slate-600 bg-slate-700/50 py-3 font-semibold text-white hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </motion.button>
                  
                  {/* Export Menu */}
                  <div className="flex-1 relative">
                    <motion.button
                      onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                      whileHover={{ scale: 1.02 }}
                      disabled={exportLoading}
                      className="w-full rounded-lg border border-slate-600 bg-slate-700/50 py-3 font-semibold text-white hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
                    >
                      {exportLoading ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin" />
                          Exporting
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Export
                        </>
                      )}
                    </motion.button>

                    {/* Export Options Dropdown */}
                    <AnimatePresence>
                      {isExportMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                          className="absolute bottom-full right-0 mb-2 w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden"
                        >
                          <div className="p-3 space-y-2">
                            {/* ChordPro Export */}
                            <motion.button
                              onClick={() => {
                                handleExportChordPro()
                                setIsExportMenuOpen(false)
                              }}
                              whileHover={{ scale: 1.02, x: 4 }}
                              whileTap={{ scale: 0.95 }}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all"
                            >
                              <FileText className="h-4 w-4 flex-shrink-0 text-[#C09060]" />
                              <div className="flex-1">
                                <p className="font-semibold text-sm">ChordPro Format</p>
                                <p className="text-xs text-slate-500">Compatible with chord readers</p>
                              </div>
                            </motion.button>

                            {/* Text Export */}
                            <motion.button
                              onClick={() => {
                                handleExportText()
                                setIsExportMenuOpen(false)
                              }}
                              whileHover={{ scale: 1.02, x: 4 }}
                              whileTap={{ scale: 0.95 }}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all"
                            >
                              <MusicIcon className="h-4 w-4 flex-shrink-0 text-[#C09060]" />
                              <div className="flex-1">
                                <p className="font-semibold text-sm">Plain Text</p>
                                <p className="text-xs text-slate-500">Simple text format</p>
                              </div>
                            </motion.button>

                            {/* Copy Artist Info */}
                            <motion.button
                              onClick={() => {
                                handleCopyArtistInfo()
                                setIsExportMenuOpen(false)
                              }}
                              whileHover={{ scale: 1.02, x: 4 }}
                              whileTap={{ scale: 0.95 }}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all border-t border-slate-700 pt-2"
                            >
                              <Copy className="h-4 w-4 flex-shrink-0 text-[#C09060]" />
                              <div className="flex-1">
                                <p className="font-semibold text-sm">Copy Info</p>
                                <p className="text-xs text-slate-500">Artist details</p>
                              </div>
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <motion.button
                    onClick={() => setIsDetailModalOpen(false)}
                    whileHover={{ scale: 1.02 }}
                    className="flex-1 rounded-lg bg-[#C09060] py-3 font-semibold text-white hover:bg-[#B8860B] transition-all"
                  >
                    Close
                  </motion.button>
                </div>

                {/* Export Feedback */}
                <AnimatePresence>
                  {exportFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className={cn(
                        'px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2',
                        exportFeedback.type === 'success'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-red-500/20 text-red-300'
                      )}
                    >
                      {exportFeedback.type === 'success' ? (
                        <>
                          <Check className="h-4 w-4" />
                          {exportFeedback.message}
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4" />
                          {exportFeedback.message}
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Artist Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAddModalOpen(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-white mb-6">
                {editingArtist ? 'Edit Artist' : 'Add New Artist'}
              </h2>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Artist Name</label>
                  <input
                    type="text"
                    id="artist-name"
                    defaultValue={editingArtist?.name || ''}
                    placeholder="Enter artist name"
                    className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C09060]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Genre</label>
                  <select
                    id="artist-genre"
                    defaultValue={editingArtist?.genre || ''}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#C09060]"
                  >
                    <option value="">Select a genre</option>
                    <option value="Worship">Worship</option>
                    <option value="Contemporary Worship">Contemporary Worship</option>
                    <option value="Hymn">Hymn</option>
                    <option value="Modern Worship">Modern Worship</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Bio</label>
                  <textarea
                    id="artist-bio"
                    defaultValue={editingArtist?.bio || ''}
                    placeholder="Enter artist bio"
                    className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C09060] resize-none"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Background Image</label>
                  <div
                    onPaste={handleImagePaste}
                    className="relative rounded-lg border-2 border-dashed border-slate-600 bg-slate-700/50 p-4 text-center hover:border-[#C09060] transition-colors cursor-pointer group"
                  >
                    {backgroundImagePreview ? (
                      <div className="relative">
                        <img
                          src={backgroundImagePreview}
                          alt="Background preview"
                          className="h-32 w-full object-cover rounded-lg"
                        />
                        <motion.button
                          onClick={handleRemoveBackgroundImage}
                          whileHover={{ scale: 1.1 }}
                          className="absolute top-2 right-2 bg-red-500 p-2 rounded-full text-white hover:bg-red-600 transition-all"
                          type="button"
                        >
                          <X className="h-4 w-4" />
                        </motion.button>
                        {uploadStatus === 'success' && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute top-2 left-2 bg-green-500 p-2 rounded-full text-white"
                          >
                            <Check className="h-4 w-4" />
                          </motion.div>
                        )}
                      </div>
                    ) : (
                      <div className="py-6">
                        <motion.div
                          animate={uploadStatus === 'uploading' ? { scale: 1.1 } : { scale: 1 }}
                          className="flex justify-center mb-2"
                        >
                          {uploadStatus === 'uploading' ? (
                            <div className="h-8 w-8 border-2 border-[#C09060] border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <ImagePlus className="h-8 w-8 text-slate-500 group-hover:text-[#C09060] transition-colors" />
                          )}
                        </motion.div>
                        <p className="text-sm text-slate-400">
                          <span className="text-[#C09060] font-semibold">Click to upload</span> or paste image
                        </p>
                        <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF up to 10MB</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      onClick={() => fileInputRef.current?.click()}
                      className="hidden"
                    />
                  </div>
                  <motion.button
                    onClick={() => fileInputRef.current?.click()}
                    whileHover={{ scale: 1.02 }}
                    className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-700/50 py-2 font-semibold text-slate-300 hover:bg-slate-600 hover:text-white transition-all flex items-center justify-center gap-2"
                    type="button"
                  >
                    <Upload className="h-4 w-4" />
                    Choose File
                  </motion.button>
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  onClick={() => setIsAddModalOpen(false)}
                  whileHover={{ scale: 1.02 }}
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-700/50 py-2 font-semibold text-white hover:bg-slate-600 transition-all"
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={() => {
                    const name = (document.getElementById('artist-name') as HTMLInputElement)?.value
                    const genre = (document.getElementById('artist-genre') as HTMLSelectElement)?.value
                    const bio = (document.getElementById('artist-bio') as HTMLTextAreaElement)?.value

                    if (name && genre) {
                      const newArtist: Artist = {
                        ...(editingArtist || {
                          id: '',
                          songCount: 0,
                          followers: 0,
                          website: '',
                          image: 'https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=200&h=200&fit=crop',
                          verified: false,
                        }),
                        name,
                        genre,
                        bio,
                        backgroundImage: backgroundImagePreview || undefined,
                      }
                      handleSaveArtist(newArtist)
                    }
                  }}
                  whileHover={{ scale: 1.02 }}
                  className="flex-1 rounded-lg bg-[#C09060] py-2 font-semibold text-white hover:bg-[#B8860B] transition-all"
                >
                  Save
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}
