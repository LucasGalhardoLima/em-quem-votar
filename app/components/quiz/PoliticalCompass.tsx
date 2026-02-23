import { cn } from "~/lib/utils";
import { ARCHETYPES, type Archetype } from "~/data/archetypes";

interface CompassPoint {
  label: string;
  economic: number;
  social: number;
  color?: string;
  isUser?: boolean;
}

interface PoliticalCompassProps {
  userPosition: { economic: number; social: number };
  candidatePositions?: CompassPoint[];
  className?: string;
}

function positionToPixel(value: number, size: number): number {
  // Map -1..+1 to 0..size
  return ((value + 1) / 2) * size;
}

export function PoliticalCompass({
  userPosition,
  candidatePositions = [],
  className,
}: PoliticalCompassProps) {
  const size = 280;
  const center = size / 2;

  const allPoints: CompassPoint[] = [
    {
      label: "Você",
      economic: userPosition.economic,
      social: userPosition.social,
      isUser: true,
    },
    ...candidatePositions,
  ];

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background grid */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0"
        >
          {/* Grid lines */}
          <line
            x1={center}
            y1={0}
            x2={center}
            y2={size}
            className="stroke-muted-foreground/20"
            strokeWidth={1}
          />
          <line
            x1={0}
            y1={center}
            x2={size}
            y2={center}
            className="stroke-muted-foreground/20"
            strokeWidth={1}
          />
          {/* Border */}
          <rect
            x={0}
            y={0}
            width={size}
            height={size}
            fill="none"
            className="stroke-border"
            strokeWidth={1}
            rx={8}
          />
        </svg>

        {/* Axis labels */}
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground font-medium">
          Progressista
        </span>
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground font-medium">
          Conservador
        </span>
        <span className="absolute top-1/2 -left-2 -translate-y-1/2 -translate-x-full text-[10px] text-muted-foreground font-medium">
          Estatista
        </span>
        <span className="absolute top-1/2 -right-2 -translate-y-1/2 translate-x-full text-[10px] text-muted-foreground font-medium">
          Liberal
        </span>

        {/* Archetype zones (subtle background) */}
        {ARCHETYPES.map((a) => {
          const x = positionToPixel(a.compass.economic, size);
          const y = positionToPixel(-a.compass.social, size); // Invert Y: positive social = top
          return (
            <div
              key={a.id}
              className="absolute text-[8px] text-muted-foreground/40 font-medium pointer-events-none"
              style={{
                left: x,
                top: y,
                transform: "translate(-50%, -50%)",
              }}
            >
              {a.emoji}
            </div>
          );
        })}

        {/* Points */}
        {allPoints.map((point, idx) => {
          const x = positionToPixel(point.economic, size);
          const y = positionToPixel(-point.social, size); // Invert Y
          return (
            <div
              key={idx}
              className="absolute group"
              style={{
                left: x,
                top: y,
                transform: "translate(-50%, -50%)",
                zIndex: point.isUser ? 20 : 10,
              }}
            >
              <div
                className={cn(
                  "w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm",
                  point.isUser
                    ? "bg-brand-primary w-5 h-5"
                    : point.color ?? "bg-muted-foreground/50"
                )}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-foreground text-background text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {point.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
