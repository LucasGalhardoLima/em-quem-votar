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
        <ExternalLink className="size-3 flex-none" aria-hidden="true" />
      )}
    </>
  );

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {source.sourceQuote && (
        <blockquote className="border-l-2 border-indigo-600/25 pl-2.5 text-[12px] leading-relaxed text-slate-600 italic">
          “{source.sourceQuote}”
        </blockquote>
      )}
      {source.sourceUrl ? (
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 text-[11.5px] font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          {body}
        </a>
      ) : (
        <span className="inline-flex w-fit items-center gap-1.5 text-[11.5px] font-medium text-slate-500">
          {body}
        </span>
      )}
    </div>
  );
}

/** Marcador exibido quando não existe documento sobre o tema. */
export function NoSourceNotice({ className }: { className?: string }) {
  return (
    <span className={cn("text-[11.5px] text-slate-500", className)}>
      Nenhum documento oficial registrado sobre este tema.
    </span>
  );
}
