"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, CalendarDays, MapPin, Music, Users, Clock, Download, Share2, Copy, Play, Edit3 } from "lucide-react"
import { cn } from "@/lib/utils"

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

interface ServicePlanModalProps {
  isOpen: boolean
  plan: ServicePlan | null
  onClose: () => void
}

export function ServicePlanModal({ isOpen, plan, onClose }: ServicePlanModalProps) {
  if (!plan) return null

  const handleExport = () => {
    console.log("Export plan:", plan.id)
  }

  const handleShare = () => {
    console.log("Share plan:", plan.id)
  }

  const handleStartPresentation = () => {
    console.log("Start presentation for:", plan.id)
  }

  const handleOpenSetlist = () => {
    console.log("Open setlist for:", plan.id)
  }

  const handleDuplicate = () => {
    console.log("Duplicate plan:", plan.id)
  }

  const handleEdit = () => {
    console.log("Edit plan:", plan.id)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9997]"
          />

          {/* Modal - Slide Up from bottom on mobile, centered on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl max-h-[90vh] z-[9998] rounded-2xl overflow-hidden"
          >
            <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 border border-slate-700 shadow-2xl flex flex-col h-full">
              {/* Header with gradient */}
              <div className="relative overflow-hidden">
                {/* Background gradient accent */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#C09060]/20 to-transparent" />
                
                <div className="relative px-6 py-6 flex items-start justify-between border-b border-slate-700">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn(
                        "h-3 w-3 rounded-full",
                        plan.status === "active" ? "bg-green-400" : "bg-amber-400"
                      )} />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {plan.status === "active" ? "ACTIVE" : "UPCOMING"}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">{plan.title}</h2>
                    <p className="text-sm text-slate-400 mt-1">{plan.theme}</p>
                  </div>

                  {/* Close Button */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-white ml-4 flex-shrink-0"
                  >
                    <X className="h-5 w-5" />
                  </motion.button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-6 space-y-6">
                  {/* Event Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Date & Time */}
                    <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4 hover:border-slate-600 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarDays className="h-4 w-4 text-[#C09060]" />
                        <span className="text-xs text-slate-500 uppercase font-semibold">Date & Time</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{plan.date}</p>
                      <p className="text-sm text-slate-400">{plan.time}</p>
                    </div>

                    {/* Location */}
                    <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4 hover:border-slate-600 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-[#C09060]" />
                        <span className="text-xs text-slate-500 uppercase font-semibold">Location</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{plan.location}</p>
                    </div>

                    {/* Duration */}
                    <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4 hover:border-slate-600 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-[#C09060]" />
                        <span className="text-xs text-slate-500 uppercase font-semibold">Duration</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{plan.duration} minutes</p>
                    </div>

                    {/* Prepared By */}
                    <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4 hover:border-slate-600 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-[#C09060]" />
                        <span className="text-xs text-slate-500 uppercase font-semibold">Prepared By</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{plan.preparedBy}</p>
                    </div>
                  </div>

                  {/* Song Count */}
                  <div className="rounded-lg bg-gradient-to-r from-[#C09060]/10 to-transparent border border-[#C09060]/30 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Music className="h-4 w-4 text-[#C09060]" />
                      <span className="text-xs text-slate-400 uppercase font-semibold">Setlist</span>
                    </div>
                    <p className="text-lg font-bold text-white">{plan.songCount} Songs</p>
                    <p className="text-xs text-slate-400 mt-1">View complete setlist in the details</p>
                  </div>

                  {/* Notes */}
                  {plan.notes && (
                    <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4">
                      <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Planning Notes</p>
                      <p className="text-sm text-slate-300 leading-relaxed">{plan.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer with Action Buttons */}
              <div className="border-t border-slate-700 bg-slate-800/50 p-4 space-y-3">
                {/* Primary Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(192, 144, 96, 0.3)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleStartPresentation}
                    className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#C09060] to-[#B8860B] px-4 py-2.5 font-semibold text-white hover:from-[#B8860B] hover:to-[#A0722E] transition-all"
                  >
                    <Play className="h-4 w-4" />
                    <span className="text-sm">Start</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleOpenSetlist}
                    className="flex items-center justify-center gap-2 rounded-lg border border-[#C09060]/50 bg-[#C09060]/10 px-4 py-2.5 font-semibold text-[#C09060] hover:bg-[#C09060]/20 transition-all"
                  >
                    <Music className="h-4 w-4" />
                    <span className="text-sm">Setlist</span>
                  </motion.button>
                </div>

                {/* Secondary Actions */}
                <div className="grid grid-cols-4 gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleEdit}
                    className="flex items-center justify-center gap-1 rounded-lg border border-slate-600 bg-slate-700/30 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:bg-slate-700/50 transition-all"
                    title="Edit"
                  >
                    <Edit3 className="h-4 w-4" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDuplicate}
                    className="flex items-center justify-center gap-1 rounded-lg border border-slate-600 bg-slate-700/30 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:bg-slate-700/50 transition-all"
                    title="Duplicate"
                  >
                    <Copy className="h-4 w-4" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleExport}
                    className="flex items-center justify-center gap-1 rounded-lg border border-slate-600 bg-slate-700/30 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:bg-slate-700/50 transition-all"
                    title="Export"
                  >
                    <Download className="h-4 w-4" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleShare}
                    className="flex items-center justify-center gap-1 rounded-lg border border-slate-600 bg-slate-700/30 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:bg-slate-700/50 transition-all"
                    title="Share"
                  >
                    <Share2 className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
