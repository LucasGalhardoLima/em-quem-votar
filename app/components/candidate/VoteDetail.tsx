import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

interface VoteDetailProps {
  billId: string;
  description: string | null;
  voteSimDetails: string | null;
  voteNaoDetails: string | null;
}

/**
 * Detalhe do que cada lado da votação significava.
 *
 * Sem ícone de aprovação/reprovação e sem verde/vermelho: "Sim" e "Não" são
 * descrições do efeito do voto, não julgamento sobre quem votou.
 */
export function VoteDetail({
  billId,
  description,
  voteSimDetails,
  voteNaoDetails,
}: VoteDetailProps) {
  return (
    <div className="space-y-3 border-t border-slate-100 pt-3">
      {description && (
        <p className="text-xs leading-relaxed text-slate-500">{description}</p>
      )}

      {(voteSimDetails || voteNaoDetails) && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {voteSimDetails && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-[12px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                Votar Sim significa
              </span>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {voteSimDetails}
              </p>
            </div>
          )}
          {voteNaoDetails && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-[12px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                Votar Não significa
              </span>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {voteNaoDetails}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        {/*
          Seta, não ícone de link externo: este Link navega dentro do próprio
          site. O ícone de "abre em nova aba" prometia uma saída que não
          acontece — e é a mesma marca usada aqui para fontes oficiais do TSE e
          da Câmara, então reusá-la aqui desvaloriza o sinal onde ele importa.
        */}
        <Link
          to={`/votacao/${billId}`}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-indigo-600 hover:underline"
        >
          Ver votação completa
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
