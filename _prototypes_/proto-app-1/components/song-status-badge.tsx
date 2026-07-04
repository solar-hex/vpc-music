'use client'

import { motion } from 'framer-motion'
import {
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Music,
  Archive,
  Edit,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type SongStatus = 'READY' | 'NEEDS_REVIEW' | 'IN_REHEARSAL' | 'UPDATED' | 'MISSING_CHORDS' | 'ARCHIVED'

interface StatusConfig {
  id: SongStatus
  label: string
  icon: React.ComponentType<{ className?: string }>
  bgColor: string
  textColor: string
  borderColor: string
  pulseColor: string
  description: string
}

const STATUS_CONFIGS: Record<SongStatus, StatusConfig> = {
  READY: {
    id: 'READY',
    label: 'Ready',
    icon: CheckCircle,
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    pulseColor: 'emerald-400',
    description: 'Song is fully prepared and ready for performance',
  },
  NEEDS_REVIEW: {
    id: 'NEEDS_REVIEW',
    label: 'Needs Review',
    icon: AlertCircle,
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    pulseColor: 'amber-400',
    description: 'Song requires review before performance',
  },
  IN_REHEARSAL: {
    id: 'IN_REHEARSAL',
    label: 'In Rehearsal',
    icon: Edit,
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    pulseColor: 'blue-400',
    description: 'Song is currently being rehearsed',
  },
  UPDATED: {
    id: 'UPDATED',
    label: 'Updated',
    icon: RefreshCw,
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    pulseColor: 'purple-400',
    description: 'Song has recent updates',
  },
  MISSING_CHORDS: {
    id: 'MISSING_CHORDS',
    label: 'Missing Chords',
    icon: Music,
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    pulseColor: 'red-400',
    description: 'Song is missing chord chart or chord data',
  },
  ARCHIVED: {
    id: 'ARCHIVED',
    label: 'Archived',
    icon: Archive,
    bgColor: 'bg-slate-500/10',
    textColor: 'text-slate-400',
    borderColor: 'border-slate-500/30',
    pulseColor: 'slate-400',
    description: 'Song has been archived',
  },
}

interface SongStatusBadgeProps {
  status: SongStatus | undefined
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  showDescription?: boolean
  interactive?: boolean
  onClick?: () => void
}

export function SongStatusBadge({
  status,
  size = 'md',
  showLabel = true,
  showDescription = false,
  interactive = false,
  onClick,
}: SongStatusBadgeProps) {
  const config = status && STATUS_CONFIGS[status]

  if (!config) return null

  const Icon = config.icon
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  return (
    <motion.div
      whileHover={interactive ? { scale: 1.05 } : {}}
      whileTap={interactive ? { scale: 0.95 } : {}}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border transition-all',
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeClasses[size],
        interactive && 'cursor-pointer hover:shadow-lg'
      )}
    >
      <motion.div
        animate={status === 'READY' ? { opacity: [1, 0.6, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Icon className={iconSizes[size]} />
      </motion.div>

      {showLabel && <span className="font-medium">{config.label}</span>}

      {showDescription && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs whitespace-nowrap pointer-events-none z-50">
          {config.description}
        </div>
      )}
    </motion.div>
  )
}

interface SongStatusBoardProps {
  songs: Array<{ id: string; title: string; status?: SongStatus }>
  onStatusChange?: (songId: string, newStatus: SongStatus) => void
}

export function SongStatusBoard({
  songs,
  onStatusChange,
}: SongStatusBoardProps) {
  const statusCounts = songs.reduce(
    (acc, song) => {
      const status = song.status || 'READY'
      return {
        ...acc,
        [status]: (acc[status] || 0) + 1,
      }
    },
    {} as Record<SongStatus, number>
  )

  const totalSongs = songs.length
  const readySongs = statusCounts.READY || 0
  const readyPercentage = Math.round((readySongs / totalSongs) * 100)

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Setlist Readiness</h3>
          <span className="text-xl font-bold text-emerald-400">{readyPercentage}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
          <motion.div
            animate={{ width: `${readyPercentage}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          {readySongs} of {totalSongs} songs ready for performance
        </p>
      </div>

      {/* Status Distribution */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(STATUS_CONFIGS).map(([statusId, config]) => {
          const count = statusCounts[statusId as SongStatus] || 0
          const Icon = config.icon

          return (
            <motion.div
              key={statusId}
              whileHover={{ scale: 1.02 }}
              className={cn(
                'rounded-lg border p-3 transition-all',
                config.bgColor,
                config.borderColor,
                count > 0 ? 'cursor-pointer hover:shadow-lg' : 'opacity-50'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn('h-4 w-4', config.textColor)} />
                <span className={cn('text-xs font-semibold', config.textColor)}>
                  {config.label}
                </span>
              </div>
              <p className="text-2xl font-bold text-white">{count}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Songs by Status */}
      <div className="space-y-3">
        {Object.entries(STATUS_CONFIGS).map(([statusId, config]) => {
          const statusSongs = songs.filter(s => (s.status || 'READY') === statusId)

          if (statusSongs.length === 0) return null

          const Icon = config.icon

          return (
            <motion.div
              key={statusId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-lg border p-4',
                config.bgColor,
                config.borderColor
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className={cn('h-4 w-4', config.textColor)} />
                <h4 className={cn('font-semibold', config.textColor)}>
                  {config.label} ({statusSongs.length})
                </h4>
              </div>

              <div className="space-y-2">
                {statusSongs.map(song => (
                  <motion.div
                    key={song.id}
                    whileHover={{ x: 2 }}
                    className="flex items-center justify-between p-2 rounded bg-slate-800/50"
                  >
                    <span className="text-sm text-white">{song.title}</span>
                    {onStatusChange && (
                      <select
                        value={song.status || 'READY'}
                        onChange={(e) => onStatusChange(song.id, e.target.value as SongStatus)}
                        className="text-xs rounded bg-slate-700 text-white border border-slate-600 px-2 py-1 cursor-pointer hover:border-slate-500"
                      >
                        {Object.values(STATUS_CONFIGS).map(s => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export { STATUS_CONFIGS }
export type { SongStatus }
