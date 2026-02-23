import { cn } from "~/lib/utils";
import {
  ThumbsDown,
  MinusCircle,
  Minus,
  PlusCircle,
  ThumbsUp,
} from "lucide-react";

interface QuizOptionProps {
  label: string;
  description?: string | null;
  stanceValue: number;
  icon?: string | null;
  isSelected: boolean;
  onSelect: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  "thumbs-down": <ThumbsDown className="w-5 h-5" />,
  "minus-circle": <MinusCircle className="w-5 h-5" />,
  minus: <Minus className="w-5 h-5" />,
  "plus-circle": <PlusCircle className="w-5 h-5" />,
  "thumbs-up": <ThumbsUp className="w-5 h-5" />,
};

export function QuizOption({
  label,
  stanceValue,
  icon,
  isSelected,
  onSelect,
}: QuizOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-4 rounded-xl border-2 transition-all active:scale-[0.98]",
        isSelected
          ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
          : "border-border bg-card text-foreground hover:border-brand-primary/30 hover:bg-muted/50"
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors",
          isSelected
            ? "bg-brand-primary text-white"
            : "bg-muted text-muted-foreground"
        )}
      >
        {icon && ICON_MAP[icon] ? ICON_MAP[icon] : <span className="text-sm font-bold">{stanceValue}</span>}
      </div>
      <span className="font-medium text-sm text-left">{label}</span>
    </button>
  );
}
