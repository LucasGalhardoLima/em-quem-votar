import { ExternalLink, FileText } from "lucide-react";
import { cn } from "~/lib/utils";

export interface PositionSource {
  sourceType: string;
  sourceUrl?: string | null;
  sourceDocument?: string | null;
  sourcePage?: number | null;
  sourceDate?: string | null;
  sourceQuote?: string | null;
}

/** Vocabulário único de tipos de fonte — usado no site público e no admin. */
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  PLATFORM: "Proposta de governo",
  VOTE_RECORD: "Votação nominal",
  PUBLIC_STATEMENT: "Declaração pública",
  INTERVIEW: "Entrevista",
  MANUAL: "Registro editorial",
};

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/**
 * Citação de fonte de uma posição. Toda afirmação exibida na plataforma
 * passa por aqui — documento, página e link. Quando não há URL, o
 * componente ainda assim nomeia o documento, para que nenhuma posição
 * apareça sem procedência.
 */
export function SourceCite({
  source,
  className,
}: {
  source: PositionSource;
  className?: string;
}) {
  const typeLabel = SOURCE_TYPE_LABELS[source.sourceType] ?? source.sourceType;
  const doc = source.sourceDocument?.trim();
  const date = formatDate(source.sourceDate);

  const parts = [
    doc || typeLabel,
    source.sourcePage ? `p. ${source.sourcePage}` : null,
    date,
  ].filter(Boolean);

  const body = (
    <>
      <FileText className="size-3 flex-none" aria-hidden="true" />
      <span>{parts.join(" · ")}</span>
      {source.sourceUrl && (
        <>
          <ExternalLink className="size-3 flex-none" aria-hidden="true" />
          {/* O ícone avisa de nova aba só para quem enxerga. Sem este texto,
              quem usa leitor de tela perde o contexto e volta ao site com o
              botão "voltar", que não funciona numa aba recém-aberta. */}
          <span className="sr-only">(abre em nova aba)</span>
        </>
      )}
    </>
  );

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {source.sourceQuote && (
        <blockquote className="border-l-2 border-indigo-600/25 pl-2.5 text-xs leading-relaxed text-slate-600 italic">
          “{source.sourceQuote}”
        </blockquote>
      )}
      {source.sourceUrl ? (
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "relative inline-flex w-fit items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline",
            /*
              Alvo de toque de 44px sem tocar na tipografia. A caixa visível
              tem 1rem de altura — `text-xs` é 0.75rem de fonte pareada com
              `line-height: 1rem` —, e este é o link que materializa a promessa
              da plataforma — documento, página e link —, repetido cerca de
              vinte vezes na ficha de uma candidatura. Era o mais difícil de
              acertar com o dedo justamente por ser o mais importante de
              alcançar.

              Pseudo-elemento e não `padding`, pelo precedente comentado em
              `CompareToggle`: só a área clicável cresce, o fluxo não se mexe e
              as ~20 citações não empurram a página para baixo em meia tela.

              0.875 + 1 + 0.875 = 2.75rem, os mesmos 44px de `min-h-11`. A
              folga está em `rem` de propósito: a caixa visível também está
              (era 18px fixos quando a fonte era arbitrária e herdava o
              `line-height: 1.5` do preflight), então o alvo cresce junto com
              quem aumenta a fonte do navegador, em vez de encolher em
              proporção. A folga é simétrica porque o componente é
              compartilhado. Uma versão assimétrica, crescendo mais para baixo
              para se apoiar no `py-4` do cartão, quebrava no admin: lá o
              `SourceCite` mora num `flex-wrap` cujo `gap-3` (0.75rem) põe os
              botões de aprovar/reprovar logo abaixo quando a linha quebra, e a
              caixa invisível passaria a comer a borda de cima deles. Com
              0.875rem o excedente é de 0.125rem (2px) sobre esse gap — 1px a
              mais que na versão em pixels, porque a caixa visível encolheu 2px
              e a folga teve que compensar dos dois lados.

              O preço de crescer para cima é a faixa de texto que a caixa
              cobre — descrição e citação em bloco deixam de ser selecionáveis
              nos últimos pixels. É texto, não controle: nada deixa de
              funcionar, e o link só ganha um alvo generoso onde antes exigia
              precisão de uma linha de 1rem.
            */
            "before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-['']",
            "focus-ring",
          )}
        >
          {body}
        </a>
      ) : (
        <span className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-slate-500">
          {body}
        </span>
      )}
    </div>
  );
}

/** Marcador exibido quando não existe documento sobre o tema. */
export function NoSourceNotice({ className }: { className?: string }) {
  return (
    <span className={cn("text-xs text-slate-500", className)}>
      Nenhum documento oficial registrado sobre este tema.
    </span>
  );
}
