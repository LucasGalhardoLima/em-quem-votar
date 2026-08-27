import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { Route } from "./+types/resultado";
import { Container } from "~/components/layout";
import { CandidateAvatar } from "~/components/candidate/CandidateAvatar";
import { useQuizHydration, useQuizStore } from "~/stores/quizStore";
import {
  useComparisonHydration,
  useComparisonStore,
} from "~/stores/comparisonStore";
import { answeredCount, calculateMatches } from "~/lib/match";
import { calculateArchetype } from "~/data/archetypes";
import { CandidateService } from "~/services/candidate.server";
import { db } from "~/utils/db.server";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Seu resultado | Em Quem Votar?" },
    {
      name: "description",
      content:
        "Compatibilidade entre as suas respostas e as posições documentadas dos candidatos à Presidência em 2026.",
    },
    // O resultado é pessoal e calculado no aparelho: não há o que indexar.
    { name: "robots", content: "noindex,follow" },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  // Só dado público sai daqui. As respostas do quiz nunca chegam ao servidor.
  const [candidates, topics, totalQuestions] = await Promise.all([
    CandidateService.findAllForMatch(),
    db.politicalTopic.findMany({
      select: { slug: true, name: true, category: true },
      orderBy: { order: "asc" },
    }),
    db.quizQuestion.count({ where: { isActive: true } }),
  ]);

  return { candidates, topics, totalQuestions };
}

export default function Resultado({ loaderData }: Route.ComponentProps) {
  const { candidates, topics, totalQuestions } = loaderData;
  const quizReady = useQuizHydration();
  const comparisonReady = useComparisonHydration();

  const answers = useQuizStore((s) => s.answers);
  const weights = useQuizStore((s) => s.weights);
  const reset = useQuizStore((s) => s.reset);
  const setIds = useComparisonStore((s) => s.setIds);

  const [showAll, setShowAll] = useState(false);

  const topicCategories = useMemo(
    () => Object.fromEntries(topics.map((t) => [t.slug, t.category])),
    [topics],
  );
  const results = useMemo(
    () =>
      quizReady
        ? calculateMatches(candidates, answers, weights, topicCategories)
        : [],
    [quizReady, candidates, answers, weights, topicCategories],
  );

  const answered = quizReady ? answeredCount(answers) : 0;

  // Arquétipo descreve o PERFIL DE QUEM RESPONDEU, não os candidatos. É uma
  // leitura das próprias respostas, por isso pode ser calculado no cliente e
  // não interfere na neutralidade entre candidaturas.
  const archetype = useMemo(
    () =>
      quizReady && answered > 0
        ? calculateArchetype(answers, topicCategories)
        : null,
    [quizReady, answered, answers, topicCategories],
  );

  if (!quizReady) {
    return (
      <main className="flex-1">
        <Container className="py-20">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-6 grid gap-2.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        </Container>
      </main>
    );
  }

  if (answered === 0) {
    return (
      <main className="flex-1">
        <Container className="py-20 text-center">
          <h1 className="font-heading text-[28px] font-bold tracking-[-0.02em] text-slate-800">
            Você ainda não respondeu ao quiz
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[14.5px] text-slate-500">
            O resultado é calculado no seu aparelho a partir das suas respostas.
            Como não há nenhuma resposta guardada aqui, não há o que comparar.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/quiz"
              className="rounded-xl bg-slate-800 px-6 py-3 text-[13.5px] font-semibold text-white hover:bg-slate-900"
            >
              Fazer o quiz →
            </Link>
            <Link
              to="/candidatos"
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-[13.5px] font-semibold text-slate-600 hover:border-slate-300"
            >
              Ver os candidatos
            </Link>
          </div>
        </Container>
      </main>
    );
  }

  const visible = showAll ? results : results.slice(0, 3);
  const top3 = results.slice(0, 3).map((r) => r.candidate.id);

  // Sem NENHUMA posição documentada todos os matches são null, o desempate
  // alfabético de calculateMatches vira a ordem da lista e as três primeiras
  // letras do alfabeto passam a ser lidas como "seus três mais compatíveis".
  // Ranking acidental é ranking: nesse caso a página não exibe lista alguma.
  const anyComparable = results.some((r) => r.matchPercentage !== null);

  function copySummary() {
    const lines = results
      .slice(0, 5)
      .map(
        (r, i) =>
          `${i + 1}. ${r.candidate.displayName} (${r.candidate.party}) — ${
            r.matchPercentage === null ? "sem dados" : `${r.matchPercentage}%`
          }`,
      );
    const text = [
      "Minha compatibilidade — Em Quem Votar?",
      ...lines,
      "",
      `Baseado em ${answered} de ${totalQuestions} perguntas.`,
      "Faça o seu em https://emquemvotar.com.br/quiz",
    ].join("\n");

    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Resumo copiado — só os percentuais"))
      .catch(() => toast.error("Não foi possível copiar"));
  }

  return (
    <main className="flex-1">
      <Container className="grid items-start gap-7 py-8 lg:grid-cols-[1fr_300px]">
        <div>
          <h1 className="font-heading text-[26px] font-bold tracking-[-0.02em] text-slate-800 sm:text-[30px]">
            Sua compatibilidade
          </h1>
          <p className="mt-1.5 text-[13.5px] text-pretty text-slate-500">
            Baseado em <strong className="font-semibold text-slate-700">
              {answered} de {totalQuestions}
            </strong>{" "}
            perguntas e nos pesos que você definiu.{" "}
            {anyComparable
              ? "Empates aparecem em ordem alfabética."
              : "Nenhuma candidatura tem posição documentada ainda."}
          </p>

          {anyComparable ? (
            <div className="mt-5 grid gap-2.5">
              {visible.map((result) => {
                const { candidate, matchPercentage } = result;
                const isTop = results[0]?.candidate.id === candidate.id;
                return (
                  <article
                    key={candidate.id}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <CandidateAvatar
                        name={candidate.displayName}
                        photoUrl={candidate.photoUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-[15.5px] font-bold text-slate-800">
                          {candidate.displayName}
                        </h2>
                        <p className="truncate text-[12.5px] text-slate-500">
                          {candidate.party}
                          {candidate.number != null ? ` · nº ${candidate.number}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        {matchPercentage === null ? (
                          <span className="text-[12.5px] font-semibold text-slate-400">
                            Sem dados
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "font-heading text-[26px] font-bold",
                              isTop ? "text-indigo-600" : "text-slate-600",
                            )}
                          >
                            {matchPercentage}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          isTop ? "bg-indigo-600" : "bg-slate-400",
                        )}
                        style={{ width: `${matchPercentage ?? 0}%` }}
                      />
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="text-slate-500">
                        {result.comparableCount === 0
                          ? "Nenhum tema com posição documentada ainda"
                          : `Concordância em ${result.agreeCount} de ${result.comparableCount} temas comparáveis`}
                      </span>
                      <Link
                        to={`/candidato/${candidate.id}`}
                        prefetch="intent"
                        className="flex-none font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        Ver por tema →
                      </Link>
                    </div>
                  </article>
                );
              })}

              {results.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="p-1 text-center text-[13px] font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  {showAll
                    ? "Mostrar só os 3 primeiros"
                    : `Ver os ${results.length} →`}
                </button>
              )}
            </div>
          ) : (
            <section className="mt-5 rounded-2xl border border-slate-200 bg-white px-6 py-9 text-center">
              <h2 className="text-[15.5px] font-bold text-slate-800">
                Ainda não há posições documentadas para comparar
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-pretty text-slate-500">
                Suas {answered} respostas continuam guardadas no seu aparelho.
                Acontece que nenhuma das {candidates.length} candidaturas tem
                posição registrada com fonte ainda — e sem as duas pontas não
                existe percentual de compatibilidade.
              </p>
              <p className="mx-auto mt-2.5 max-w-md text-[12px] leading-relaxed text-pretty text-slate-400">
                Preferimos não mostrar lista nenhuma a mostrar uma ordenada por
                critério que não seja a sua resposta. Assim que houver posições
                aprovadas, o cálculo aparece aqui sem você refazer o quiz.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link
                  to="/candidatos"
                  className="rounded-xl bg-slate-800 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-900"
                >
                  Ver as candidaturas →
                </Link>
                <Link
                  to="/metodologia"
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-[13px] font-semibold text-slate-600 hover:border-slate-300"
                >
                  Como o cálculo funciona
                </Link>
              </div>
            </section>
          )}
        </div>

        <aside className="grid gap-3">
          {archetype && (
            <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <h2 className="text-[11px] font-bold tracking-[0.06em] text-slate-500">
                SEU PERFIL NAS RESPOSTAS
              </h2>
              <p className="mt-2 flex items-center gap-2 text-[15px] font-bold text-slate-800">
                <span aria-hidden="true">{archetype.emoji}</span>
                {archetype.name}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
                {archetype.description}
              </p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-slate-400">
                É uma leitura das suas próprias respostas — não diz nada sobre
                os candidatos nem sugere em quem votar.
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <h2 className="text-[11px] font-bold tracking-[0.06em] text-slate-500">
              COMO LER ESTE NÚMERO
            </h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">
              O percentual compara as suas respostas com posições{" "}
              <strong className="font-semibold">documentadas</strong>. Temas sem
              posição registrada ficam de fora da conta — por isso o total de
              temas comparáveis varia de candidato para candidato.
            </p>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-400">
              Fontes: propostas de governo protocoladas no TSE e votações
              nominais da Câmara e do Senado.{" "}
              <Link to="/metodologia" className="font-semibold text-indigo-600">
                Ver metodologia
              </Link>
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <h2 className="text-[11px] font-bold tracking-[0.06em] text-slate-500">
              PRÓXIMOS PASSOS
            </h2>
            <div className="mt-2.5 grid gap-2">
              {anyComparable && (
                <>
                  <Link
                    to={`/comparar?ids=${top3.join(",")}`}
                    onClick={() => comparisonReady && setIds(top3)}
                    className="rounded-xl bg-slate-800 p-3 text-center text-[13px] font-semibold text-white transition-colors hover:bg-slate-900"
                  >
                    Comparar os 3 primeiros
                  </Link>
                  <button
                    type="button"
                    onClick={copySummary}
                    className="rounded-xl border border-slate-200 p-[11px] text-center text-[13px] font-semibold text-slate-600 transition-colors hover:border-slate-300"
                  >
                    Copiar resumo
                  </button>
                </>
              )}
              <Link
                to="/quiz"
                onClick={() => reset()}
                className="rounded-xl border border-slate-200 p-[11px] text-center text-[13px] font-semibold text-slate-600 transition-colors hover:border-slate-300"
              >
                Refazer o quiz
              </Link>
              {anyComparable && (
                <p className="text-center text-[11.5px] text-slate-400">
                  O resumo traz só os percentuais — suas respostas não saem do
                  aparelho.
                </p>
              )}
            </div>
          </section>

          <p className="rounded-2xl border border-indigo-600/[0.12] bg-indigo-600/[0.04] px-[18px] py-3.5 text-[12px] leading-relaxed text-slate-600">
            Isto <strong className="font-semibold">não é recomendação de voto</strong>{" "}
            — é uma medida de proximidade entre o que você respondeu e o que está
            documentado. A decisão é sua.
          </p>
        </aside>
      </Container>
    </main>
  );
}
