import type { TargetAndTransition, Transition, Variants } from "motion/react";

export const fluidEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const softSpring: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 28,
  mass: 0.9,
};

export const snappySpring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 24,
  mass: 0.78,
};

export const quickEase: Transition = {
  duration: 0.18,
  ease: fluidEase,
};

export const pageEntrance: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: softSpring },
};

export const staggerChildren: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.03,
      staggerChildren: 0.045,
    },
  },
};

export const sectionItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: softSpring },
};

export const cardEntrance: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: (index = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      ...softSpring,
      delay: Math.min(index, 8) * 0.035,
    },
  }),
};

export const cardHover: TargetAndTransition = {
  y: -3,
  scale: 1.004,
  transition: snappySpring,
};

export const cardTap: TargetAndTransition = {
  scale: 0.998,
  transition: quickEase,
};

export const roomCardHover: TargetAndTransition = {
  y: -5,
  scale: 1.01,
  transition: snappySpring,
};

export const buttonHover: TargetAndTransition = {
  y: -1.5,
  scale: 1.015,
  transition: snappySpring,
};

export const buttonTap: TargetAndTransition = {
  scale: 0.965,
  transition: quickEase,
};

export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: quickEase },
  exit: { opacity: 0, transition: quickEase },
};

export const modalPanel: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: softSpring },
  exit: { opacity: 0, y: 10, scale: 0.97, transition: quickEase },
};

export const popoverPanel: Variants = {
  hidden: { opacity: 0, y: -6, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: softSpring },
  exit: { opacity: 0, y: -5, scale: 0.98, transition: quickEase },
};

export const pulsePop: TargetAndTransition = {
  scale: [1, 1.24, 1],
  transition: {
    type: "spring",
    stiffness: 520,
    damping: 18,
  },
};
