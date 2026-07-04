/**
 * Settings Storage Hook
 * Handles localStorage persistence for Privacy & Security and Audio Settings
 * Auto-saves changes immediately without manual save required
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export interface PrivacySettings {
  dataCollection: boolean
  analyticsTracking: boolean
  twoFactorAuth: boolean
  loginAlerts: boolean
  sessionTimeout: number
  deviceLimit: number
  passwordChanged?: string
  loginHistory?: Array<{ date: string; device: string; location: string; success: boolean }>
  trustedDevices?: Array<{ id: string; name: string; addedDate: string }>
  loginAttempts?: number
  failedLoginAttempts?: number
  lastLoginDate?: string
}

export interface AudioSettings {
  volume: number
  playbackSpeed: number
  autoPlay: boolean
  loopMode: 'off' | 'single' | 'all'
  visualizer: boolean
  equalizerPreset: 'flat' | 'bass' | 'treble' | 'vocal' | 'custom'
  customEQ?: { treble: number; mid: number; bass: number }
  metronome: boolean
  metronomeTempo: number
  metronomVolume: number
  crossfade: boolean
  crossfadeTime: number
  normalization: boolean
  normalizationLevel: number
  sampleRate: number
  bitDepth: number
  spatialAudio: boolean
  noiseReduction: boolean
  noiseReductionLevel: number
  compressionEnabled: boolean
  compressionLevel: number
}

export interface NotificationSettings {
  emailNotifications: boolean
  pushNotifications: boolean
  smsNotifications: boolean
  notifyOnNewFeatures: boolean
  notifyOnSecurityAlerts: boolean
  notifyOnLoginAttempts: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
}

export interface SettingsData {
  privacy: PrivacySettings
  audio: AudioSettings
  notifications: NotificationSettings
  lastModified: string
  version: number
}

const PRIVACY_STORAGE_KEY = 'vpc_music_privacy_v106'
const AUDIO_STORAGE_KEY = 'vpc_music_audio_v106'
const NOTIFICATIONS_STORAGE_KEY = 'vpc_music_notifications_v106'
const SETTINGS_VERSION = 106

/**
 * Default Privacy Settings
 */
function getDefaultPrivacySettings(): PrivacySettings {
  return {
    dataCollection: true,
    analyticsTracking: false,
    twoFactorAuth: false,
    loginAlerts: true,
    sessionTimeout: 30,
    deviceLimit: 5,
    passwordChanged: new Date().toISOString(),
    loginHistory: [],
    trustedDevices: [],
    loginAttempts: 0,
    failedLoginAttempts: 0,
    lastLoginDate: new Date().toISOString(),
  }
}

/**
 * Default Audio Settings
 */
function getDefaultAudioSettings(): AudioSettings {
  return {
    volume: 75,
    playbackSpeed: 1.0,
    autoPlay: false,
    loopMode: 'off',
    visualizer: true,
    equalizerPreset: 'flat',
    customEQ: { treble: 0, mid: 0, bass: 0 },
    metronome: false,
    metronomeTempo: 120,
    metronomVolume: 50,
    crossfade: false,
    crossfadeTime: 5,
    normalization: true,
    normalizationLevel: -14,
    sampleRate: 44100,
    bitDepth: 16,
    spatialAudio: false,
    noiseReduction: false,
    noiseReductionLevel: 50,
    compressionEnabled: false,
    compressionLevel: 50,
  }
}

/**
 * Default Notification Settings
 */
function getDefaultNotificationSettings(): NotificationSettings {
  return {
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    notifyOnNewFeatures: true,
    notifyOnSecurityAlerts: true,
    notifyOnLoginAttempts: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  }
}

/**
 * Load Privacy Settings from localStorage
 */
export function loadPrivacySettings(): PrivacySettings {
  if (typeof window === 'undefined') return getDefaultPrivacySettings()

  try {
    const stored = localStorage.getItem(PRIVACY_STORAGE_KEY)
    return stored ? JSON.parse(stored) : getDefaultPrivacySettings()
  } catch (error) {
    console.error('[v0] Failed to load privacy settings:', error)
    return getDefaultPrivacySettings()
  }
}

/**
 * Load Audio Settings from localStorage
 */
export function loadAudioSettings(): AudioSettings {
  if (typeof window === 'undefined') return getDefaultAudioSettings()

  try {
    const stored = localStorage.getItem(AUDIO_STORAGE_KEY)
    return stored ? JSON.parse(stored) : getDefaultAudioSettings()
  } catch (error) {
    console.error('[v0] Failed to load audio settings:', error)
    return getDefaultAudioSettings()
  }
}

/**
 * Load Notification Settings from localStorage
 */
export function loadNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') return getDefaultNotificationSettings()

  try {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : getDefaultNotificationSettings()
  } catch (error) {
    console.error('[v0] Failed to load notification settings:', error)
    return getDefaultNotificationSettings()
  }
}

/**
 * Save Privacy Settings to localStorage
 */
function savePrivacySettings(settings: PrivacySettings): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('[v0] Failed to save privacy settings:', error)
  }
}

/**
 * Save Audio Settings to localStorage
 */
function saveAudioSettings(settings: AudioSettings): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('[v0] Failed to save audio settings:', error)
  }
}

/**
 * Save Notification Settings to localStorage
 */
function saveNotificationSettings(settings: NotificationSettings): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('[v0] Failed to save notification settings:', error)
  }
}

/**
 * Custom Hook for Settings Management
 * Provides auto-save functionality for all settings
 */
export function useSettingsStorage() {
  const [privacy, setPrivacy] = useState<PrivacySettings>(getDefaultPrivacySettings())
  const [audio, setAudio] = useState<AudioSettings>(getDefaultAudioSettings())
  const [notifications, setNotifications] = useState<NotificationSettings>(
    getDefaultNotificationSettings()
  )
  const [isLoaded, setIsLoaded] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>()

  // Load settings from storage on mount
  useEffect(() => {
    try {
      setPrivacy(loadPrivacySettings())
      setAudio(loadAudioSettings())
      setNotifications(loadNotificationSettings())
      setIsLoaded(true)
    } catch (error) {
      console.error('[v0] Failed to initialize settings:', error)
      setIsLoaded(true)
    }
  }, [])

  // Auto-save privacy settings whenever they change
  useEffect(() => {
    if (!isLoaded) return

    setSaveStatus('saving')
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)

    autoSaveTimeoutRef.current = setTimeout(() => {
      savePrivacySettings(privacy)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 300) // Debounce: 300ms

    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    }
  }, [privacy, isLoaded])

  // Auto-save audio settings whenever they change
  useEffect(() => {
    if (!isLoaded) return

    setSaveStatus('saving')
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)

    autoSaveTimeoutRef.current = setTimeout(() => {
      saveAudioSettings(audio)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 300) // Debounce: 300ms

    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    }
  }, [audio, isLoaded])

  // Auto-save notification settings whenever they change
  useEffect(() => {
    if (!isLoaded) return

    setSaveStatus('saving')
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)

    autoSaveTimeoutRef.current = setTimeout(() => {
      saveNotificationSettings(notifications)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 300) // Debounce: 300ms

    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    }
  }, [notifications, isLoaded])

  /**
   * Update privacy settings with immediate auto-save
   */
  const updatePrivacySettings = useCallback((updates: Partial<PrivacySettings>) => {
    setPrivacy(prev => ({ ...prev, ...updates }))
  }, [])

  /**
   * Update audio settings with immediate auto-save
   */
  const updateAudioSettings = useCallback((updates: Partial<AudioSettings>) => {
    setAudio(prev => ({ ...prev, ...updates }))
  }, [])

  /**
   * Update notification settings with immediate auto-save
   */
  const updateNotificationSettings = useCallback((updates: Partial<NotificationSettings>) => {
    setNotifications(prev => ({ ...prev, ...updates }))
  }, [])

  /**
   * Record login attempt for security tracking
   */
  const recordLoginAttempt = useCallback((success: boolean, device: string, location: string) => {
    setPrivacy(prev => {
      const newLoginHistory = [
        { date: new Date().toISOString(), device, location, success },
        ...(prev.loginHistory || []).slice(0, 49), // Keep last 50
      ]
      return {
        ...prev,
        loginHistory: newLoginHistory,
        loginAttempts: (prev.loginAttempts || 0) + 1,
        failedLoginAttempts: success ? prev.failedLoginAttempts : (prev.failedLoginAttempts || 0) + 1,
        lastLoginDate: success ? new Date().toISOString() : prev.lastLoginDate,
      }
    })
  }, [])

  /**
   * Add a trusted device
   */
  const addTrustedDevice = useCallback((deviceId: string, deviceName: string) => {
    setPrivacy(prev => ({
      ...prev,
      trustedDevices: [
        ...(prev.trustedDevices || []),
        { id: deviceId, name: deviceName, addedDate: new Date().toISOString() },
      ],
    }))
  }, [])

  /**
   * Remove a trusted device
   */
  const removeTrustedDevice = useCallback((deviceId: string) => {
    setPrivacy(prev => ({
      ...prev,
      trustedDevices: (prev.trustedDevices || []).filter(d => d.id !== deviceId),
    }))
  }, [])

  /**
   * Update custom equalizer settings
   */
  const updateCustomEQ = useCallback((treble: number, mid: number, bass: number) => {
    setAudio(prev => ({
      ...prev,
      customEQ: { treble, mid, bass },
      equalizerPreset: 'custom',
    }))
  }, [])

  /**
   * Reset all settings to defaults
   */
  const resetAllSettings = useCallback(() => {
    setPrivacy(getDefaultPrivacySettings())
    setAudio(getDefaultAudioSettings())
    setNotifications(getDefaultNotificationSettings())
  }, [])

  /**
   * Export settings as JSON
   */
  const exportSettings = useCallback(() => {
    const data = {
      privacy,
      audio,
      notifications,
      exportedAt: new Date().toISOString(),
      version: SETTINGS_VERSION,
    }
    return JSON.stringify(data, null, 2)
  }, [privacy, audio, notifications])

  /**
   * Import settings from JSON
   */
  const importSettings = useCallback((jsonData: string) => {
    try {
      const data = JSON.parse(jsonData)
      if (data.privacy) setPrivacy(prev => ({ ...prev, ...data.privacy }))
      if (data.audio) setAudio(prev => ({ ...prev, ...data.audio }))
      if (data.notifications)
        setNotifications(prev => ({ ...prev, ...data.notifications }))
      return { success: true, message: 'Settings imported successfully' }
    } catch (error) {
      return { success: false, message: 'Failed to import settings' }
    }
  }, [])

  /**
   * Clear all settings and start fresh
   */
  const clearAllSettings = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PRIVACY_STORAGE_KEY)
      localStorage.removeItem(AUDIO_STORAGE_KEY)
      localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY)
    }
    resetAllSettings()
  }, [resetAllSettings])

  return {
    // State
    privacy,
    audio,
    notifications,
    isLoaded,
    saveStatus,
    version: SETTINGS_VERSION,
    // Privacy Methods
    updatePrivacySettings,
    recordLoginAttempt,
    addTrustedDevice,
    removeTrustedDevice,
    // Audio Methods
    updateAudioSettings,
    updateCustomEQ,
    // Notification Methods
    updateNotificationSettings,
    // General Methods
    resetAllSettings,
    exportSettings,
    importSettings,
    clearAllSettings,
  }
}
