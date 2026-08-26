import { Check, Plus } from "lucide-react";
import { cn } from "~/lib/utils";

export function CompareToggle({
  selected,
  onToggle,
  candidateName,
  className,
}: {
  selected: boolean;
  onToggle: () => void;
  candidateName: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={
        selected
          ? `Remover ${candidateName} da comparação`
          : `Adicionar ${candidateName} à comparação`
      }
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "flex size-[26px] flex-none items-center justify-center rounded-full border transition-colors",
        selected
          ? "border-indigo-600 bg-indigo-600/[0.08] text-indigo-600"
          : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300",
        className,
      )}
    >
      {selected ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
    </button>
  );
}
