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
        "focus-ring relative flex size-[26px] flex-none items-center justify-center rounded-full border transition-colors",
        // Alvo de toque de 44px sem engordar o círculo: o pseudo-elemento
        // estende só a área clicável, então o desenho do cartão não muda.
        //
        // A régua é 44px, não os 24px do SC 2.5.8 da WCAG 2.2. O círculo de
        // 26px já passava aquele piso, e a folga anterior (`-inset-[3px]`,
        // 32px efetivos) também — a troca é deliberada: o projeto adotou
        // 44px como alvo mínimo, o mesmo que os chips de filtro de
        // `/candidatos` e o botão de remover de `/comparar` seguem agora.
        // Este é o controle principal de cada card na grade mobile e vive
        // sobre um cartão que é inteiro clicável; errar por 3px aqui abre a
        // ficha de outra pessoa em vez de marcar a comparação.
        "before:absolute before:-inset-[9px] before:content-['']",
        selected
          ? "border-indigo-600 bg-indigo-600/[0.08] text-indigo-600"
          : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300",
        className,
      )}
    >
      {selected ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Plus className="size-3.5" aria-hidden="true" />
      )}
    </button>
  );
}
