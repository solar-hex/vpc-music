'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { 
  Trophy, 
  Zap, 
  Users, 
  Music, 
  Award, 
  Target,
  TrendingUp,
  Check,
} from 'lucide-react'

interface ProfileStats {
  songsCreated: number
  setlistsManaged: number
  teamMembers: number
  eventsLed: number
  followers: number
  yearsExperience: number
}

interface Achievement {
  id: string
  name: string
  icon: string
  date: string
  description: string
}

interface Skill {
  name: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
}

interface SamCarterProfileProps {
  stats?: ProfileStats
  achievements?: Achievement[]
  skills?: Skill[]
  joinDate?: string
}

const DEFAULT_STATS: ProfileStats = {
  songsCreated: 247,
  setlistsManaged: 54,
  teamMembers: 12,
  eventsLed: 89,
  followers: 342,
  yearsExperience: 8,
}

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: '1',
    name: 'Master Conductor',
    icon: '🎼',
    date: '2024-01-15',
    description: 'Led 100 worship services',
  },
  {
    id: '2',
    name: 'Song Architect',
    icon: '🏗️',
    date: '2024-02-20',
    description: 'Created 200+ songs',
  },
  {
    id: '3',
    name: 'Team Builder',
    icon: '👥',
    date: '2024-03-10',
    description: 'Built a team of 10+ members',
  },
  {
    id: '4',
    name: 'Innovation Pioneer',
    icon: '⚡',
    date: '2024-04-05',
    description: 'Pioneered new worship techniques',
  },
]

const DEFAULT_SKILLS: Skill[] = [
  { name: 'Vocal Leading', level: 'expert' },
  { name: 'Music Arrangement', level: 'advanced' },
  { name: 'Team Leadership', level: 'expert' },
  { name: 'Worship Composition', level: 'advanced' },
  { name: 'Audio Production', level: 'intermediate' },
  { name: 'Event Planning', level: 'advanced' },
]

const getLevelColor = (level: Skill['level']) => {
  switch (level) {
    case 'beginner':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    case 'intermediate':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    case 'advanced':
      return 'bg-[#C09060]/20 text-[#C09060] border-[#C09060]/30'
    case 'expert':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  }
}

export function ProfileCard({
  stats = DEFAULT_STATS,
  achievements = DEFAULT_ACHIEVEMENTS,
  skills = DEFAULT_SKILLS,
  joinDate = '2016-06-15',
}: SamCarterProfileProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Main Profile Card */}
      <motion.div
        className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-8"
        variants={itemVariants}
      >
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          {/* Avatar */}
          <div className="relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-[#C09060]/30 flex-shrink-0">
            <Image
              src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&fit=crop"
              alt="Sam Carter"
              width={96}
              height={96}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-black text-white">SAM CARTER</h1>
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30"
              >
                <Check className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-semibold text-amber-300">Verified</span>
              </motion.div>
            </div>
            <p className="text-lg text-slate-300 mb-3">Worship Leader & Music Director</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1 text-slate-400">
                <Zap className="h-4 w-4 text-[#C09060]" />
                <span>{stats.yearsExperience} years experience</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <Users className="h-4 w-4 text-[#C09060]" />
                <span>{stats.followers.toLocaleString()} followers</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <TrendingUp className="h-4 w-4 text-[#C09060]" />
                <span>Member since {new Date(joinDate).getFullYear()}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Statistics Grid */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        variants={itemVariants}
      >
        {[
          { label: 'Songs Created', value: stats.songsCreated, icon: Music },
          { label: 'Setlists', value: stats.setlistsManaged, icon: Target },
          { label: 'Team Members', value: stats.teamMembers, icon: Users },
          { label: 'Events Led', value: stats.eventsLed, icon: Trophy },
          { label: 'Followers', value: stats.followers, icon: Zap },
          { label: 'Awards', value: achievements.length, icon: Award },
        ].map((stat, idx) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={idx}
              whileHover={{ y: -4 }}
              className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-center hover:bg-slate-800 transition-colors"
            >
              <Icon className="h-5 w-5 text-[#C09060] mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Skills Section */}
      <motion.div
        className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
        variants={itemVariants}
      >
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-[#C09060]" />
          Skills & Expertise
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {skills.map((skill, idx) => (
            <motion.div
              key={idx}
              whileHover={{ scale: 1.02 }}
              className={`rounded-lg px-4 py-3 border flex items-center justify-between ${getLevelColor(skill.level)}`}
            >
              <span className="font-semibold text-sm">{skill.name}</span>
              <span className="text-xs font-semibold uppercase opacity-75">{skill.level}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Achievements Section */}
      <motion.div
        className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
        variants={itemVariants}
      >
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[#C09060]" />
          Achievements
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {achievements.map((achievement) => (
            <motion.div
              key={achievement.id}
              whileHover={{ scale: 1.02 }}
              className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 hover:border-[#C09060]/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{achievement.icon}</div>
                <div className="flex-1">
                  <p className="font-bold text-white">{achievement.name}</p>
                  <p className="text-sm text-slate-400 mt-1">{achievement.description}</p>
                  <p className="text-xs text-slate-500 mt-2">{new Date(achievement.date).toLocaleDateString()}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Quick Stats Card */}
      <motion.div
        className="rounded-2xl border border-[#C09060]/30 bg-gradient-to-r from-[#C09060]/5 to-[#8B5CF6]/5 p-6"
        variants={itemVariants}
      >
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-3xl font-black text-[#C09060]">{stats.eventsLed}</p>
            <p className="text-sm text-slate-400 mt-1">Worship Services</p>
          </div>
          <div>
            <p className="text-3xl font-black text-[#C09060]">{(stats.songsCreated / stats.yearsExperience).toFixed(1)}</p>
            <p className="text-sm text-slate-400 mt-1">Songs/Year Avg</p>
          </div>
          <div>
            <p className="text-3xl font-black text-[#C09060]">{Math.round((stats.followers / stats.teamMembers) * 10) / 10}</p>
            <p className="text-sm text-slate-400 mt-1">Influence Ratio</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
