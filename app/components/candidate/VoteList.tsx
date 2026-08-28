import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { VoteDetail } from "./VoteDetail";

interface Vote {
  id: string;
  voteType: string;
  bill: {
    id: string;
    title: string;
    simplifiedTitle: string | null;
    simplifiedDescription: string | null;
    voteDate: string;
    voteSimDetails: string | null;
    voteNaoDetails: string | null;
  };
}

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export function VoteList({ votes }: { votes: Vote[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (votes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-[15px] font-bold text-slate-600">
          Nenhuma votação registrada
        </p>
        <p className="mx-auto mt-2 max-w-lg text-[13.5px] text-slate-500">
          As votações nominais aparecem aqui conforme forem sincronizadas das
          bases da Câmara e do Senado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {votes.map((vote) => {
        const isExpanded = expandedId === vote.id;
        const displayTitle = vote.bill.simplifiedTitle || vote.bill.title;

        return (
          <div
            key={vote.id}
            className="rounded-2xl border border-slate-200 bg-white"
          >
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() => setExpandedId(isExpanded ? null : vote.id)}
              className="flex w-full items-start gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <h4 className="line-clamp-2 text-sm font-semibold text-slate-800">
                  {displayTitle}
                </h4>
                <div className="mt-1.5 flex items-center gap-2">
                  {/* Chip neutro de propósito: colorir o voto de alguém é
                      emitir juízo sobre a pessoa, não relatar um fato. */}
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[12px] font-bold text-slate-600">
                    {vote.voteType}
                  </span>
                  <time
                    dateTime={vote.bill.voteDate}
                    className="text-[12px] text-slate-500"
                  >
                    {DATE_FMT.format(new Date(vote.bill.voteDate))}
                  </time>
                </div>
              </div>
              <span className="mt-1 shrink-0 text-slate-500">
                {/* A seta é decorativa: quem não a enxerga precisa da AÇÃO,
                    não do desenho. O texto invisível abaixo se soma ao título
                    para formar o nome acessível do botão ("… Expandir os
                    detalhes desta votação") e troca junto com o estado, então
                    o leitor de tela anuncia o que o próximo clique faz — e não
                    apenas "botão". Padrão já usado em `StatusBadge`: `sr-only`
                    somado ao conteúdo, em vez de `aria-label`, que apagaria o
                    título visível do nome. */}
                {isExpanded ? (
                  <ChevronUp className="size-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="size-4" aria-hidden="true" />
                )}
                <span className="sr-only">
                  {isExpanded
                    ? ". Recolher os detalhes desta votação"
                    : ". Expandir os detalhes desta votação"}
                </span>
              </span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4">
                <VoteDetail
                  billId={vote.bill.id}
                  description={vote.bill.simplifiedDescription}
                  voteSimDetails={vote.bill.voteSimDetails}
                  voteNaoDetails={vote.bill.voteNaoDetails}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
