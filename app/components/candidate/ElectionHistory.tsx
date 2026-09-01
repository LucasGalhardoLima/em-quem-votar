import { ExternalLink } from "lucide-react";

interface PriorElection {
  id: string;
  year: number;
  /** Cargo na redação do TSE: "Presidente", "Vice-prefeito", … */
  office: string;
  /**
   * Unidade eleitoral do TSE. Nem sempre é UF: para cargo municipal vem o
   * código do município ("71072"), e é assim que o TSE a publica.
   */
  ue: string | null;
  party: string | null;
  /** Literal do TSE: "Eleito", "Não eleito", "Eleito por QP". */
  resultLabel: string;
  sourceUrl: string | null;
}

/**
 * Candidaturas anteriores da mesma pessoa, conforme o DivulgaCandContas.
 *
 * Neutralidade: o resultado vai num chip cinza igual para todos. Pintar
 * "Eleito" de verde e "Não eleito" de vermelho transformaria um fato de
 * histórico em elogio ou censura — a mesma razão pela qual os votos
 * `Sim`/`Não` não têm cor nesta plataforma.
 *
 * A redação do TSE não é reescrita: "Eleito por QP" aparece assim, e não
 * traduzido para "eleito por quociente partidário", porque interpretar é
 * exatamente o que a plataforma não faz.
 */
export function ElectionHistory({ elections }: { elections: PriorElection[] }) {
  if (elections.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <ul className="divide-y divide-slate-100">
        {elections.map((election) => (
          <li
            key={election.id}
            className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="text-sm leading-snug font-semibold text-slate-700">
                <span className="tabular-nums">{election.year}</span> ·{" "}
                {election.office}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {election.party ?? "Partido não informado"}
                {election.ue ? (
                  <>
                    {" · "}
                    <span title="Unidade eleitoral no TSE">{election.ue}</span>
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex flex-none items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {election.resultLabel}
              </span>
              {election.sourceUrl && (
                <a
                  href={election.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  /* Mesmo alvo de 44px do `SourceCite`, pelo mesmo pseudo-
                     elemento: 0.875 + 1 (a caixa de `text-xs`) + 0.875 =
                     2.75rem, sem mexer no fluxo da linha nem na tipografia.
                     E o mesmo `focus-ring` do resto do app — este link estava
                     sem indicador nenhum. */
                  className="focus-ring relative inline-flex items-center gap-1 rounded-sm text-xs font-medium text-indigo-600 hover:underline before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-['']"
                >
                  Ficha
                  <ExternalLink className="size-3" aria-hidden="true" />
                  {/* Ver `SourceCite`: o ícone de nova aba só comunica a quem
                      enxerga. */}
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
