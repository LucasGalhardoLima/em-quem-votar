import { motion } from "framer-motion";
import type { Archetype } from "~/data/archetypes";

interface ArchetypeRevealProps {
  archetype: Archetype;
  delay?: number;
}

export function ArchetypeReveal({ archetype, delay = 0.2 }: ArchetypeRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.22, 1, 0.36, 1]
      }}
      className="text-center"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 15,
          delay: delay + 0.2
        }}
        className="text-6xl md:text-7xl mb-4"
      >
        {archetype.emoji}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.4, duration: 0.4 }}
      >
        <span className="inline-block px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold tracking-wide uppercase text-white/90 mb-3">
          Seu Perfil Político
        </span>

        <h2 className="text-3xl md:text-4xl font-bold font-heading text-white mb-3">
          {archetype.name}
        </h2>

        <p className="text-white/80 text-base md:text-lg max-w-md mx-auto leading-relaxed">
          {archetype.description}
        </p>
      </motion.div>
    </motion.div>
  );
}
