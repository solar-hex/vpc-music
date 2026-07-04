"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { AppShell } from "@/components/app-shell"
import { LyricsModal } from "@/components/lyrics-modal"
import { ServicePlanModal } from "@/components/dashboard/service-plan-modal"
import { useDashboardState, DashboardProvider } from "@/lib/dashboard-context"
import {
  Calendar,
  MapPin,
  CalendarDays,
  ChevronRight,
  Plus,
  Music,
  CheckSquare,
  Upload,
  ArrowRight,
  X,
  Clock,
  MapPinIcon,
  Users,
  Edit,
  Trash2,
  Save,
  Search,
  Filter,
  Share2,
  Download,
  Phone,
  Mail,
  MessageSquare,
  FileText,
  FileMusic,
  FileVideo,
  Activity,
  AlertCircle,
  Star,
  Music2,
  Radio,
  Wifi,
  WifiOff,
  Code2,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { cardStagger, listStagger, springUp, fadeInUp, staggerContainer, staggerItem } from "@/lib/animations"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Event {
  id: string
  title: string
  date: string
  time: string
  location: string
  status: "upcoming" | "current" | "past"
}

interface Song {
  id: string
  title: string
  artist: string
  image?: string
  addedDate: string
}

interface ServicePlan {
  id: string
  title: string
  date: string
  status: "active" | "upcoming" | "completed"
  time?: string
  location?: string
  songCount?: number
  duration?: number
  theme?: string
  preparedBy?: string
  notes?: string
}

interface TeamMember {
  id: string
  name: string
  role: string
  avatar: string
}

// ─── Demo Data ────────────────────────────────────────────────────────────────


const UPCOMING_EVENTS: Event[] = [
  { id: "2", title: "SUNDAY MORNING WORSHIP", date: "May 19", time: "", location: "", status: "upcoming" },
  { id: "3", title: "YOUTH NIGHT WORSHIP", date: "May 22", time: "", location: "", status: "upcoming" },
]

const RECENT_SONGS: Song[] = [
  {
    id: "1",
    title: "GOODNESS OF GOD",
    artist: "Bethel Music",
    image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop",
    addedDate: "2 days ago",
  },
  {
    id: "2",
    title: "HOW GREAT IS OUR GOD",
    artist: "Chris Tomlin",
    image: "https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=100&h=100&fit=crop",
    addedDate: "5 days ago",
  },
  {
    id: "3",
    title: "AMAZING GRACE",
    artist: "Traditional",
    image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop",
    addedDate: "1 week ago",
  },
  {
    id: "4",
    title: "WAY MAKER",
    artist: "Sinach",
    image: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=100&h=100&fit=crop",
    addedDate: "2 weeks ago",
  },
  {
    id: "5",
    title: "BUILD MY LIFE",
    artist: "Pat Barrett",
    image: "https://images.unsplash.com/photo-1458749387795-29f1c2c91bef?w=100&h=100&fit=crop",
    addedDate: "3 weeks ago",
  },
  {
    id: "6",
    title: "WHAT A BEAUTIFUL NAME",
    artist: "Hillsong Worship",
    image: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=100&h=100&fit=crop",
    addedDate: "1 month ago",
  },
  {
    id: "7",
    title: "OCEANS",
    artist: "Hillsong United",
    image: "https://images.unsplash.com/photo-1487449962993-51c417f9b0a9?w=100&h=100&fit=crop",
    addedDate: "1 month ago",
  },
  {
    id: "8",
    title: "10,000 REASONS",
    artist: "Matt Redman",
    image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop",
    addedDate: "1 month ago",
  },
  {
    id: "9",
    title: "GREAT IS THY FAITHFULNESS",
    artist: "Traditional",
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop",
    addedDate: "2 months ago",
  },
  {
    id: "10",
    title: "LIVING HOPE",
    artist: "Phil Wickham",
    image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop",
    addedDate: "2 months ago",
  },
  {
    id: "11",
    title: "JESUS PAID IT ALL",
    artist: "Kristian Stanfill",
    image: "https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=100&h=100&fit=crop",
    addedDate: "2 months ago",
  },
  {
    id: "12",
    title: "FOREVER GRATEFUL",
    artist: "Brandon Lake",
    image: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=100&h=100&fit=crop",
    addedDate: "3 months ago",
  },
]

const SERVICE_PLANS: ServicePlan[] = [
  { 
    id: "1", 
    title: "SUNDAY MORNING WORSHIP", 
    date: "May 19", 
    status: "active",
    time: "10:00 AM",
    location: "Main Sanctuary",
    songCount: 5,
    duration: 45,
    theme: "God's Faithfulness",
    preparedBy: "Sam Carter",
    notes: "Focus on contemporary and traditional blend"
  },
  { 
    id: "2", 
    title: "YOUTH NIGHT WORSHIP", 
    date: "May 22", 
    status: "upcoming",
    time: "7:00 PM",
    location: "Youth Hall",
    songCount: 4,
    duration: 35,
    theme: "New Generation",
    preparedBy: "Alex Johnson",
    notes: "Modern songs with high energy"
  },
  { 
    id: "3", 
    title: "SPECIAL NIGHT OF WORSHIP", 
    date: "May 26", 
    status: "upcoming",
    time: "6:30 PM",
    location: "Main Sanctuary",
    songCount: 6,
    duration: 60,
    theme: "Revival & Renewal",
    preparedBy: "Jordan Lee",
    notes: "Extended worship time with prayer segments"
  },
]

const NEXT_EVENT: Event = {
  id: "1",
  title: "SUNDAY MORNING WORSHIP",
  date: "May 19, 2024",
  time: "10:00 AM",
  location: "Main Sanctuary",
  status: "upcoming",
}

const TEAM_MEMBERS: TeamMember[] = [
  { id: "1", name: "Sam", role: "Leader", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" },
  { id: "2", name: "Alex", role: "Musician", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" },
  { id: "3", name: "Jordan", role: "Lead", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" },
]

// ─── Quick Action Card ────────────────────────────────────────────────────────

interface QuickActionProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  shortcut?: string
  description?: string
  favorite?: boolean
  onFavorite?: () => void
}

function QuickActionCard({ icon, label, onClick, shortcut, description, favorite, onFavorite }: QuickActionProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="group relative">
      <motion.button
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        whileHover={{ y: -2, boxShadow: "0 12px 24px rgba(192, 144, 96, 0.15)" }}
        whileTap={{ scale: 0.98 }}
        className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition-all hover:border-[#C09060]/50 hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C09060]"
      >
        <motion.div
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C09060]/20 text-[#C09060] relative"
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
        >
          {icon}
          {favorite && (
            <motion.div
              className="absolute -top-1 -right-1 h-3 w-3 bg-[#C09060] rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </motion.div>
        <span className="text-xs font-bold uppercase tracking-wide text-slate-200 text-center line-clamp-2">{label}</span>
      </motion.button>

      {/* Advanced Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 w-max max-w-xs bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-lg"
          >
            <p className="text-xs font-semibold text-[#C09060]">{label}</p>
            {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
            {shortcut && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-500">Shortcut:</span>
                <kbd className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 font-mono text-slate-300">{shortcut}</kbd>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Favorite Button */}
      {onFavorite && (
        <motion.button
          onClick={(e) => {
            e.stopPropagation()
            onFavorite()
          }}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.95 }}
          className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Star className={cn("h-3 w-3", favorite ? "fill-[#C09060] text-[#C09060]" : "text-slate-400")} />
        </motion.button>
      )}
    </div>
  )
}

// ─── Event Card ────────────────────────────────────────────────────────────

interface EventCardProps {
  event: Event
  isNextEvent?: boolean
  onClick?: () => void
}

function EventCard({ event, isNextEvent, onClick }: EventCardProps) {
  if (isNextEvent) {
    return (
      <motion.div 
        className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6 backdrop-blur"
        whileHover={{ y: -2, boxShadow: "0 20px 25px -5px rgba(249, 115, 22, 0.15)" }}
      >
        <div className="mb-4 text-xs font-bold uppercase tracking-widest text-[#C09060]">Next Performance</div>
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-white leading-tight">{event.title}</h3>
        </div>
        <div className="mb-6 space-y-3 text-sm text-slate-300">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-[#C09060] flex-shrink-0" />
            <span>{event.date} • {event.time}</span>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-[#C09060] flex-shrink-0" />
            <span>{event.location}</span>
          </div>
        </div>
        <motion.button
          onClick={onClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-full rounded-lg bg-gradient-to-r from-[#C09060] to-[#B8860B] px-4 py-3 text-sm font-bold text-white hover:from-[#B8860B] hover:to-[#A0722E] transition-all"
        >
          VIEW PLAN
        </motion.button>
      </motion.div>
    )
  }

  return (
    <div
      onClick={onClick}
      className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 transition-all hover:border-slate-600 hover:bg-slate-800/80 cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-white">{event.title}</h4>
          <p className="mt-1 text-xs text-slate-400">{event.date}</p>
        </div>
        <span className="text-xl font-bold text-slate-400">{event.date.split(" ")[0]}</span>
      </div>
    </div>
  )
}

// ─── Song Card ────────────────────────────────────────────────────────────

interface SongCardProps {
  song: Song
  onClick?: () => void
}

function SongCard({ song, onClick }: SongCardProps) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4 transition-all hover:border-slate-600 hover:bg-slate-800/80 cursor-pointer"
    >
      <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600">
        <img
          src={song.image}
          alt={song.title}
          className="h-full w-full rounded-lg object-cover"
          crossOrigin="anonymous"
        />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-white">{song.title}</h4>
        <p className="text-xs text-slate-400">{song.artist}</p>
      </div>
      <span className="text-xs text-slate-500 flex-shrink-0">{song.addedDate}</span>
    </div>
  )
}

// ─── Service Plan Card ────────────────────────────────────────────────────────

interface ServicePlanCardProps {
  plan: ServicePlan
  onClick?: () => void
}

function ServicePlanCard({ plan, onClick }: ServicePlanCardProps) {
  const statusColors = {
    active: "bg-green-500/20 text-green-400",
    upcoming: "bg-slate-600/20 text-slate-300",
    completed: "bg-slate-500/20 text-slate-400",
  }

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ x: 4, boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)" }}
      whileTap={{ scale: 0.98 }}
      className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-4 transition-all hover:border-slate-600 hover:bg-slate-800/80 cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <motion.div
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700"
          whileHover={{ scale: 1.1 }}
        >
          <Music className="h-4 w-4 text-slate-400" />
        </motion.div>
        <div>
          <h4 className="text-sm font-semibold text-white">{plan.title}</h4>
          <p className="text-xs text-slate-400">{plan.date}</p>
        </div>
      </div>
      <span className={cn("text-xs font-semibold px-2 py-1 rounded", statusColors[plan.status])}>
        {plan.status.toUpperCase()}
      </span>
    </motion.div>
  )
}

// ─── Main Dashboard Content ───────────────────────────────────────────────────────────

function DashboardContent() {
  const router = useRouter()
  const { state, updateScrollPosition } = useDashboardState()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Restore scroll position on mount
  useEffect(() => {
    if (scrollContainerRef.current && state.scrollPosition > 0) {
      scrollContainerRef.current.scrollTop = state.scrollPosition
    }
  }, [state.scrollPosition])

  // Save scroll position on scroll
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      updateScrollPosition(scrollContainerRef.current.scrollTop)
    }
  }
  
  // Modal States
  const [newPlanModal, setNewPlanModal] = useState(false)
  const [addSongModal, setAddSongModal] = useState(false)
  const [createSetlistModal, setCreateSetlistModal] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)
  const [eventDetailModal, setEventDetailModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [teamMemberModal, setTeamMemberModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [chordProModal, setChordProModal] = useState(false)
  const [conductorModal, setConductorModal] = useState(false)
  const [lyricsModalOpen, setLyricsModalOpen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'syncing' | 'offline'>('offline')
  const [syncProgress, setSyncProgress] = useState(0)

  // Connected workflow states
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<ServicePlan | null>(null)

  // Form States
  const [planForm, setPlanForm] = useState({ name: "", date: "", time: "", description: "", songs: [] })
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSongs, setSelectedSongs] = useState<string[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])

  // Handle View Plan - open modal with service plan
  const handleViewPlan = (planId: string) => {
    const plan = SERVICE_PLANS.find(p => p.id === planId)
    if (plan) {
      setSelectedPlan(plan)
      setIsPlanModalOpen(true)
    }
  }

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "new-plan":
        setNewPlanModal(true)
        break
      case "add-song":
        setAddSongModal(true)
        break
      case "upload-resource":
        setUploadModal(true)
        break
      default:
        break
    }
  }

  // ─── NEW PLAN MODAL ────────────────────────────────────────────────────────
  const NewPlanModal = () => (
    <AnimatePresence>
      {newPlanModal && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-2xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Create New Service Plan</h2>
              <motion.button 
                onClick={() => setNewPlanModal(false)}
                whileHover={{ rotate: 90 }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Plan Name" className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <input type="date" className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <textarea placeholder="Description" className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400" rows={2} />
              
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-300">Select Songs</p>
                <motion.div 
                  className="max-h-32 overflow-y-auto space-y-1"
                  initial="initial"
                  animate="animate"
                  variants={listStagger.container}
                >
                  {RECENT_SONGS.map((song, idx) => (
                    <motion.label 
                      key={song.id} 
                      className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 p-2 cursor-pointer hover:bg-slate-700 transition-colors"
                      variants={listStagger.item}
                      whileHover={{ x: 3 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <input type="checkbox" className="rounded" />
                      <span className="text-xs text-white">{song.title} - {song.artist}</span>
                    </motion.label>
                  ))}
                </motion.div>
              </div>

              <div className="flex gap-2 pt-2">
                <motion.button 
                  onClick={() => setNewPlanModal(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-lg bg-slate-700 py-2 text-sm font-semibold text-white hover:bg-slate-600 transition"
                >
                  Cancel
                </motion.button>
                <motion.button 
                  onClick={() => { setNewPlanModal(false) }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition"
                >
                  Create Plan
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // ─── PREMIUM FEATURE CARD ────────────────────────────────────────────────────

interface PremiumFeatureProps {
  icon: React.ReactNode
  title: string
  description: string
  status: string
  statusColor: string
  actions: { label: string; onClick: () => void }[]
  isLoading?: boolean
  connectionStatus?: 'connected' | 'syncing' | 'offline'
}

function PremiumFeatureCard({ icon, title, description, status, statusColor, actions, isLoading, connectionStatus }: PremiumFeatureProps) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 20px 25px rgba(192, 144, 96, 0.15)" }}
      className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/80 to-slate-800/40 p-6 hover:border-[#C09060]/50 transition-all"
    >
      {/* Header with Status */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.div
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C09060]/20 text-[#C09060]"
            whileHover={{ scale: 1.1 }}
          >
            {icon}
          </motion.div>
          <div>
            <h3 className="text-sm font-bold text-white">{title}</h3>
            <p className="text-xs text-slate-400 mt-1">{description}</p>
          </div>
        </div>
        <motion.div
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            statusColor === 'green' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
          )}
          animate={isLoading ? { opacity: [1, 0.6, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {status}
        </motion.div>
      </div>

      {/* Connection Status Indicator */}
      {connectionStatus && (
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
          <div className={cn(
            "h-2 w-2 rounded-full",
            connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'syncing' ? 'bg-yellow-500' : 'bg-red-500'
          )} />
          <span className="capitalize">{connectionStatus}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {actions.map((action, idx) => (
          <motion.button
            key={idx}
            onClick={action.onClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
              idx === 0
                ? "bg-[#C09060] text-white hover:bg-[#B8860B]"
                : "border border-slate-600 text-slate-300 hover:border-[#C09060] hover:text-[#C09060]"
            )}
          >
            {action.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

  // ─── ADD SONG MODAL ────────────────────────────────────────────────────────

  const AddSongModal = () => (
    <AnimatePresence>
      {addSongModal && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-2xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Add Song to Library</h2>
              <motion.button onClick={() => setAddSongModal(false)} whileHover={{ rotate: 90 }} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </motion.button>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input type="text" placeholder="Search songs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-700 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Song Key" className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <input type="number" placeholder="Tempo (BPM)" className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-300">Available Songs</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {RECENT_SONGS.map(song => (
                    <motion.div key={song.id} onClick={() => setSelectedSongs(prev => prev.includes(song.id) ? prev.filter(id => id !== song.id) : [...prev, song.id])} className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition text-xs ${selectedSongs.includes(song.id) ? 'border-orange-400 bg-orange-500/20' : 'border-slate-600 bg-slate-700/50 hover:bg-slate-700'}`} whileHover={{ x: 2 }}>
                      <input type="checkbox" checked={selectedSongs.includes(song.id)} readOnly className="rounded" />
                      <div className="flex-1 min-w-0"><p className="font-semibold text-white truncate">{song.title}</p><p className="text-xs text-slate-400">{song.artist}</p></div>
                    </motion.div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <motion.button onClick={() => setAddSongModal(false)} whileHover={{ scale: 1.02 }} className="flex-1 rounded-lg bg-slate-700 py-2 text-sm font-semibold text-white hover:bg-slate-600 transition">Cancel</motion.button>
                <motion.button onClick={() => { setAddSongModal(false); setSelectedSongs([]) }} whileHover={{ scale: 1.02 }} className="flex-1 rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition">Add {selectedSongs.length > 0 ? `(${selectedSongs.length})` : ""}</motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  const CreateSetlistModal = () => (
    <AnimatePresence>
      {createSetlistModal && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-2xl" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Create New Setlist</h2>
              <motion.button onClick={() => setCreateSetlistModal(false)} whileHover={{ rotate: 90 }} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></motion.button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Setlist Name" className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-300">Add Songs</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {RECENT_SONGS.map((song, idx) => (
                    <motion.div key={song.id} className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 p-2 hover:bg-slate-700" whileHover={{ x: 2 }}>
                      <input type="checkbox" className="rounded" />
                      <span className="text-xs text-white">{song.title} - {song.artist}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <motion.button onClick={() => setCreateSetlistModal(false)} whileHover={{ scale: 1.02 }} className="flex-1 rounded-lg bg-slate-700 py-2 text-sm font-semibold text-white hover:bg-slate-600 transition">Cancel</motion.button>
                <motion.button onClick={() => { setCreateSetlistModal(false) }} whileHover={{ scale: 1.02 }} className="flex-1 rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition">Create</motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  const UploadModal = () => (
    <AnimatePresence>
      {uploadModal && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-2xl" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Upload Resource</h2>
              <motion.button onClick={() => setUploadModal(false)} whileHover={{ rotate: 90 }} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></motion.button>
            </div>
            <div className="space-y-3">
              <motion.div className="rounded-lg border-2 border-dashed border-slate-600 bg-slate-700/30 p-5 text-center hover:border-orange-400 hover:bg-orange-500/5 transition cursor-pointer" whileHover={{ scale: 1.02 }}>
                <Upload className="mx-auto mb-2 h-6 w-6 text-orange-400" />
                <p className="text-sm font-semibold text-white">Drag files or click to select</p>
                <p className="text-xs text-slate-400">PDF, Images, Audio files</p>
              </motion.div>
              <div>
                <label className="text-xs font-semibold text-slate-300">Permissions</label>
                <div className="mt-2 space-y-1">
                  <motion.label className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 p-2 cursor-pointer hover:bg-slate-700" whileHover={{ x: 2 }}>
                    <input type="radio" name="permission" defaultChecked className="rounded" />
                    <span className="text-xs text-white">Private (Only me)</span>
                  </motion.label>
                  <motion.label className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 p-2 cursor-pointer hover:bg-slate-700" whileHover={{ x: 2 }}>
                    <input type="radio" name="permission" className="rounded" />
                    <span className="text-xs text-white">Team (Everyone can view)</span>
                  </motion.label>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <motion.button onClick={() => setUploadModal(false)} whileHover={{ scale: 1.02 }} className="flex-1 rounded-lg bg-slate-700 py-2 text-sm font-semibold text-white hover:bg-slate-600 transition">Cancel</motion.button>
                <motion.button onClick={() => setUploadModal(false)} whileHover={{ scale: 1.02 }} className="flex-1 rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition">Upload</motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // ─── EVENT DETAIL MODAL ────────────────────────────────────────────────────
  const EventDetailModal = () => (
    <AnimatePresence>
      {eventDetailModal && selectedEvent && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-2xl" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">{selectedEvent.title}</h2>
              <motion.button onClick={() => setEventDetailModal(false)} whileHover={{ rotate: 90 }} className="text-slate-400 hover:text-white"><X className="h-6 w-6" /></motion.button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <motion.div className="rounded-lg border border-slate-600 bg-slate-700/50 p-4" whileHover={{ x: 2 }}>
                  <div className="flex items-center gap-3 mb-2"><Calendar className="h-5 w-5 text-orange-400" /><span className="text-sm font-semibold text-slate-300">Date</span></div>
                  <p className="text-lg font-bold text-white">{selectedEvent.date}</p>
                </motion.div>
                <motion.div className="rounded-lg border border-slate-600 bg-slate-700/50 p-4" whileHover={{ x: 2 }}>
                  <div className="flex items-center gap-3 mb-2"><Clock className="h-5 w-5 text-orange-400" /><span className="text-sm font-semibold text-slate-300">Time</span></div>
                  <p className="text-lg font-bold text-white">{selectedEvent.time}</p>
                </motion.div>
              </div>
              <motion.div className="rounded-lg border border-slate-600 bg-slate-700/50 p-4" whileHover={{ x: 2 }}>
                <div className="flex items-center gap-3 mb-2"><MapPin className="h-5 w-5 text-orange-400" /><span className="text-sm font-semibold text-slate-300">Location</span></div>
                <p className="text-white">{selectedEvent.location}</p>
              </motion.div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-300">Assigned Team</h3>
                <div className="flex gap-3">{TEAM_MEMBERS.map(member => (<motion.div key={member.id} className="flex flex-col items-center gap-1" whileHover={{ scale: 1.1 }}><img src={member.avatar} alt={member.name} className="h-10 w-10 rounded-full border-2 border-orange-400" /><span className="text-xs font-semibold text-slate-300">{member.name}</span></motion.div>))}</div>
              </div>
              <div className="flex gap-3 pt-4">
                <motion.button onClick={() => setEventDetailModal(false)} whileHover={{ scale: 1.02 }} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-700 py-2 font-semibold text-white hover:bg-slate-600 transition"><Edit className="h-4 w-4" />Edit</motion.button>
                <motion.button onClick={() => setEventDetailModal(false)} whileHover={{ scale: 1.02 }} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-orange-500 py-2 font-semibold text-white hover:bg-orange-600 transition"><Users className="h-4 w-4" />Manage</motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // ─── TEAM MEMBER MODAL ────────────────────────────────────────────────────
  // ─── CHORDPRO MODAL ───────────────────────────────────────────────────────────

  const ChordProModal = () => (
    <AnimatePresence>
      {chordProModal && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">ChordPro Native</h2>
                <p className="text-sm text-slate-400 mt-2">Industry-standard ChordPro format support</p>
              </div>
              <motion.button
                onClick={() => setChordProModal(false)}
                whileHover={{ rotate: 90 }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </motion.button>
            </div>

            <div className="space-y-6">
              {/* Features */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-200">Features</h3>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#C09060]" /> Import .cho and .chordpro files
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#C09060]" /> Real-time chord formatting
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#C09060]" /> Auto transpose support
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#C09060]" /> Syntax validation with inline warnings
                  </li>
                </ul>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  onClick={() => setChordProModal(false)}
                  whileHover={{ scale: 1.02 }}
                  className="rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 transition-all"
                >
                  Close
                </motion.button>
                <motion.button
                  onClick={() => setChordProModal(false)}
                  whileHover={{ scale: 1.02 }}
                  className="rounded-lg bg-[#C09060] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B8860B] transition-all"
                >
                  Import File
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // ─── CONDUCTOR MODE MODAL ─────────────────────────────────────────────────────

  const ConductorModal = () => (
    <AnimatePresence>
      {conductorModal && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Conductor Mode</h2>
                <p className="text-sm text-slate-400 mt-2">Real-time sync across connected devices</p>
              </div>
              <motion.button
                onClick={() => setConductorModal(false)}
                whileHover={{ rotate: 90 }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </motion.button>
            </div>

            <div className="space-y-6">
              {/* Connection Status */}
              <div className="rounded-lg bg-slate-700/50 p-4 border border-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">Status:</span>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-3 w-3 rounded-full",
                      connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'syncing' ? 'bg-yellow-500' : 'bg-red-500'
                    )} />
                    <span className="text-sm text-slate-300 capitalize">{connectionStatus}</span>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-200">Features</h3>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#C09060]" /> Live synchronized scrolling
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#C09060]" /> Multi-device worship team sync
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#C09060]" /> Leader-controlled song navigation
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#C09060]" /> Live tempo and key updates
                  </li>
                </ul>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  onClick={() => { setConductorModal(false); setConnectionStatus('connected') }}
                  whileHover={{ scale: 1.02 }}
                  className="rounded-lg bg-[#C09060] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B8860B] transition-all"
                >
                  Start Session
                </motion.button>
                <motion.button
                  onClick={() => { setConductorModal(false); setConnectionStatus('syncing') }}
                  whileHover={{ scale: 1.02 }}
                  className="rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 transition-all"
                >
                  Join Session
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // ─── TEAM MEMBER MODAL ────────────────────────────────────────────────────────

  const TeamMemberModal = () => (
    <AnimatePresence>
      {teamMemberModal && selectedMember && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-2xl" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
            <div className="mb-6 text-center">
              <motion.img src={selectedMember.avatar} alt={selectedMember.name} className="mx-auto mb-4 h-20 w-20 rounded-full border-4 border-orange-400" whileHover={{ scale: 1.1 }} />
              <h2 className="text-2xl font-bold text-white">{selectedMember.name}</h2>
              <p className="text-sm text-orange-400 font-semibold mt-1">{selectedMember.role}</p>
            </div>
            <div className="space-y-3 mb-6">
              <motion.button whileHover={{ scale: 1.02, x: 4 }} className="w-full flex items-center justify-between rounded-lg border border-slate-600 bg-slate-700/50 p-3 hover:bg-slate-700 transition">
                <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-orange-400" /><span className="text-sm text-white">Call</span></div>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.02, x: 4 }} className="w-full flex items-center justify-between rounded-lg border border-slate-600 bg-slate-700/50 p-3 hover:bg-slate-700 transition">
                <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-orange-400" /><span className="text-sm text-white">Email</span></div>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.02, x: 4 }} className="w-full flex items-center justify-between rounded-lg border border-slate-600 bg-slate-700/50 p-3 hover:bg-slate-700 transition">
                <div className="flex items-center gap-3"><MessageSquare className="h-4 w-4 text-orange-400" /><span className="text-sm text-white">Message</span></div>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </motion.button>
            </div>
            <div className="flex gap-3">
              <motion.button onClick={() => setTeamMemberModal(false)} whileHover={{ scale: 1.02 }} className="flex-1 rounded-lg bg-slate-700 py-2 font-semibold text-white hover:bg-slate-600 transition">Close</motion.button>
              <motion.button onClick={() => setTeamMemberModal(false)} whileHover={{ scale: 1.02 }} className="flex-1 rounded-lg bg-orange-500 py-2 font-semibold text-white hover:bg-orange-600 transition">Assign</motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <AppShell>
      <motion.div 
        className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-4 py-8 md:px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mx-auto max-w-7xl">
          {/* Welcome Section */}
          <motion.div 
            className="mb-8"
            variants={fadeInUp}
            initial="initial"
            animate="animate"
          >
            <h1 className="text-4xl font-bold text-white">
              WELCOME BACK, SAM! <span className="text-2xl">👋</span>
            </h1>
            <p className="mt-2 text-slate-400">Here&apos;s what&apos;s happening with your worship ministry.</p>
          </motion.div>

          {/* Main Grid */}
          <motion.div 
            className="grid gap-6 lg:grid-cols-3"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {/* Left Column */}
            <motion.div className="lg:col-span-2 space-y-6" variants={staggerItem}>
              {/* Next Performance Card */}
              <motion.div variants={staggerItem}>
                <EventCard 
                  event={NEXT_EVENT} 
                  isNextEvent={true}
                  onClick={() => handleViewPlan(NEXT_EVENT.id)}
                />
              </motion.div>
              {/* My Service Plans section removed - now shown in modal */}

              {/* Quick Actions */}
              <motion.div 
                className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
              >
                <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-400">Quick Actions</h2>
                <motion.div 
                  className="grid grid-cols-2 gap-3"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {/* New Plan Button */}
                  <motion.div variants={staggerItem}>
                    <QuickActionCard
                      icon={<Plus className="h-4 w-4" />}
                      label="New Plan"
                      description="Create a new worship service plan"
                      shortcut="Ctrl+Shift+N"
                      onClick={() => setNewPlanModal(true)}
                    />
                  </motion.div>

                  {/* Setlist Hub Link */}
                  <motion.div variants={staggerItem}>
                    <Link
                      href="/setlist-hub"
                      className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition-all hover:border-[#C09060]/50 hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C09060]"
                    >
                      <motion.div
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C09060]/20 text-[#C09060]"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Music className="h-4 w-4" />
                      </motion.div>
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-200 text-center line-clamp-2">Setlist Hub</span>
                    </Link>
                  </motion.div>

                  {/* Add Song Button */}
                  <motion.div variants={staggerItem}>
                    <QuickActionCard
                      icon={<Plus className="h-4 w-4" />}
                      label="Add Song"
                      description="Add a new song to your library"
                      shortcut="Ctrl+Shift+A"
                      onClick={() => setAddSongModal(true)}
                    />
                  </motion.div>

                  {/* Upload Resource Button */}
                  <motion.div variants={staggerItem}>
                    <QuickActionCard
                      icon={<Upload className="h-4 w-4" />}
                      label="Upload Resource"
                      description="Upload worship materials or media"
                      shortcut="Ctrl+Shift+U"
                      onClick={() => setUploadModal(true)}
                    />
                  </motion.div>
                </motion.div>
              </motion.div>

              {/* Premium Features */}
              <motion.div
                variants={staggerItem}
                className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
              >
                <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-400">Premium Features</h2>
                <motion.div
                  className="grid grid-cols-1 md:grid-cols-2 gap-3"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {/* ChordPro Native Card */}
                  <motion.div variants={staggerItem}>
                    <PremiumFeatureCard
                      icon={<Code2 className="h-5 w-5" />}
                      title="ChordPro Native"
                      description="Industry-standard ChordPro format support with real-time rendering"
                      status="Native Support"
                      statusColor="green"
                      actions={[
                        { label: "Import File", onClick: () => setChordProModal(true) },
                        { label: "Learn More", onClick: () => setChordProModal(true) }
                      ]}
                    />
                  </motion.div>

                  {/* Conductor Mode Card */}
                  <motion.div variants={staggerItem}>
                    <PremiumFeatureCard
                      icon={<Radio className="h-5 w-5" />}
                      title="Conductor Mode"
                      description="Real-time sync across your entire worship team"
                      status="Live Sync"
                      statusColor="blue"
                      connectionStatus={connectionStatus}
                      actions={[
                        { label: "Start Session", onClick: () => setConductorModal(true) },
                        { label: "Join Session", onClick: () => setConductorModal(true) }
                      ]}
                    />
                  </motion.div>
                </motion.div>
              </motion.div>

              {/* Combined Upcoming Events & Service Plans */}
              <motion.div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Upcoming Events & Plans</h2>
                  <button className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors">
                    View all
                  </button>
                </div>
                <div className="space-y-3">
                  {/* Combined and sorted events and service plans */}
                  <motion.div
                    variants={listStagger.container}
                    initial="initial"
                    animate="animate"
                    className="space-y-3"
                  >
                    {/* Upcoming Events */}
                    {UPCOMING_EVENTS.map((event) => (
                      <motion.div key={event.id} variants={listStagger.item} onClick={() => { setSelectedEvent(event); setEventDetailModal(true) }} whileHover={{ x: 4 }}>
                        <EventCard event={event} onClick={() => { setSelectedEvent(event); setEventDetailModal(true) }} />
                      </motion.div>
                    ))}
                    {/* Service Plans */}
                    {SERVICE_PLANS.map((plan, idx) => (
                      <motion.div
                        key={plan.id}
                        variants={listStagger.item}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <ServicePlanCard
                          plan={plan}
                          onClick={() => handleViewPlan(plan.id)}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              </motion.div>

              {/* Recent Songs */}
              <motion.div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Recent Songs</h2>
                  <button className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors">
                    View all
                  </button>
                </div>
                <div className="space-y-3">
                  <motion.div
                    variants={listStagger.container}
                    initial="initial"
                    animate="animate"
                    className="space-y-3"
                  >
                    {RECENT_SONGS.map((song) => (
                      <motion.div 
                        key={song.id} 
                        variants={listStagger.item}
                        whileHover={{ x: 4, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <SongCard 
                          song={song} 
                          onClick={() => {
                            setSelectedSong(song)
                            setLyricsModalOpen(true)
                          }}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>

            {/* Right Column */}
            <motion.div className="space-y-6" variants={staggerItem}>
              {/* Team Section */}
              <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Team</h2>
                  <button className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors">
                    View all
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <motion.div
                    className="flex items-center gap-3"
                    variants={{
                      animate: {
                        transition: { staggerChildren: 0.06, delayChildren: 0.1 },
                      },
                    }}
                    initial="initial"
                    animate="animate"
                  >
                    {TEAM_MEMBERS.map((member) => (
                      <motion.div
                        key={member.id}
                        onClick={() => { setSelectedMember(member); setTeamMemberModal(true) }}
                        className="group relative h-10 w-10 flex-shrink-0 cursor-pointer"
                        title={member.name}
                        variants={{
                          initial: { opacity: 0, scale: 0.8 },
                          animate: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 25 } },
                        }}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.95 }}
                      >
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="h-full w-full rounded-full border-2 border-slate-700 object-cover transition-all group-hover:border-orange-400"
                        crossOrigin="anonymous"
                      />
                      <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 group-hover:block">
                        {member.name}
                      </div>
                    </motion.div>
                    ))}
                  </motion.div>
                </div>
              </div>

              {/* Premium Features / Upcoming Additions */}
              <motion.div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
                {/* Placeholder for premium features or future content */}
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Modals */}
      <ServicePlanModal 
        isOpen={isPlanModalOpen}
        plan={selectedPlan}
        onClose={() => {
          setIsPlanModalOpen(false)
          setSelectedPlan(null)
        }}
      />
      <NewPlanModal />
      <AddSongModal />
      <CreateSetlistModal />
      <UploadModal />
      <EventDetailModal />
      <TeamMemberModal />
      <ChordProModal />
      <ConductorModal />

      {/* Lyrics Modal */}
      <LyricsModal
        song={selectedSong}
        isOpen={lyricsModalOpen}
        onClose={() => {
          setLyricsModalOpen(false)
          setSelectedSong(null)
        }}
      />
      <EventDetailModal />
      <TeamMemberModal />
      <ChordProModal />
      <ConductorModal />
    </AppShell>
  )
}

// ─── Page Wrapper with Provider ────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  )
}
