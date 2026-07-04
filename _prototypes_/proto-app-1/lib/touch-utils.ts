/**
 * Touch Event Utilities
 * Provides helpers for touch interactions and gesture detection
 */

export interface TouchPoint {
  x: number
  y: number
  timestamp: number
}

export interface SwipeGesture {
  direction: 'left' | 'right' | 'up' | 'down'
  distance: number
  velocity: number
}

/**
 * Detect if device supports touch
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  )
}

/**
 * Detect device orientation
 */
export function getOrientation(): 'portrait' | 'landscape' {
  if (typeof window === 'undefined') return 'portrait'
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
}

/**
 * Check if device is in landscape mode
 */
export function isLandscape(): boolean {
  return getOrientation() === 'landscape'
}

/**
 * Get viewport dimensions
 */
export function getViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 }
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

/**
 * Calculate swipe direction and velocity
 */
export function calculateSwipe(
  startTouch: TouchPoint,
  endTouch: TouchPoint
): SwipeGesture | null {
  const deltaX = endTouch.x - startTouch.x
  const deltaY = endTouch.y - startTouch.y
  const deltaTime = endTouch.timestamp - startTouch.timestamp
  const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2)
  const velocity = distance / deltaTime

  // Minimum swipe distance and velocity
  if (distance < 50 || velocity < 0.1) {
    return null
  }

  // Determine direction based on dominant axis
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return {
      direction: deltaX > 0 ? 'right' : 'left',
      distance: Math.abs(deltaX),
      velocity,
    }
  } else {
    return {
      direction: deltaY > 0 ? 'down' : 'up',
      distance: Math.abs(deltaY),
      velocity,
    }
  }
}

/**
 * Create touch event handler for swipe gestures
 */
export function createSwipeHandler(
  onSwipe: (gesture: SwipeGesture) => void,
  options?: {
    minDistance?: number
    minVelocity?: number
    onStart?: () => void
    onEnd?: () => void
  }
) {
  let startTouch: TouchPoint | null = null

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      startTouch = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: Date.now(),
      }
      options?.onStart?.()
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startTouch && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0]
      const endTouch: TouchPoint = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: Date.now(),
      }

      const gesture = calculateSwipe(startTouch, endTouch)
      if (gesture) {
        onSwipe(gesture)
      }
      startTouch = null
      options?.onEnd?.()
    }
  }

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  }
}

/**
 * Check if click/tap is outside element
 */
export function isClickOutside(
  event: React.MouseEvent | React.TouchEvent,
  elementRef: React.RefObject<HTMLElement>
): boolean {
  if (!elementRef.current) return false

  const rect = elementRef.current.getBoundingClientRect()
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

  return (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  )
}

/**
 * Prevent default touch behaviors when scrolling
 */
export function allowVerticalScroll(e: React.TouchEvent) {
  e.stopPropagation()
}

/**
 * Get safe area insets for notched devices
 */
export function getSafeAreaInsets(): {
  top: number
  right: number
  bottom: number
  left: number
} {
  if (typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }

  const style = getComputedStyle(document.documentElement)
  return {
    top: parseInt(style.getPropertyValue('--safe-area-inset-top')) || 0,
    right: parseInt(style.getPropertyValue('--safe-area-inset-right')) || 0,
    bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom')) || 0,
    left: parseInt(style.getPropertyValue('--safe-area-inset-left')) || 0,
  }
}

/**
 * Detect if running on specific device type
 */
export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' | 'musicStand' {
  if (typeof window === 'undefined') return 'desktop'

  const width = window.innerWidth
  const height = window.innerHeight
  const aspectRatio = width / height

  if (width >= 1920) return 'musicStand'
  if (width >= 1024) {
    // Check if landscape tablet
    if (aspectRatio > 1.3) return 'tablet'
    return 'desktop'
  }
  if (width >= 768) return 'tablet'
  return 'mobile'
}

/**
 * Listener for safe area insets (notch detection)
 */
export function useSafeAreaInsets(): void {
  if (typeof window === 'undefined') return

  const setInsets = () => {
    const insets = getSafeAreaInsets()
    document.documentElement.style.setProperty('--safe-area-top', `${insets.top}px`)
    document.documentElement.style.setProperty('--safe-area-right', `${insets.right}px`)
    document.documentElement.style.setProperty('--safe-area-bottom', `${insets.bottom}px`)
    document.documentElement.style.setProperty('--safe-area-left', `${insets.left}px`)
  }

  setInsets()
  window.addEventListener('orientationchange', setInsets)
  window.addEventListener('resize', setInsets)

  return () => {
    window.removeEventListener('orientationchange', setInsets)
    window.removeEventListener('resize', setInsets)
  }
}
