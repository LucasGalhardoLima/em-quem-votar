import { cn } from "~/lib/utils";

const SIZES = {
  sm: "size-12 rounded-xl text-xs",
  md: "size-14 rounded-xl text-[13px]",
  lg: "size-[88px] rounded-2xl text-lg",
} as const;

/** Placeholder listrado do protótipo — neutro, sem cor partidária. */
const PLACEHOLDER_BG =
  "repeating-linear-gradient(45deg,#eef1f6 0 4px,#e4e9f0 4px 8px)";

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CandidateAvatar({
  name,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const base = cn(
    "flex flex-none items-center justify-center overflow-hidden font-semibold text-slate-500",
    SIZES[size],
    className,
  );

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`Foto oficial de urna de ${name}`}
        loading="lazy"
        decoding="async"
        className={cn(base, "object-cover")}
      />
    );
  }

  return (
    <div className={base} style={{ background: PLACEHOLDER_BG }} aria-hidden="true">
      {initialsOf(name)}
    </div>
  );
}
