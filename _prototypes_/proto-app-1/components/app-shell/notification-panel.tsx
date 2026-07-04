"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, X, Music, Calendar, Users, AlertCircle, Check, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  type: "upcoming" | "event" | "team" | "system"
  title: string
  message: string
  timestamp: Date
  read: boolean
  icon?: React.ReactNode
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "upcoming",
    title: "Sunday Morning Worship",
    message: "Performance in 2 days at 10:00 AM",
    timestamp: new Date(Date.now() - 3600000),
    read: false,
    icon: <Calendar className="h-4 w-4" />
  },
  {
    id: "2",
    type: "team",
    title: "Team Member Added",
    message: "Alex Johnson joined your worship team",
    timestamp: new Date(Date.now() - 7200000),
    read: false,
    icon: <Users className="h-4 w-4" />
  },
  {
    id: "3",
    type: "system",
    title: "Plan Updated",
    message: "Your setlist has been saved successfully",
    timestamp: new Date(Date.now() - 86400000),
    read: true,
    icon: <Check className="h-4 w-4" />
  },
  {
    id: "4",
    type: "event",
    title: "Youth Night Worship",
    message: "5 days until event at Youth Hall",
    timestamp: new Date(Date.now() - 172800000),
    read: true,
    icon: <Music className="h-4 w-4" />
  },
]

export function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [unreadCount, setUnreadCount] = useState(mockNotifications.filter(n => !n.read).length)
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length)
  }, [notifications])

  // Calculate panel position relative to button
  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    const timer = requestAnimationFrame(() => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      // Position panel above the button with offset
      const panelHeight = 400 // approximate height
      const topPosition = rect.top - panelHeight - 12
      const leftPosition = rect.left - 280
      
      setPanelPosition({
        top: Math.max(10, topPosition),
        left: Math.max(10, Math.min(leftPosition, window.innerWidth - 330)),
        width: 320
      })
    })

    return () => cancelAnimationFrame(timer)
  }, [isOpen])

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  const getNotificationColor = (type: Notification["type"]) => {
    switch (type) {
      case "upcoming":
        return "text-blue-400 bg-blue-500/10"
      case "event":
        return "text-purple-400 bg-purple-500/10"
      case "team":
        return "text-green-400 bg-green-500/10"
      case "system":
        return "text-amber-400 bg-amber-500/10"
      default:
        return "text-slate-400 bg-slate-500/10"
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      {/* Notification Bell Button */}
      <div className="relative" ref={containerRef}>
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          title="Notifications"
        >
          <Bell className="h-5 w-5 text-sidebar-foreground/70 hover:text-sidebar-foreground" />
          
          {/* Unread Badge */}
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute top-0 right-0 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center text-xs font-bold text-white"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Notification Panel Portal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[9998]"
              style={{ pointerEvents: "auto" }}
            />

            {/* Panel - Positioned outside sidebar */}
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              style={{
                position: "fixed",
                top: `${panelPosition.top}px`,
                left: `${panelPosition.left}px`,
                width: `${panelPosition.width}px`,
                zIndex: 9999,
              }}
              className="rounded-xl border border-slate-700 bg-slate-800 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-[#C09060]" />
                  <h3 className="font-semibold text-white">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="ml-auto text-xs font-semibold text-amber-400">
                      {unreadCount} new
                    </span>
                  )}
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto">
                <AnimatePresence mode="popLayout">
                  {notifications.length > 0 ? (
                    notifications.map((notification, idx) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => markAsRead(notification.id)}
                        className={cn(
                          "flex gap-3 px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors cursor-pointer",
                          !notification.read && "bg-slate-700/20"
                        )}
                      >
                        {/* Icon */}
                        <div className={cn("p-2 rounded-lg shrink-0 mt-0.5", getNotificationColor(notification.type))}>
                          {notification.icon || <AlertCircle className="h-4 w-4" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-semibold", !notification.read ? "text-white" : "text-slate-300")}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(notification.timestamp)}
                          </p>
                        </div>

                        {/* Unread Indicator & Delete */}
                        <div className="flex items-start gap-1">
                          {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                          )}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteNotification(notification.id)
                            }}
                            className="p-1 hover:bg-slate-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                            aria-label="Delete notification"
                          >
                            <X className="h-3.5 w-3.5 text-slate-400" />
                          </motion.button>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="py-8 px-4 text-center text-slate-400"
                    >
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No notifications yet</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer Actions */}
              {notifications.length > 0 && (
                <div className="flex gap-2 border-t border-slate-700 px-4 py-3 bg-slate-800/50">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={markAllAsRead}
                    disabled={unreadCount === 0}
                    className="flex-1 text-xs font-semibold text-slate-400 hover:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Mark all as read
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={clearAll}
                    className="flex-1 text-xs font-semibold text-red-400 hover:text-red-300 transition"
                  >
                    Clear all
                  </motion.button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
