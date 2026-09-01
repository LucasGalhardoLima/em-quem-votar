import { useState } from "react";
import { Link } from "react-router";
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

  /*
    Este é o caminho que TODA candidatura com vínculo legislativo pega hoje:
    `VoteRecord`, a tabela que liga candidatura a voto nominal, tem 0 linhas no
    banco inteiro (31/08/2026) e nenhum script do repositório escreve nela.

    A cópia anterior dizia que as votações apareceriam "conforme forem
    sincronizadas das bases da Câmara e do Senado" — e isso descreve um estágio
    que já passou: as listas nominais estão sincronizadas (22.524 votos
    gravados), o que falta é amarrá-las à candidatura. Dizer o contrário
    manda o leitor esperar um sync que não é o que está pendente, e deixa no ar
    a leitura mais grave: a de que a pessoa não votou.
  */
  if (votes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-base font-bold text-slate-600">
          Nenhum voto nominal associado a esta candidatura
        </p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
          O vínculo entre esta candidatura e as listas nominais da Câmara e do
          Senado ainda não foi feito. A ausência aqui é de dado, e não prova de
          que a pessoa deixou de votar.
        </p>
        <Link
          to="/votacoes"
          prefetch="intent"
          className="focus-ring mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          Ver as votações publicadas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {votes.map((vote) => {
        const isExpanded = expandedId === vote.id;
        const displayTitle = vote.bill.simplifiedTitle || vote.bill.title;
        const panelId = `vote-panel-${vote.id}`;

        return (
          <div
            key={vote.id}
            className="rounded-2xl border border-slate-200 bg-white"
          >
            <button
              type="button"
              aria-expanded={isExpanded}
              // `aria-controls` só ajuda se o alvo existir sempre: com o painel
              // montado condicionalmente, o atributo apontava para um id
              // inexistente na metade do tempo — pior que não tê-lo. Daí o
              // painel ficar sempre no DOM, escondido pelo `hidden`, que é o
              // padrão de disclosure do próprio HTML e mantém o conteúdo fora
              // da ordem de tabulação enquanto está fechado.
              aria-controls={panelId}
              onClick={() => setExpandedId(isExpanded ? null : vote.id)}
              className="focus-ring flex w-full items-start gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <h4 className="line-clamp-2 text-sm font-semibold text-slate-800">
                  {displayTitle}
                </h4>
                <div className="mt-1.5 flex items-center gap-2">
                  {/* Chip neutro de propósito: colorir o voto de alguém é
                      emitir juízo sobre a pessoa, não relatar um fato. O que
                      distingue "SIM" de "NÃO" aqui é a palavra, não a cor —
                      então o chip continua legível em preto e branco e para
                      quem não distingue matiz (SC 1.4.1).

                      O `sr-only` dá contexto ao rótulo dentro do nome
                      acessível do botão: sem ele, o leitor de tela anuncia o
                      título seguido de um "SIM" solto, que tanto pode ser o
                      voto quanto o resultado da votação. */}
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
                    <span className="sr-only">Voto: </span>
                    {vote.voteType}
                  </span>
                  <time
                    dateTime={vote.bill.voteDate}
                    className="text-xs text-slate-500"
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

            <div id={panelId} hidden={!isExpanded} className="px-4 pb-4">
              <VoteDetail
                billId={vote.bill.id}
                description={vote.bill.simplifiedDescription}
                voteSimDetails={vote.bill.voteSimDetails}
                voteNaoDetails={vote.bill.voteNaoDetails}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
