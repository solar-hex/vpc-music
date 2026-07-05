import type { Variants } from "framer-motion";

/** Respect the user's reduced-motion preference. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Staggered list entrance: container + item pair. */
export const listStagger: { container: Variants; item: Variants } = {
  container: {
    initial: {},
    animate: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
  },
  item: {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } },
  },
};

/** Simple fade + rise entrance for cards and sections. */
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};
