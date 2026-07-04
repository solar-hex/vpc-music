'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, ChevronDown, Copy, Share2, Download, Archive, Eye, FileText, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cardStagger, listStagger, tapScale, hoverLift, pageEnter, pageExit } from '@/lib/animations'
import { useDashboardState, DashboardProvider } from '@/lib/dashboard-context'

interface PlanTask {
  id: string
  title: string
  description: string
  status: 'todo' | 'in-progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  assignee?: string
  dueDate?: string
  subtasks?: { id: string; title: string; completed: boolean }[]
}

interface Plan {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  status: 'draft' | 'active' | 'archived' | 'completed'
  tasks: PlanTask[]
  progress: number
  owner: string
  collaborators: string[]
  tags: string[]
}

// Mock data for demonstration
const MOCK_PLANS: Plan[] = [
  {
    id: 'plan-1',
    name: 'Animation & UX Enhancements',
    description: 'Implement dynamic animations and improve user experience across the application',
    createdAt: '2024-01-15',
    updatedAt: '2024-01-20',
    status: 'active',
    owner: 'Design Team',
    collaborators: ['Frontend Team', 'Product Manager'],
    tags: ['animation', 'ux', 'framer-motion'],
    progress: 85,
    tasks: [
      {
        id: 'task-1',
        title: 'Expand animation library',
        description: 'Add 30+ new animation variants and utilities',
        status: 'completed',
        priority: 'high',
        assignee: 'Frontend Developer',
        dueDate: '2024-01-18',
      },
      {
        id: 'task-2',
        title: 'Enhance component animations',
        description: 'Add spring-based animations to key components',
        status: 'completed',
        priority: 'high',
        assignee: 'Frontend Developer',
        dueDate: '2024-01-19',
      },
      {
        id: 'task-3',
        title: 'Add page transitions',
        description: 'Implement smooth cross-page navigation animations',
        status: 'in-progress',
        priority: 'medium',
        assignee: 'Frontend Developer',
        dueDate: '2024-01-22',
      },
    ],
  },
  {
    id: 'plan-2',
    name: 'Live Lyrics Optimization',
    description: 'Redesign and optimize song table/card layout for live performance',
    createdAt: '2024-01-10',
    updatedAt: '2024-01-20',
    status: 'completed',
    owner: 'Product Team',
    collaborators: ['Design Team'],
    tags: ['lyrics', 'performance', 'ui'],
    progress: 100,
    tasks: [
      {
        id: 'task-4',
        title: 'Remove song title from table',
        description: 'Minimize header and remove redundant song info',
        status: 'completed',
        priority: 'high',
        assignee: 'Designer',
        dueDate: '2024-01-12',
      },
      {
        id: 'task-5',
        title: 'Expand lyrics viewing area',
        description: 'Increase vertical space and optimize readability',
        status: 'completed',
        priority: 'high',
        assignee: 'Frontend Developer',
        dueDate: '2024-01-15',
      },
    ],
  },
  {
    id: 'plan-3',
    name: 'Modal Layout & Overflow Fixes',
    description: 'Fix modal layout and overflow behavior for responsive design',
    createdAt: '2024-01-08',
    updatedAt: '2024-01-18',
    status: 'completed',
    owner: 'Frontend Team',
    collaborators: ['QA Team'],
    tags: ['modal', 'responsive', 'bug-fix'],
    progress: 100,
    tasks: [
      {
        id: 'task-6',
        title: 'Implement adaptive positioning',
        description: 'Add smart vertical and horizontal positioning',
        status: 'completed',
        priority: 'high',
        assignee: 'Frontend Developer',
        dueDate: '2024-01-10',
      },
    ],
  },
]

const STATUS_COLORS = {
  draft: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  active: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'in-progress': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  archived: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
}

const PRIORITY_COLORS = {
  low: 'text-slate-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
}

// ─── Main Plans Content Component ───────────────────────────────────────────

function PlansContent() {
  const router = useRouter()
  const { updateScrollPosition } = useDashboardState()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Plan['status'] | 'all'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'progress' | 'name'>('recent')
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Filter and search
  const filteredPlans = useMemo(() => {
    let result = MOCK_PLANS

    if (searchQuery) {
      result = result.filter(
        (plan) =>
          plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          plan.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          plan.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((plan) => plan.status === statusFilter)
    }

    // Sort
    if (sortBy === 'progress') {
      result.sort((a, b) => b.progress - a.progress)
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }

    return result
  }, [searchQuery, statusFilter, sortBy])

  const stats = useMemo(() => ({
    total: MOCK_PLANS.length,
    active: MOCK_PLANS.filter((p) => p.status === 'active').length,
    completed: MOCK_PLANS.filter((p) => p.status === 'completed').length,
    archived: MOCK_PLANS.filter((p) => p.status === 'archived').length,
    avgProgress: Math.round(MOCK_PLANS.reduce((sum, p) => sum + p.progress, 0) / MOCK_PLANS.length),
  }), [])

  return (
    <motion.div
      className="min-h-screen bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header with Back Navigation */}
      <motion.div 
        className="bg-gradient-to-r from-slate-900/50 to-slate-800/50 border-b border-slate-700/30 px-6 py-8 backdrop-blur-sm sticky top-0 z-40"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="flex items-center gap-4 mb-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05, type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Back Button */}
            <motion.button
              onClick={() => {
                // Animate out smoothly
                updateScrollPosition(0)
                router.push('/dashboard')
              }}
              whileHover={{ scale: 1.08, x: -3 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex-shrink-0 p-2 rounded-lg hover:bg-slate-700/60 transition-colors focus:outline-none focus:ring-2 focus:ring-[#C09060] focus:ring-offset-2 focus:ring-offset-background"
              aria-label="Back to Dashboard"
              title="Back to Dashboard (Alt + ←)"
            >
              <ArrowLeft className="h-5 w-5 md:h-6 md:w-6 text-[#C09060]" />
            </motion.button>

            {/* Page Title */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, type: 'spring', damping: 25, stiffness: 300 }}
            >
              <h1 className="text-3xl md:text-4xl font-bold text-white">View Plans</h1>
              <p className="text-slate-400 text-sm md:text-base">Explore and track all implementation plans, features, and initiatives</p>
            </motion.div>
          </motion.div>

          {/* Stats Grid */}
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8"
            initial="initial"
            animate="animate"
            variants={cardStagger.container}
          >
            {[
              { label: 'Total Plans', value: stats.total, color: 'text-blue-400' },
              { label: 'Active', value: stats.active, color: 'text-amber-400' },
              { label: 'Completed', value: stats.completed, color: 'text-emerald-400' },
              { label: 'Archived', value: stats.archived, color: 'text-slate-400' },
              { label: 'Avg Progress', value: `${stats.avgProgress}%`, color: 'text-[#C09060]' },
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-4"
                variants={cardStagger.item}
              >
                <p className="text-xs text-slate-400 mb-2">{stat.label}</p>
                <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Controls */}
        <motion.div 
          className="mb-8 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search plans by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/40 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C09060] transition-all"
            />
          </div>

          {/* Filters and Controls */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-4 py-2 bg-slate-800/50 border border-slate-700/40 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C09060]"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 bg-slate-800/50 border border-slate-700/40 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C09060]"
            >
              <option value="recent">Most Recent</option>
              <option value="progress">By Progress</option>
              <option value="name">By Name</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 ml-auto">
              <motion.button
                onClick={() => setViewMode('grid')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  viewMode === 'grid'
                    ? 'bg-[#C09060] text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-300'
                )}
              >
                Grid
              </motion.button>
              <motion.button
                onClick={() => setViewMode('list')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  viewMode === 'list'
                    ? 'bg-[#C09060] text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-300'
                )}
              >
                List
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Plans Grid/List */}
        {viewMode === 'grid' ? (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="initial"
            animate="animate"
            variants={cardStagger.container}
          >
            {filteredPlans.map((plan) => (
              <motion.div
                key={plan.id}
                className="group cursor-pointer"
                variants={cardStagger.item}
                onClick={() => setSelectedPlan(plan)}
              >
                <motion.div
                  className="bg-slate-800/50 border border-slate-700/40 rounded-lg overflow-hidden h-full flex flex-col hover:border-[#C09060]/40 transition-colors"
                  {...hoverLift(4)}
                  {...tapScale(0.12)}
                >
                  {/* Status Badge */}
                  <div className="px-4 pt-4 pb-0">
                    <div className="flex items-center justify-between mb-3">
                      <motion.span
                        className={cn(
                          'inline-block px-2 py-1 rounded-full text-xs font-semibold border',
                          STATUS_COLORS[plan.status]
                        )}
                        whileHover={{ scale: 1.05 }}
                      >
                        {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                      </motion.span>
                      <span className="text-sm font-bold text-[#C09060]">{plan.progress}%</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-4 pb-4 flex-1 flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#C09060] transition-colors">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-slate-400 mb-4 flex-1">{plan.description}</p>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500">Progress</span>
                        <span className="text-xs font-mono text-slate-400">{plan.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-700/40 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-[#C09060] to-[#B8860B] rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${plan.progress}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                        />
                      </div>
                    </div>

                    {/* Meta Info */}
                    <div className="space-y-2 text-xs text-slate-500 mb-4">
                      <p>Owner: {plan.owner}</p>
                      <p>Updated: {new Date(plan.updatedAt).toLocaleDateString()}</p>
                      <div className="flex flex-wrap gap-1 pt-2">
                        {plan.tags.map((tag) => (
                          <span key={tag} className="px-2 py-1 bg-slate-700/30 rounded text-slate-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Task Summary */}
                    <div className="text-xs text-slate-400 mb-4 p-2 bg-slate-900/30 rounded">
                      {plan.tasks.length} tasks • {plan.tasks.filter((t) => t.status === 'completed').length} completed
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 px-3 py-2 bg-[#C09060]/20 text-[#C09060] rounded-lg text-sm font-medium hover:bg-[#C09060]/30 transition-colors flex items-center justify-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-2 py-2 bg-slate-700/40 text-slate-400 rounded-lg hover:bg-slate-700/60 transition-colors"
                        title="Share plan"
                      >
                        <Share2 className="h-4 w-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-2 py-2 bg-slate-700/40 text-slate-400 rounded-lg hover:bg-slate-700/60 transition-colors"
                        title="Export plan"
                      >
                        <Download className="h-4 w-4" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          /* List View */
          <motion.div 
            className="space-y-3"
            initial="initial"
            animate="animate"
            variants={listStagger.container}
          >
            {filteredPlans.map((plan) => (
              <motion.div
                key={plan.id}
                className="group cursor-pointer"
                variants={listStagger.item}
                onClick={() => setSelectedPlan(plan)}
              >
                <motion.div
                  className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-4 hover:border-[#C09060]/40 transition-colors"
                  {...hoverLift(2)}
                  {...tapScale(0.12)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-white group-hover:text-[#C09060] transition-colors">
                          {plan.name}
                        </h3>
                        <span
                          className={cn(
                            'inline-block px-2 py-1 rounded-full text-xs font-semibold border whitespace-nowrap',
                            STATUS_COLORS[plan.status]
                          )}
                        >
                          {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mb-3">{plan.description}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Owner: {plan.owner}</span>
                        <span>Tasks: {plan.tasks.length}</span>
                        <span>Updated: {new Date(plan.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 whitespace-nowrap">
                      <span className="text-sm font-bold text-[#C09060]">{plan.progress}%</span>
                      <div className="w-32 h-2 bg-slate-700/40 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-[#C09060] to-[#B8860B]"
                          initial={{ width: 0 }}
                          animate={{ width: `${plan.progress}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-1.5 hover:bg-slate-700/60 rounded transition-colors"
                        >
                          <Eye className="h-4 w-4 text-slate-400" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-1.5 hover:bg-slate-700/60 rounded transition-colors"
                        >
                          <Share2 className="h-4 w-4 text-slate-400" />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {filteredPlans.length === 0 && (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <FileText className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No plans found</p>
            <p className="text-slate-500 text-sm">Try adjusting your search or filter criteria</p>
          </motion.div>
        )}
      </div>

      {/* Detailed Plan Modal */}
      <AnimatePresence>
        {selectedPlan && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPlan(null)}
          >
            <motion.div
              className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-b from-slate-800 to-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">{selectedPlan.name}</h2>
                  <p className="text-sm text-slate-400">{selectedPlan.description}</p>
                </div>
                <motion.button
                  onClick={() => setSelectedPlan(null)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 hover:bg-slate-700/60 rounded-lg transition-colors"
                >
                  <ChevronDown className="h-6 w-6 text-slate-400 rotate-180" />
                </motion.button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Meta Information */}
                <motion.div 
                  className="grid grid-cols-2 md:grid-cols-4 gap-4"
                  initial="initial"
                  animate="animate"
                  variants={cardStagger.container}
                >
                  {[
                    { label: 'Status', value: selectedPlan.status },
                    { label: 'Progress', value: `${selectedPlan.progress}%` },
                    { label: 'Owner', value: selectedPlan.owner },
                    { label: 'Updated', value: new Date(selectedPlan.updatedAt).toLocaleDateString() },
                  ].map((info, idx) => (
                    <motion.div key={idx} className="bg-slate-800/50 rounded-lg p-3" variants={cardStagger.item}>
                      <p className="text-xs text-slate-500 mb-1">{info.label}</p>
                      <p className="text-sm font-semibold text-white">{info.value}</p>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Collaborators */}
                {selectedPlan.collaborators.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-white mb-3">Collaborators</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedPlan.collaborators.map((collab) => (
                        <span key={collab} className="px-3 py-1 bg-slate-700/50 rounded-full text-xs text-slate-300">
                          {collab}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tasks */}
                <div>
                  <h3 className="text-sm font-bold text-white mb-3">
                    Tasks ({selectedPlan.tasks.filter((t) => t.status === 'completed').length}/{selectedPlan.tasks.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedPlan.tasks.map((task, idx) => (
                      <motion.div
                        key={task.id}
                        className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-3"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn('h-5 w-5 rounded border mt-1 flex-shrink-0', 
                            task.status === 'completed' ? 'bg-emerald-500/20 border-emerald-500' : 'border-slate-600'
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className={cn('font-medium', task.status === 'completed' ? 'text-slate-400 line-through' : 'text-white')}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs">
                              {task.priority && (
                                <span className={cn('font-semibold', PRIORITY_COLORS[task.priority])}>
                                  {task.priority.toUpperCase()}
                                </span>
                              )}
                              {task.assignee && <span className="text-slate-500">{task.assignee}</span>}
                              {task.dueDate && <span className="text-slate-500">{new Date(task.dueDate).toLocaleDateString()}</span>}
                            </div>
                          </div>
                          <span className={cn('px-2 py-1 rounded text-xs font-semibold whitespace-nowrap', 
                            task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : 
                            task.status === 'in-progress' ? 'bg-blue-500/20 text-blue-300' :
                            'bg-slate-700/40 text-slate-400'
                          )}>
                            {task.status === 'in-progress' ? 'In Progress' : 
                             task.status === 'completed' ? 'Done' : 'To Do'}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-slate-700">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 px-4 py-2 bg-[#C09060] text-white rounded-lg font-medium hover:bg-[#B8860B] transition-colors flex items-center justify-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    View Full Details
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 bg-slate-700/40 text-slate-300 rounded-lg font-medium hover:bg-slate-700/60 transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 bg-slate-700/40 text-slate-300 rounded-lg font-medium hover:bg-slate-700/60 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Page Wrapper with Provider ────────────────────────────────────────────

export default function PlansPage() {
  return (
    <DashboardProvider>
      <PlansContent />
    </DashboardProvider>
  )
}
