import {
  AGREEMENT_CHIP_CLASS,
  agreementFor,
  candidateStanceLabel,
  hasPosition,
  NO_QUIZ_LABEL,
  SKIPPED_LABEL,
  userStanceLabel,
} from "~/lib/stance";
import { cn } from "~/lib/utils";
import { NoSourceNotice, SourceCite } from "./SourceCite";

export interface TopicRow {
  topicSlug: string;
  topicName: string;
  topicCategory: string;
  stance: number | null;
  description: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  sourceDocument: string | null;
  sourcePage: number | null;
  sourceQuote: string | null;
  sourceDate: string | null;
}

/**
 * Posições por tema. Com quiz respondido, vira "compatibilidade por tema" e
 * ganha a coluna da resposta da pessoa e o chip de proximidade.
 *
 * Célula vazia é informação: quando não há documento, a linha diz "sem
 * posição registrada" e o tema fica explicitamente fora da conta. Nunca
 * inferimos a partir do partido, de aliados ou de votações vizinhas.
 */
export function PositionsByTopic({
  rows,
  answers,
  hasQuiz,
}: {
  rows: TopicRow[];
  answers: Record<string, number>;
  hasQuiz: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-[13.5px] text-slate-500">
        Nenhum tema cadastrado ainda para esta eleição.
      </p>
    );
  }

  return (
    <div className="grid gap-2.5">
      {rows.map((row) => {
        const userStance = answers[row.topicSlug];
        const agreement = agreementFor(row.stance, userStance, { hasQuiz });
        const documented = hasPosition(row.stance);

        return (
          <article
            key={row.topicSlug}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:px-[22px] lg:grid-cols-[150px_1fr_1fr_130px] lg:items-center lg:gap-[18px]"
          >
            <h3 className="text-[12px] font-bold tracking-[0.06em] text-indigo-600 uppercase">
              {row.topicName}
            </h3>

            <div className="min-w-0">
              <p className="mb-0.5 text-[12px] text-slate-500">
                Posição do candidato
              </p>
              <p
                className={cn(
                  "text-[13.5px] font-semibold",
                  documented ? "text-slate-800" : "text-slate-500",
                )}
              >
                {candidateStanceLabel(row.stance)}
              </p>
              {row.description && documented && (
                <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
                  {row.description}
                </p>
              )}
              <div className="mt-1.5">
                {documented && row.sourceType ? (
                  <SourceCite
                    source={{
                      sourceType: row.sourceType,
                      sourceUrl: row.sourceUrl,
                      sourceDocument: row.sourceDocument,
                      sourcePage: row.sourcePage,
                      sourceQuote: row.sourceQuote,
                      sourceDate: row.sourceDate,
                    }}
                  />
                ) : (
                  <NoSourceNotice />
                )}
              </div>
            </div>

            <div className="min-w-0">
              <p className="mb-0.5 text-[12px] text-slate-500">Sua resposta</p>
              <p
                className={cn(
                  "text-[13.5px] font-semibold",
                  !hasQuiz || !hasPosition(userStance)
                    ? "text-slate-500"
                    : "text-slate-800",
                )}
              >
                {!hasQuiz
                  ? NO_QUIZ_LABEL
                  : hasPosition(userStance)
                    ? userStanceLabel(userStance)
                    : SKIPPED_LABEL}
              </p>
            </div>

            <span
              className={cn(
                "w-fit rounded-full border px-3 py-1.5 text-[12px] font-bold lg:justify-self-end",
                AGREEMENT_CHIP_CLASS[agreement.kind],
              )}
            >
              {/* Glifo decorativo, escondido da tecnologia assistiva: o
                  rótulo ao lado já diz a mesma coisa em palavras. Sem isto o
                  leitor de tela anuncia "✕" como "sinal de multiplicação"
                  antes de "Discorda" — ruído que atrapalha justamente quem
                  depende só do áudio para comparar posições. */}
              <span aria-hidden="true">
                {agreement.kind === "close" && "✓ "}
                {agreement.kind === "distant" && "✕ "}
                {agreement.kind === "not-comparable" && "— "}
              </span>
              {agreement.label}
            </span>
          </article>
        );
      })}
    </div>
  );
}
