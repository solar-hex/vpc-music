'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/app-shell'
import { AppearanceSettings } from '@/components/appearance-settings'
import { ProfileCard } from '@/components/profile-card'
import { useChordNotation, type ChordNotation } from '@/lib/chord-notation-context'
import {
  Settings,
  Bell,
  Lock,
  User,
  Palette,
  Volume2,
  Save,
  X,
  Check,
  ChevronRight,
  Mail,
  Eye,
  EyeOff,
  Music,
  Shield,
  Smartphone,
  LogOut,
  Download,
  Sliders,
  Zap,
  Waves,
  Play,
  Power,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsSection {
  id: string
  title: string
  description: string
  icon: React.ReactNode
}

interface NotificationSetting {
  id: string
  title: string
  description: string
  enabled: boolean
}

interface Theme {
  id: string
  name: string
  colors: {
    primary: string
    accent: string
  }
}

const THEMES: Theme[] = [
  { id: 'custom', name: 'Custom', colors: { primary: '#102040', accent: '#C09060' } },
  { id: 'stage-dark', name: 'Stage Dark', colors: { primary: '#0a1520', accent: '#C09060' } },
  { id: 'print-light', name: 'Print Light', colors: { primary: '#F5F5F5', accent: '#8B7355' } },
  { id: 'classic', name: 'Classic', colors: { primary: '#1a1a1a', accent: '#9B8B7E' } },
]

const NOTIFICATION_SETTINGS: NotificationSetting[] = [
  {
    id: 'email-updates',
    title: 'Email Updates',
    description: 'Receive emails about service plan changes and updates',
    enabled: true,
  },
  {
    id: 'song-notifications',
    title: 'Song Notifications',
    description: 'Get alerts when songs are added or modified in setlists',
    enabled: true,
  },
  {
    id: 'team-mentions',
    title: 'Team Mentions',
    description: 'Notifications when team members mention you',
    enabled: true,
  },
  {
    id: 'daily-digest',
    title: 'Daily Digest',
    description: 'Receive a daily summary of activities',
    enabled: false,
  },
  {
    id: 'event-reminders',
    title: 'Event Reminders',
    description: 'Reminders for upcoming services and rehearsals',
    enabled: true,
  },
]

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'profile',
    title: 'Profile',
    description: 'Manage your personal information',
    icon: <User className="h-5 w-5" />,
  },
  {
    id: 'appearance',
    title: 'Appearance',
    description: 'Customize theme and display options',
    icon: <Palette className="h-5 w-5" />,
  },
  {
    id: 'chord-notation',
    title: 'Chord Notation',
    description: 'Choose your preferred chord symbol style',
    icon: <Music className="h-5 w-5" />,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Control how you receive updates',
    icon: <Bell className="h-5 w-5" />,
  },
  {
    id: 'privacy',
    title: 'Privacy & Security',
    description: 'Manage your data and security settings',
    icon: <Lock className="h-5 w-5" />,
  },
  {
    id: 'audio',
    title: 'Audio Settings',
    description: 'Configure audio playback preferences',
    icon: <Volume2 className="h-5 w-5" />,
  },
]

export default function SettingsPage() {
  const { notation, setNotation } = useChordNotation()
  const [activeSection, setActiveSection] = useState('profile')
  const [mounted, setMounted] = useState(false)
  const [notifications, setNotifications] = useState<NotificationSetting[]>(NOTIFICATION_SETTINGS)
  const [selectedTheme, setSelectedTheme] = useState('custom')
  const [selectedMode, setSelectedMode] = useState('dark')
  const [selectedContrast, setSelectedContrast] = useState('normal')
  const [editorMode, setEditorMode] = useState('beginner')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [profileData, setProfileData] = useState({
    email: 'guitar@vpc.church',
    displayName: 'Sam Carter',
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [chordColors, setChordColors] = useState({
    primary: '#CA9762',
    secondary: '#8B5CF6',
    background: '#F8F9FA',
  })

  // Privacy & Security Settings
  const [privacySettings, setPrivacySettings] = useState({
    dataCollection: true,
    analyticsTracking: false,
    twoFactorAuth: false,
    loginAlerts: true,
    sessionTimeout: 30,
    deviceLimit: 5,
  })

  // Audio Settings
  const [audioSettings, setAudioSettings] = useState({
    volume: 75,
    playbackSpeed: 1.0,
    autoPlay: false,
    loopMode: 'off' as 'off' | 'single' | 'all',
    visualizer: true,
    equalizerPreset: 'flat' as 'flat' | 'bass' | 'treble' | 'vocal',
    metronome: false,
    metronomeTempo: 120,
    metronomVolume: 50,
  })

  const [exportFormat, setExportFormat] = useState('json')

  const handleNotificationToggle = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, enabled: !n.enabled } : n))
  }

  const handleProfileChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }))
  }

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveProfile = () => {
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  const handleChangePassword = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Passwords do not match')
      return
    }
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-5xl font-black text-white">Settings</h1>
          <p className="mt-2 text-sm uppercase tracking-widest text-slate-500">Manage your account, preferences, and system configuration</p>
        </div>

        {/* Main Content */}
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Sidebar Navigation */}
          <motion.div
            className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-4 h-fit lg:col-span-1"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="space-y-2">
              {SETTINGS_SECTIONS.map(section => (
                <motion.button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  variants={itemVariants}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-all",
                    activeSection === section.id
                      ? 'bg-[#C09060]/20 text-[#C09060]'
                      : 'text-slate-300 hover:bg-slate-700/50'
                  )}
                  whileHover={{ x: 4 }}
                >
                  {section.icon}
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{section.title}</p>
                  </div>
                  {activeSection === section.id && <ChevronRight className="h-4 w-4" />}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Main Settings Panel */}
          <motion.div className="lg:col-span-3 space-y-6" variants={containerVariants} initial="hidden" animate="visible">
            <AnimatePresence mode="wait">
              {/* Profile Settings */}
              {activeSection === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Advanced Profile Card */}
                  <ProfileCard />

                  {/* Profile Editing Section */}
                  <motion.div
                    className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
                    variants={itemVariants}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <User className="h-5 w-5 text-[#C09060]" />
                      <h2 className="text-2xl font-bold text-white">Profile Settings</h2>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Email</label>
                        <input
                          type="email"
                          value={profileData.email}
                          onChange={e => handleProfileChange('email', e.target.value)}
                          className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#C09060] outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Display Name</label>
                        <input
                          type="text"
                          value={profileData.displayName}
                          onChange={e => handleProfileChange('displayName', e.target.value)}
                          className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#C09060] outline-none transition-all"
                        />
                      </div>
                      <motion.button
                        onClick={handleSaveProfile}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-2 rounded-lg bg-[#C09060] px-6 py-3 font-semibold text-white hover:bg-[#B8860B] transition-all"
                      >
                        <Save className="h-4 w-4" />
                        Save Profile
                      </motion.button>
                    </div>
                  </motion.div>

                  {/* Change Password Section */}
                  <motion.div
                    className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
                    variants={itemVariants}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <Lock className="h-5 w-5 text-[#C09060]" />
                      <h2 className="text-2xl font-bold text-white">Change Password</h2>
                    </div>

                    <div className="space-y-4">
                      <div className="relative">
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Current Password</label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={passwordData.currentPassword}
                            onChange={e => handlePasswordChange('currentPassword', e.target.value)}
                            className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#C09060] outline-none transition-all pr-10"
                          />
                          <button
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">New Password</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={passwordData.newPassword}
                            onChange={e => handlePasswordChange('newPassword', e.target.value)}
                            className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#C09060] outline-none transition-all pr-10"
                          />
                          <button
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Confirm New Password</label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={passwordData.confirmPassword}
                            onChange={e => handlePasswordChange('confirmPassword', e.target.value)}
                            className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#C09060] outline-none transition-all pr-10"
                          />
                          <button
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <motion.button
                        onClick={handleChangePassword}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-2 rounded-lg bg-[#C09060] px-6 py-3 font-semibold text-white hover:bg-[#B8860B] transition-all"
                      >
                        <Lock className="h-4 w-4" />
                        Change Password
                      </motion.button>

                      {/* User ID Display */}
                      <div className="mt-8 pt-6 border-t border-slate-700">
                        <p className="text-xs text-slate-400">User ID: 8bbd67f5-5536-4aba-afa-55b83a99f187</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Success Toast */}
                  <AnimatePresence>
                    {saveSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="fixed bottom-6 right-6 flex items-center gap-3 rounded-lg bg-green-500/20 border border-green-500/50 px-4 py-3 text-green-300"
                      >
                        <Check className="h-5 w-5" />
                        Changes saved successfully
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Appearance Settings */}
              {activeSection === 'appearance' && (
                <motion.div
                  key="appearance"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="rounded-2xl border border-border bg-card p-6"
                >
                  <div className="mb-8 flex items-center gap-3">
                    <Palette className="h-6 w-6 text-accent" />
                    <h2 className="text-2xl font-bold text-foreground">Appearance & Theme</h2>
                  </div>

                  <AppearanceSettings />
                </motion.div>
              )}

              {/* Chord Notation Settings */}
              {activeSection === 'chord-notation' && (
                <motion.div
                  key="chord-notation"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
                >
                  <div className="mb-8 flex items-center gap-3">
                    <Music className="h-6 w-6 text-[#C09060]" />
                    <h2 className="text-2xl font-bold text-white">Chord Notation Preference</h2>
                  </div>

                  <div className="space-y-6">
                    {/* Chord Notation Selection */}
                    <div>
                      <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-300">Select Your Preferred Notation</h3>
                      <p className="mb-4 text-sm text-slate-400">Choose how chord symbols are displayed throughout the app. This preference will be applied to all songs, chord sheets, setlists, and live views.</p>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { 
                            id: 'sharp' as ChordNotation, 
                            label: 'Sharp (#)',
                            examples: 'C#, F#, G#',
                            description: 'Use sharp symbols for raised notes'
                          },
                          { 
                            id: 'flat' as ChordNotation, 
                            label: 'Flat (♭)',
                            examples: 'Db, Gb, Ab',
                            description: 'Use flat symbols for lowered notes'
                          },
                        ].map(option => (
                          <motion.button
                            key={option.id}
                            onClick={() => setNotation(option.id)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              'rounded-lg border-2 p-6 text-left transition-all',
                              notation === option.id
                                ? 'border-[#C09060] bg-[#C09060]/15'
                                : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-lg font-bold text-white">{option.label}</p>
                                <p className="text-xs text-slate-400 mt-2">{option.description}</p>
                                <p className="text-sm text-[#C09060] font-mono mt-3">Examples: {option.examples}</p>
                              </div>
                              {notation === option.id && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="flex-shrink-0"
                                >
                                  <Check className="h-6 w-6 text-[#C09060]" />
                                </motion.div>
                              )}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Preview Section */}
                    <div className="rounded-lg border border-slate-600 bg-slate-700/50 p-4">
                      <h3 className="mb-3 text-sm font-bold text-slate-300">Live Preview</h3>
                      <div className="space-y-2 font-mono text-sm">
                        <div className="flex items-center justify-between py-2">
                          <span className="text-slate-400">Key:</span>
                          <span className="text-[#C09060]">{notation === 'sharp' ? 'C# Major' : 'Db Major'}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-slate-400">Chord progression:</span>
                          <span className="text-[#C09060]">{notation === 'sharp' ? 'C# - F# - G#' : 'Db - Gb - Ab'}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-slate-400">With modifier:</span>
                          <span className="text-[#C09060]">{notation === 'sharp' ? 'C#m7 - F#maj7 - G#sus4' : 'Dbm7 - Gbmaj7 - Absus4'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Auto-Apply Info */}
                    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0">
                          <Check className="h-5 w-5 text-blue-400 mt-0.5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-blue-300">Auto-applied everywhere</p>
                          <p className="text-xs text-blue-200 mt-1">Your preference will automatically apply to all song lyrics, chord sheets, transpose functions, setlists, and live lyric views. Changes take effect immediately.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Notification Settings */}
              {activeSection === 'notifications' && (
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
                >
                  <h2 className="mb-6 text-2xl font-bold text-white">Notification Preferences</h2>
                  <div className="space-y-4">
                    {notifications.map(notification => (
                      <motion.div
                        key={notification.id}
                        whileHover={{ x: 4 }}
                        className="flex items-center justify-between rounded-lg border border-slate-600 bg-slate-700/50 p-4 hover:bg-slate-700 transition-all"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-white">{notification.title}</p>
                          <p className="text-sm text-slate-400">{notification.description}</p>
                        </div>
                        <motion.button
                          onClick={() => handleNotificationToggle(notification.id)}
                          className={cn(
                            'relative h-8 w-14 rounded-full transition-all',
                            notification.enabled ? 'bg-[#C09060]' : 'bg-slate-600'
                          )}
                          whileHover={{ scale: 1.05 }}
                        >
                          <motion.div
                            className="absolute top-1 left-1 h-6 w-6 rounded-full bg-white"
                            animate={{
                              x: notification.enabled ? 24 : 0,
                            }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        </motion.button>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Privacy Settings */}
              {activeSection === 'privacy' && (
                <motion.div
                  key="privacy"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Data & Privacy */}
                  <motion.div
                    className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
                    variants={itemVariants}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <Shield className="h-5 w-5 text-[#C09060]" />
                      <h2 className="text-2xl font-bold text-white">Data & Privacy</h2>
                    </div>
                    <div className="space-y-4">
                      {/* Data Collection Toggle */}
                      <div className="flex items-center justify-between rounded-lg bg-slate-700/30 p-4">
                        <div>
                          <p className="font-semibold text-white">Data Collection</p>
                          <p className="text-sm text-slate-400">Allow us to collect usage data to improve your experience</p>
                        </div>
                        <button
                          onClick={() => setPrivacySettings(prev => ({ ...prev, dataCollection: !prev.dataCollection }))}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                            privacySettings.dataCollection ? 'bg-[#C09060]' : 'bg-slate-600'
                          }`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            privacySettings.dataCollection ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>

                      {/* Analytics Tracking Toggle */}
                      <div className="flex items-center justify-between rounded-lg bg-slate-700/30 p-4">
                        <div>
                          <p className="font-semibold text-white">Analytics Tracking</p>
                          <p className="text-sm text-slate-400">Help us understand how you use VPC Music</p>
                        </div>
                        <button
                          onClick={() => setPrivacySettings(prev => ({ ...prev, analyticsTracking: !prev.analyticsTracking }))}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                            privacySettings.analyticsTracking ? 'bg-[#C09060]' : 'bg-slate-600'
                          }`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            privacySettings.analyticsTracking ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>
                    </div>
                  </motion.div>

                  {/* Security Settings */}
                  <motion.div
                    className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
                    variants={itemVariants}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <Lock className="h-5 w-5 text-[#C09060]" />
                      <h2 className="text-2xl font-bold text-white">Security</h2>
                    </div>
                    <div className="space-y-4">
                      {/* Two-Factor Authentication */}
                      <div className="flex items-center justify-between rounded-lg bg-slate-700/30 p-4">
                        <div>
                          <p className="font-semibold text-white">Two-Factor Authentication</p>
                          <p className="text-sm text-slate-400">Add an extra layer of security to your account</p>
                        </div>
                        <motion.button
                          onClick={() => setPrivacySettings(prev => ({ ...prev, twoFactorAuth: !prev.twoFactorAuth }))}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                            privacySettings.twoFactorAuth ? 'bg-emerald-500' : 'bg-slate-600'
                          }`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            privacySettings.twoFactorAuth ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </motion.button>
                      </div>

                      {/* Login Alerts */}
                      <div className="flex items-center justify-between rounded-lg bg-slate-700/30 p-4">
                        <div>
                          <p className="font-semibold text-white">Login Alerts</p>
                          <p className="text-sm text-slate-400">Get notified about new sign-ins</p>
                        </div>
                        <button
                          onClick={() => setPrivacySettings(prev => ({ ...prev, loginAlerts: !prev.loginAlerts }))}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                            privacySettings.loginAlerts ? 'bg-[#C09060]' : 'bg-slate-600'
                          }`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            privacySettings.loginAlerts ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>

                      {/* Session Timeout */}
                      <div className="rounded-lg bg-slate-700/30 p-4">
                        <label className="block text-sm font-semibold text-white mb-2">Auto-Logout Timeout (minutes)</label>
                        <select
                          value={privacySettings.sessionTimeout}
                          onChange={e => setPrivacySettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) }))}
                          className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-white focus:ring-2 focus:ring-[#C09060] outline-none"
                        >
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={60}>1 hour</option>
                          <option value={120}>2 hours</option>
                          <option value={480}>8 hours</option>
                        </select>
                      </div>

                      {/* Device Limit */}
                      <div className="rounded-lg bg-slate-700/30 p-4">
                        <label className="block text-sm font-semibold text-white mb-2">Max Active Devices</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={privacySettings.deviceLimit}
                          onChange={e => setPrivacySettings(prev => ({ ...prev, deviceLimit: parseInt(e.target.value) }))}
                          className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-white focus:ring-2 focus:ring-[#C09060] outline-none"
                        />
                      </div>
                    </div>
                  </motion.div>

                  {/* Active Sessions & Devices */}
                  <motion.div
                    className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
                    variants={itemVariants}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-[#C09060]" />
                      <h2 className="text-2xl font-bold text-white">Active Sessions</h2>
                    </div>
                    <div className="space-y-3">
                      {[
                        { device: 'Chrome on Windows', location: 'New York, USA', active: true },
                        { device: 'Safari on iPhone', location: 'New York, USA', active: false },
                      ].map((session, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-700/30 p-3">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-white">{session.device}</p>
                            <p className="text-xs text-slate-400">{session.location}</p>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="rounded-lg bg-red-900/30 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-900/50 border border-red-900/50"
                          >
                            <LogOut className="h-3 w-3" />
                          </motion.button>
                        </div>
                      ))}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full rounded-lg bg-red-900/20 px-4 py-3 font-semibold text-red-300 hover:bg-red-900/30 border border-red-900/30 mt-4"
                      >
                        Sign Out of All Devices
                      </motion.button>
                    </div>
                  </motion.div>

                  {/* Data Export */}
                  <motion.div
                    className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
                    variants={itemVariants}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <Download className="h-5 w-5 text-[#C09060]" />
                      <h2 className="text-2xl font-bold text-white">Data Export</h2>
                    </div>
                    <div className="space-y-4">
                      <p className="text-sm text-slate-300">Export your data in your preferred format</p>
                      <select
                        value={exportFormat}
                        onChange={e => setExportFormat(e.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-white focus:ring-2 focus:ring-[#C09060] outline-none"
                      >
                        <option value="json">JSON</option>
                        <option value="csv">CSV</option>
                        <option value="pdf">PDF</option>
                      </select>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#C09060] px-6 py-3 font-semibold text-white hover:bg-[#B8860B] transition-all"
                      >
                        <Download className="h-4 w-4" />
                        Export My Data
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* Audio Settings */}
              {activeSection === 'audio' && (
                <motion.div
                  key="audio"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Playback Settings */}
                  <motion.div
                    className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
                    variants={itemVariants}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <Volume2 className="h-5 w-5 text-[#C09060]" />
                      <h2 className="text-2xl font-bold text-white">Playback Settings</h2>
                    </div>
                    <div className="space-y-6">
                      {/* Master Volume */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-semibold text-white">Master Volume</label>
                          <span className="text-sm font-semibold text-[#C09060]">{audioSettings.volume}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={audioSettings.volume}
                          onChange={e => setAudioSettings(prev => ({ ...prev, volume: parseInt(e.target.value) }))}
                          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#C09060]"
                        />
                      </div>

                      {/* Playback Speed */}
                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">Playback Speed</label>
                        <select
                          value={audioSettings.playbackSpeed}
                          onChange={e => setAudioSettings(prev => ({ ...prev, playbackSpeed: parseFloat(e.target.value) }))}
                          className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-white focus:ring-2 focus:ring-[#C09060] outline-none"
                        >
                          <option value={0.5}>0.5x (Slow)</option>
                          <option value={0.75}>0.75x</option>
                          <option value={1}>1x (Normal)</option>
                          <option value={1.25}>1.25x</option>
                          <option value={1.5}>1.5x (Fast)</option>
                          <option value={2}>2x (Very Fast)</option>
                        </select>
                      </div>

                      {/* Auto-Play Toggle */}
                      <div className="flex items-center justify-between rounded-lg bg-slate-700/30 p-4">
                        <div>
                          <p className="font-semibold text-white">Auto-Play</p>
                          <p className="text-sm text-slate-400">Automatically play next song</p>
                        </div>
                        <button
                          onClick={() => setAudioSettings(prev => ({ ...prev, autoPlay: !prev.autoPlay }))}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                            audioSettings.autoPlay ? 'bg-[#C09060]' : 'bg-slate-600'
                          }`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            audioSettings.autoPlay ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>

                      {/* Loop Mode */}
                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">Loop Mode</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['off', 'single', 'all'].map(mode => (
                            <motion.button
                              key={mode}
                              onClick={() => setAudioSettings(prev => ({ ...prev, loopMode: mode as any }))}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={`rounded-lg px-3 py-2 font-semibold capitalize transition-all ${
                                audioSettings.loopMode === mode
                                  ? 'bg-[#C09060] text-white'
                                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {mode}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Equalizer */}
                  <motion.div
                    className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
                    variants={itemVariants}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <Sliders className="h-5 w-5 text-[#C09060]" />
                      <h2 className="text-2xl font-bold text-white">Equalizer</h2>
                    </div>
                    <div className="space-y-4">
                      {/* Visualizer Toggle */}
                      <div className="flex items-center justify-between rounded-lg bg-slate-700/30 p-4">
                        <div>
                          <p className="font-semibold text-white">Show Visualizer</p>
                          <p className="text-sm text-slate-400">Display audio waveform during playback</p>
                        </div>
                        <button
                          onClick={() => setAudioSettings(prev => ({ ...prev, visualizer: !prev.visualizer }))}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                            audioSettings.visualizer ? 'bg-[#C09060]' : 'bg-slate-600'
                          }`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            audioSettings.visualizer ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>

                      {/* Preset Selection */}
                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">EQ Preset</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['flat', 'bass', 'treble', 'vocal'].map(preset => (
                            <motion.button
                              key={preset}
                              onClick={() => setAudioSettings(prev => ({ ...prev, equalizerPreset: preset as any }))}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={`rounded-lg px-3 py-2 font-semibold capitalize transition-all ${
                                audioSettings.equalizerPreset === preset
                                  ? 'bg-[#C09060] text-white'
                                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {preset}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Metronome */}
                  <motion.div
                    className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
                    variants={itemVariants}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <Zap className="h-5 w-5 text-[#C09060]" />
                      <h2 className="text-2xl font-bold text-white">Metronome</h2>
                    </div>
                    <div className="space-y-4">
                      {/* Metronome Toggle */}
                      <div className="flex items-center justify-between rounded-lg bg-slate-700/30 p-4">
                        <div>
                          <p className="font-semibold text-white">Enable Metronome</p>
                          <p className="text-sm text-slate-400">Use during practice sessions</p>
                        </div>
                        <button
                          onClick={() => setAudioSettings(prev => ({ ...prev, metronome: !prev.metronome }))}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                            audioSettings.metronome ? 'bg-emerald-500' : 'bg-slate-600'
                          }`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            audioSettings.metronome ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>

                      {audioSettings.metronome && (
                        <>
                          {/* Metronome Tempo */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-semibold text-white">Tempo (BPM)</label>
                              <span className="text-sm font-semibold text-[#C09060]">{audioSettings.metronomeTempo}</span>
                            </div>
                            <input
                              type="range"
                              min="40"
                              max="240"
                              value={audioSettings.metronomeTempo}
                              onChange={e => setAudioSettings(prev => ({ ...prev, metronomeTempo: parseInt(e.target.value) }))}
                              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#C09060]"
                            />
                            <div className="flex justify-between text-xs text-slate-400 mt-1">
                              <span>40 BPM</span>
                              <span>240 BPM</span>
                            </div>
                          </div>

                          {/* Metronome Volume */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-semibold text-white">Metronome Volume</label>
                              <span className="text-sm font-semibold text-[#C09060]">{audioSettings.metronomVolume}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={audioSettings.metronomVolume}
                              onChange={e => setAudioSettings(prev => ({ ...prev, metronomVolume: parseInt(e.target.value) }))}
                              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#C09060]"
                            />
                          </div>

                          {/* Metronome Test Button */}
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-900/20 px-4 py-3 font-semibold text-emerald-300 hover:bg-emerald-900/30 border border-emerald-900/30"
                          >
                            <Play className="h-4 w-4" />
                            Test Metronome
                          </motion.button>
                        </>
                      )}
                    </div>
                  </motion.div>

                  {/* Audio Format & Quality */}
                  <motion.div
                    className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
                    variants={itemVariants}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <Waves className="h-5 w-5 text-[#C09060]" />
                      <h2 className="text-2xl font-bold text-white">Audio Quality</h2>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">Sample Rate</label>
                        <select
                          className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-white focus:ring-2 focus:ring-[#C09060] outline-none"
                          defaultValue="44100"
                        >
                          <option value="22050">22.05 kHz (Low)</option>
                          <option value="44100">44.1 kHz (CD Quality)</option>
                          <option value="48000">48 kHz (Professional)</option>
                          <option value="96000">96 kHz (High Fidelity)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">Bit Depth</label>
                        <select
                          className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-white focus:ring-2 focus:ring-[#C09060] outline-none"
                          defaultValue="16"
                        >
                          <option value="8">8-bit</option>
                          <option value="16">16-bit (Standard)</option>
                          <option value="24">24-bit (High Fidelity)</option>
                          <option value="32">32-bit (Mastering)</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>

                  {/* Save Settings Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSaveSuccess(true)
                      setTimeout(() => setSaveSuccess(false), 2000)
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#C09060] px-6 py-3 font-semibold text-white hover:bg-[#B8860B] transition-all"
                  >
                    <Save className="h-4 w-4" />
                    Save Audio Settings
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </AppShell>
  )
}
