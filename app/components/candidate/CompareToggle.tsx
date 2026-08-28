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
        "relative flex size-[26px] flex-none items-center justify-center rounded-full border transition-colors",
        // Alvo de toque de 32px sem engordar o círculo: o pseudo-elemento
        // estende só a área clicável. É o controle principal de cada card na
        // grade mobile, e 26px passava o piso da WCAG 2.2 por 2px.
        "before:absolute before:-inset-[3px] before:content-['']",
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
