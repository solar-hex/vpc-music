// Animation variants for Framer Motion
export const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
  transition: { duration: 0.3, ease: "easeOut" },
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3 },
}

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2, ease: "easeOut" },
}

export const slideInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.3, ease: "easeOut" },
}

export const slideInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
  transition: { duration: 0.3, ease: "easeOut" },
}

export const slideInDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3, ease: "easeOut" },
}

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
}

export const pulseAnimation = {
  scale: [1, 1.05, 1],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut",
  },
}

export const shimmer = {
  initial: { backgroundPosition: "200% center" },
  animate: { backgroundPosition: "0% center" },
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: "linear",
  },
}

// Easing functions
export const easeOut = "cubic-bezier(0.16, 1, 0.3, 1)"
export const easeInOut = "cubic-bezier(0.4, 0, 0.2, 1)"
export const easeOutElastic = "cubic-bezier(0.34, 1.56, 0.64, 1)"

// ============ ENHANCED ANIMATIONS ============

// Spring-based animations for natural motion
export const springIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
  transition: { type: "spring", stiffness: 300, damping: 30 },
}

export const springUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
  transition: { type: "spring", stiffness: 300, damping: 25 },
}

export const bounceIn = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
  transition: { type: "spring", stiffness: 400, damping: 20 },
}

// Page transition animations
export const pageEnter = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.4, ease: "easeOut" },
}

export const pageExit = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 0, y: 20 },
  exit: { opacity: 0, y: 20 },
  transition: { duration: 0.3, ease: "easeIn" },
}

// Micro-interaction animations
export const tapScale = (duration = 0.1) => ({
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { duration },
})

export const hoverLift = (distance = 4) => ({
  whileHover: { y: -distance, boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)" },
  transition: { type: "spring", stiffness: 300, damping: 20 },
})

export const pulseGrow = {
  animate: {
    scale: [1, 1.08, 1],
    transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
  },
}

// Card entrance with stagger
export const cardStagger = {
  container: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  },
  item: {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    transition: { type: "spring", stiffness: 300, damping: 25 },
  },
}

// Menu animations
export const menuSlideIn = {
  initial: { opacity: 0, scale: 0.92, y: -10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.92, y: -10 },
  transition: { type: "spring", stiffness: 300, damping: 30 },
}

export const menuItemStagger = {
  container: {
    animate: {
      transition: { staggerChildren: 0.04, delayChildren: 0.05 },
    },
  },
  item: {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.2 },
  },
}

// Loading and feedback animations
export const spinAnimation = {
  animate: { rotate: 360 },
  transition: { duration: 1, repeat: Infinity, ease: "linear" },
}

export const checkmark = {
  initial: { pathLength: 0 },
  animate: { pathLength: 1 },
  transition: { duration: 0.4, ease: "easeOut" },
}

export const successBounce = {
  initial: { scale: 0, rotate: -180 },
  animate: { scale: 1, rotate: 0 },
  exit: { scale: 0, rotate: 180 },
  transition: { type: "spring", stiffness: 400, damping: 20 },
}

// Scroll indicator animation
export const scrollPulse = {
  animate: {
    y: [0, 8, 0],
    opacity: [0.5, 1, 0.5],
    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
  },
}

// Subtle focus highlight
export const focusRing = {
  whileFocus: {
    boxShadow: "0 0 0 3px rgba(192, 144, 96, 0.3)",
    transition: { duration: 0.2 },
  },
}

// Background blur overlay animation
export const backdropBlur = {
  initial: { opacity: 0, backdropFilter: "blur(0px)" },
  animate: { opacity: 1, backdropFilter: "blur(4px)" },
  exit: { opacity: 0, backdropFilter: "blur(0px)" },
  transition: { duration: 0.3, ease: "easeOut" },
}

// Enhanced stagger for lists
export const listStagger = {
  container: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.1,
      },
    },
  },
  item: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { type: "spring", stiffness: 300, damping: 25 },
  },
}

// Accessibility: Respect prefers-reduced-motion
export const getReducedMotionVariants = (enabled: boolean) => ({
  initial: enabled ? {} : { opacity: 0 },
  animate: enabled ? {} : { opacity: 1 },
  exit: enabled ? {} : { opacity: 0 },
  transition: enabled ? {} : { duration: 0.3 },
})

export const reduceMotionSpring = (enabled: boolean) => ({
  type: enabled ? "tween" : "spring",
  stiffness: enabled ? 0 : 300,
  damping: enabled ? 0 : 30,
  duration: enabled ? 0 : undefined,
})
