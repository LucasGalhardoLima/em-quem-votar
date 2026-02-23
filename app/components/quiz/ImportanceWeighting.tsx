import { cn } from "~/lib/utils";
import { THEMATIC_CATEGORIES, type ThematicCategory } from "~/data/archetypes";

export type ImportanceLevel = "high" | "medium" | "low";

interface ImportanceWeightingProps {
  weights: Record<string, ImportanceLevel>;
  onChange: (category: string, level: ImportanceLevel) => void;
}

const LEVEL_LABELS: Record<ImportanceLevel, string> = {
  high: "Muito importante",
  medium: "Importante",
  low: "Pouco importante",
};

const LEVEL_MULTIPLIERS: Record<ImportanceLevel, number> = {
  high: 1.5,
  medium: 1.0,
  low: 0.5,
};

export function getMultiplier(level: ImportanceLevel): number {
  return LEVEL_MULTIPLIERS[level];
}

export function ImportanceWeighting({
  weights,
  onChange,
}: ImportanceWeightingProps) {
  return (
    <div className="bg-card p-6 md:p-10 rounded-2xl shadow-lg border border-border w-full">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-primary to-brand-secondary" />

      <h2 className="text-xl md:text-2xl font-bold mb-2 text-foreground">
        Quais temas são mais importantes para você?
      </h2>
      <p className="text-sm text-muted-foreground mb-8">
        Isso ajuda a personalizar seu resultado. Candidatos que concordam com
        você em temas "muito importantes" terão mais peso.
      </p>

      <div className="space-y-4">
        {THEMATIC_CATEGORIES.map((category) => {
          const current = weights[category] ?? "medium";
          return (
            <div key={category} className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                {category}
              </label>
              <div className="flex gap-2">
                {(["high", "medium", "low"] as ImportanceLevel[]).map(
                  (level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => onChange(category, level)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all",
                        current === level
                          ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                          : "border-border bg-card text-muted-foreground hover:border-brand-primary/30"
                      )}
                    >
                      {LEVEL_LABELS[level]}
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
