import type { Archetype } from "~/data/archetypes";

interface ArchetypeCardProps {
  archetype: Archetype;
}

export function ArchetypeCard({ archetype }: ArchetypeCardProps) {
  return (
    <div
      className="rounded-2xl p-6 md:p-8 text-white text-center relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${archetype.gradient[0]} 0%, ${archetype.gradient[1]} 100%)`,
      }}
    >
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative z-10 space-y-3">
        <span className="text-5xl">{archetype.emoji}</span>
        <h2 className="text-2xl md:text-3xl font-bold">{archetype.name}</h2>
        <p className="text-white/80 text-sm md:text-base max-w-md mx-auto leading-relaxed">
          {archetype.description}
        </p>
      </div>
    </div>
  );
}
