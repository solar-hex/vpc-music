"use client"

import { motion, MotionProps } from "framer-motion"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface AnimatedButtonProps extends MotionProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
}

export function AnimatedButton({
  children,
  className,
  onClick,
  disabled,
  ...motionProps
}: AnimatedButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.05, boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)" } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      className={cn("transition-all", className)}
      {...motionProps}
    >
      {children}
    </motion.button>
  )
}

interface AnimatedCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  onHover?: boolean
}

export function AnimatedCard({
  children,
  className,
  onClick,
  onHover = true,
}: AnimatedCardProps) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={onHover ? { y: -4, boxShadow: "0 12px 24px rgba(0, 0, 0, 0.15)" } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      className={cn("transition-all", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  )
}

interface AnimatedIconProps {
  children: ReactNode
  className?: string
  pulse?: boolean
  rotate?: boolean
}

export function AnimatedIcon({
  children,
  className,
  pulse = false,
  rotate = false,
}: AnimatedIconProps) {
  return (
    <motion.div
      className={className}
      whileHover={rotate ? { rotate: 15 } : undefined}
      animate={pulse ? { scale: [1, 1.1, 1], opacity: [1, 0.8, 1] } : undefined}
      transition={
        pulse ? { duration: 2, repeat: Infinity } : { duration: 0.2 }
      }
    >
      {children}
    </motion.div>
  )
}
