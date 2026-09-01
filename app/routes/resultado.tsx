import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { Route } from "./+types/resultado";
import { Container, MAIN_CONTENT_ID } from "~/components/layout";
import { CandidateAvatar } from "~/components/candidate/CandidateAvatar";
import { useQuizHydration, useQuizStore } from "~/stores/quizStore";
import {
  useComparisonHydration,
  useComparisonStore,
} from "~/stores/comparisonStore";
import {
  ABSOLUTE_MIN_COMPARABLE_TOPICS,
  answeredCount,
  calculateMatches,
} from "~/lib/match";
import { calculateArchetype } from "~/data/archetypes";
import { CandidateService } from "~/services/candidate.server";
import { db } from "~/utils/db.server";
import { cn } from "~/lib/utils";

/**
 * Única rota pública SEM bloco Open Graph, e é decisão, não esquecimento.
 *
 * Uma tag `og:` existe para uma pessoa que ainda não abriu a página: é o que o
 * WhatsApp mostra a quem RECEBE o link. E este endereço não carrega resultado
 * nenhum — as respostas vivem no localStorage de quem respondeu, o servidor
 * nunca as vê (ver /metodologia §5). Quem receber `/resultado` colado num
 * grupo cai no estado vazio "Você ainda não respondeu ao quiz".
 *
 * Um card anunciando "Seu resultado — compatibilidade entre as suas respostas
 * e as posições documentadas" seria, para todo destinatário, uma promessa que
 * o destino não cumpre. Preencher com o que a página não tem é exatamente o
 * que esta plataforma não faz com dado de candidato; não vamos fazer com o
 * próprio card.
 *
 * O compartilhamento previsto existe e é outro: `copySummary()` copia os
 * percentuais como TEXTO e aponta o link para `/quiz` — que tem card completo.
 *
 * O <title> e a description continuam aqui porque servem a quem JÁ está na
 * página: aba do navegador, histórico e favoritos de quem respondeu.
 */
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
      <main id={MAIN_CONTENT_ID} className="flex-1">
        <Container className="py-20">
          {/*
            Este é o ÚNICO estado que o servidor renderiza, e é por isso que o
            `<h1>` mora aqui também.

            O `quizStore` usa `skipHydration: true`: as respostas só são lidas
            do localStorage depois da montagem, então todo HTML servido de
            /resultado é este esqueleto — os dois estados de baixo não existem
            no documento. Enquanto o título era só um retângulo cinza animado,
            esta era a única rota pública sem cabeçalho nenhum: quem varre a
            página por cabeçalhos não tinha por onde entrar e o documento não
            dizia do que tratava. Um `<h1>` que só aparece depois do JavaScript
            é um `<h1>` que metade das ferramentas nunca vê.

            "Seu resultado" e não "Sua compatibilidade" porque, neste ponto,
            ainda não se sabe se existe compatibilidade a mostrar — o título
            precisa valer também para quem chega sem nenhuma resposta guardada.
          */}
          <h1 className="font-heading text-3xl font-bold tracking-[-0.02em] text-slate-800 sm:text-4xl">
            Seu resultado
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Lendo as suas respostas neste aparelho…
          </p>
          {/*
            Sem JavaScript este esqueleto nunca sai do lugar, porque o cálculo
            acontece no navegador de propósito (metodologia §5). Dizer isso é
            melhor que girar um carregamento para sempre.
          */}
          <noscript>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
              O cálculo roda no seu navegador para que as respostas não precisem
              ser enviadas a servidor nenhum — com o JavaScript desativado não
              há como fazê-lo. As posições documentadas continuam abertas, uma a
              uma, em{" "}
              <a href="/candidatos" className="font-semibold text-indigo-600">
                cada ficha de candidatura
              </a>
              .
            </p>
          </noscript>
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
      <main id={MAIN_CONTENT_ID} className="flex-1">
        <Container className="py-20 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-[-0.02em] text-slate-800">
            Você ainda não respondeu ao quiz
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base text-slate-500">
            O resultado é calculado no seu aparelho a partir das suas respostas.
            Como não há nenhuma resposta guardada aqui, não há o que comparar.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/quiz"
              className="focus-ring rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-900"
            >
              Fazer o quiz <span aria-hidden="true">→</span>
            </Link>
            <Link
              to="/candidatos"
              className="focus-ring rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 hover:border-slate-300"
            >
              Ver os candidatos
            </Link>
          </div>
        </Container>
      </main>
    );
  }

  const visible = showAll ? results : results.slice(0, 3);

  // "Comparar os 3 primeiros" só pode oferecer quem TEM percentual.
  //
  // `calculateMatches` põe os ranqueados na frente e desempata o resto por
  // ordem alfabética, então "os 3 primeiros" da lista nem sempre são três
  // resultados: com uma única candidatura ranqueada — o caso real hoje, 1 de
  // 211 — o segundo e o terceiro lugares são as duas primeiras letras do
  // alfabeto entre as que não têm dado nenhum. Mandá-las para o comparador
  // sob o rótulo "seus 3 primeiros" é fabricar um pódio, que é exatamente o
  // que o resto desta página se recusa a fazer.
  //
  // Com menos de dois percentuais não há comparação de compatibilidade a
  // propor, e o botão some — as fichas continuam a um toque pelo link abaixo.
  const rankedIds = results
    .filter((r) => r.matchPercentage !== null)
    .slice(0, 3)
    .map((r) => r.candidate.id);
  const canCompareRanked = rankedIds.length >= 2;

  // DUAS perguntas diferentes, e confundi-las já produziu uma afirmação falsa.
  //
  // `anyComparable` é sobre EXISTIR BASE: alguma candidatura tem posição
  // documentada em algum tema que a pessoa respondeu. É o que decide entre
  // mostrar a lista e cair no estado vazio — cujo texto afirma, com todas as
  // letras, que não há posição registrada com fonte a comparar. Testar
  // isso por `matchPercentage !== null` (o que este trecho fazia) mentia
  // sempre que todas ficassem abaixo de MIN_COMPARABLE_TOPICS: elas têm 1 ou 2
  // temas, e a página afirmava que não têm nenhum — além de deixar o rótulo
  // "Base insuficiente" inalcançável. `comparableCount` é o campo que
  // `app/lib/match.ts` expõe justamente para isso.
  //
  // `anyRanked` é sobre EXISTIR PERCENTUAL PUBLICÁVEL, e guarda o que só faz
  // sentido com um pódio real. Sem nenhum percentual todos os matches são
  // null, o desempate alfabético de calculateMatches vira a ordem da lista, e
  // destacar o primeiro ou oferecer "comparar os 3 primeiros" transformaria as
  // três primeiras letras do alfabeto em "seus três mais compatíveis". Ranking
  // acidental é ranking: a lista aparece (a base existe e é informação
  // verdadeira), o pódio não.
  const anyComparable = results.some((r) => r.comparableCount > 0);
  const anyRanked = results.some((r) => r.matchPercentage !== null);

  // QUANTAS chegaram a percentual, e não apenas SE alguma chegou.
  //
  // A cobertura documental real é rala: em 31/08/2026 há 211 candidaturas no
  // banco e 8 posições aprovadas, todas de UMA delas. Quem responde as 24
  // perguntas recebe um número e 210 cartões sem número — e a página, que só
  // dizia "empates aparecem em ordem alfabética", deixava a pessoa concluir
  // sozinha o motivo. A conclusão fácil é a errada: "sem número" parece
  // incompatibilidade, quando é ausência de registro do nosso lado.
  //
  // Por isso a frase só aparece quando há de fato uma cauda sem percentual, e
  // nomeia a proporção em vez de sugeri-la.
  const rankedCount = results.filter((r) => r.matchPercentage !== null).length;

  // TERCEIRA pergunta, e ela é sobre DE QUEM É A FALTA.
  //
  // As duas acima são relativas aos temas que a pessoa RESPONDEU — é o que
  // `comparableCount` mede. Sozinhas elas não distinguem "o documento não fala
  // disso" de "você não perguntou isso", e a página afirmava a primeira nos
  // dois casos: quem respondia 3 de 20 perguntas e não casava com ninguém lia
  // "nenhuma das 13 candidaturas tem posição registrada com fonte ainda" — uma
  // afirmação sobre 17 temas que a pessoa nem chegou a perguntar.
  //
  // `anyDocumented` é a pergunta ABSOLUTA: existe posição aprovada e
  // documentada em algum tema, respondido ou não. `positionCount` já vem do
  // servidor contando exatamente isso (aprovada E stance > 0), então a
  // distinção não custa consulta nova nem estado novo.
  const anyDocumented = candidates.some((c) => c.positionCount > 0);

  // `comparableCount` nunca passa de `answered` (um tema só é comparável se a
  // pessoa respondeu) e o piso de `match.ts` nunca desce abaixo de
  // ABSOLUTE_MIN_COMPARABLE_TOPICS. Logo, abaixo desse mínimo de respostas
  // NENHUMA candidatura alcança percentual — nem a que documentou os 20 temas.
  // O gargalo é o quiz, e a frase antiga ("nenhuma candidatura tem base
  // documental suficiente") punha na conta da candidatura uma falta que é da
  // resposta. Hoje isso é exatamente uma pergunta respondida; a comparação usa
  // a constante para não virar mentira se o mínimo mudar.
  //
  // Vale só para o caso ESTRUTURAL. Com duas respostas o piso continua 2 e o
  // percentual é alcançável — quem tiver posição documentada nos dois temas
  // recebe número —, então aí a falta é de fato documental e a frase pode
  // dizê-lo, desde que escopada aos temas respondidos.
  const quizTooShortForPercentage = answered < ABSOLUTE_MIN_COMPARABLE_TOPICS;
  const canAnswerMore = answered < totalQuestions;

  function copySummary() {
    const lines = results.slice(0, 5).map(
      (r, i) =>
        `${i + 1}. ${r.candidate.displayName} (${r.candidate.party}) — ${
          r.matchPercentage !== null
            ? `${r.matchPercentage}%`
            : // Mesma redação da tela. O texto copiado circula sozinho em
              // grupo de WhatsApp, sem a lista ao lado para desfazer o
              // engano: "sem dados" para os dois casos apagaria a diferença
              // entre "não tem posição registrada em nenhum tema que você
              // respondeu" e "tem, mas só uma ou duas".
              r.insufficientBase
              ? "Base insuficiente"
              : "Sem dados"
        }`,
    );
    const text = [
      "Minha compatibilidade — Em Quem Votar?",
      ...lines,
      "",
      `Baseado em ${answered} de ${totalQuestions} perguntas.`,
      "Faça o seu em https://emquemvotar.app/quiz",
    ].join("\n");

    // Em contexto não-seguro `navigator.clipboard` é undefined e o acesso
    // estoura um TypeError SÍNCRONO — que nenhum `.catch()` de promise pega.
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) {
      toast.error("Seu navegador não permite copiar automaticamente aqui");
      return;
    }
    clipboard
      .writeText(text)
      .then(() => toast.success("Resumo copiado — só os percentuais"))
      .catch(() => toast.error("Não foi possível copiar"));
  }

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <Container className="grid items-start gap-7 py-8 lg:grid-cols-[1fr_300px]">
        <div>
          {/* O par responsivo era 26px → 30px, e os dois caem no mesmo degrau
              (`text-3xl`) da escala nomeada: mantê-los assim apagaria o salto
              no `sm`, deixando um `sm:` que não faz nada. O maior sobe para
              `text-4xl`, que é o mesmo tamanho do h1 de `/metodologia` — a
              página que este resultado cita — em vez de rebaixar o mobile. */}
          <h1 className="font-heading text-3xl font-bold tracking-[-0.02em] text-slate-800 sm:text-4xl">
            Sua compatibilidade
          </h1>
          <p className="mt-1.5 text-sm text-pretty text-slate-500">
            Baseado em{" "}
            <strong className="font-semibold text-slate-700">
              {answered} de {totalQuestions}
            </strong>{" "}
            perguntas e nos pesos que você definiu.{" "}
            {!anyComparable ? (
              anyDocumented ? (
                "Nenhuma candidatura tem posição documentada nos temas que você respondeu."
              ) : (
                "Nenhuma candidatura tem posição documentada ainda."
              )
            ) : anyRanked ? (
              <>
                Empates aparecem em ordem alfabética.
                {rankedCount < results.length && (
                  <>
                    {" "}
                    <strong className="font-semibold text-slate-700">
                      {rankedCount} de {results.length}
                    </strong>{" "}
                    {/* O substantivo acompanha o TOTAL ("de 211
                        candidaturas") e o verbo acompanha a contagem — com
                        uma só, "1 de 211 candidaturas chegou". */}
                    candidaturas {rankedCount === 1 ? "chegou" : "chegaram"} a
                    temas comparáveis suficientes para um percentual. As
                    outras aparecem sem número porque ainda não têm posição
                    documentada nos temas que você respondeu — é registro que
                    falta, não discordância delas.
                  </>
                )}
              </>
            ) : quizTooShortForPercentage ? (
              <>
                Com esse número de respostas, nem a candidatura mais documentada
                chega a temas comparáveis suficientes para um percentual — o que
                falta aqui é resposta, não documento. A lista está em ordem
                alfabética, e não por compatibilidade.
                {canAnswerMore && (
                  <>
                    {" "}
                    <Link
                      to="/quiz"
                      className="focus-ring font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Voltar ao quiz <span aria-hidden="true">→</span>
                    </Link>
                  </>
                )}
              </>
            ) : (
              "Nenhuma candidatura tem posição documentada em temas suficientes entre os que você respondeu — a lista está em ordem alfabética, e não por compatibilidade."
            )}
          </p>

          {anyComparable ? (
            <div className="mt-5 grid gap-2.5">
              {visible.map((result) => {
                const { candidate, matchPercentage } = result;
                // Destaque só existe se houver percentual: sem ele o primeiro
                // lugar é fruto do desempate alfabético, e pintá-lo de indigo
                // afirmaria uma preferência que o dado não sustenta.
                const isTop =
                  matchPercentage !== null &&
                  results[0]?.candidate.id === candidate.id;
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
                        <h2 className="truncate text-base font-bold text-slate-800">
                          {candidate.displayName}
                        </h2>
                        <p className="truncate text-xs text-slate-500">
                          {candidate.party}
                          {candidate.number != null
                            ? ` · nº ${candidate.number}`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        {matchPercentage === null ? (
                          <span className="text-xs font-semibold text-slate-500">
                            {result.insufficientBase
                              ? "Base insuficiente"
                              : "Sem dados"}
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "font-heading text-3xl font-bold",
                              isTop ? "text-indigo-600" : "text-slate-600",
                            )}
                          >
                            {matchPercentage}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sem percentual não existe barra. A trilha cheia com
                        preenchimento zero é lida como "0% de afinidade" — uma
                        afirmação sobre a pessoa — quando o que falta é
                        documento NOSSO. A regra "dado ausente é renderizado
                        como ausente, nunca inferido" vale para o canal visual,
                        que aqui pesa mais que o rótulo ao lado. Faixa
                        tracejada em vez de nada: ocupa a mesma altura (os
                        cartões da lista não dançam) e não mede nada. */}
                    {matchPercentage === null ? (
                      <div className="mt-3 h-2 rounded-full border border-dashed border-slate-300" />
                    ) : (
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            isTop ? "bg-indigo-600" : "bg-slate-400",
                          )}
                          style={{ width: `${matchPercentage}%` }}
                        />
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-500">
                        {/* Mesma distinção da frase do topo, no nível do
                            cartão: "nenhum tema comparável" é relativo ao que
                            a pessoa respondeu, e dizer "nenhum tema com posição
                            documentada" de uma candidatura com catorze temas
                            registrados fora do quiz é falso sobre ELA. */}
                        {result.comparableCount === 0
                          ? candidate.positionCount > 0
                            ? "Nenhum tema que você respondeu tem posição documentada"
                            : "Nenhum tema com posição documentada ainda"
                          : result.insufficientBase
                            ? `Só ${result.comparableCount} tema${result.comparableCount === 1 ? "" : "s"} comparáve${result.comparableCount === 1 ? "l" : "is"} — pouco para calcular compatibilidade`
                            : `Concordância em ${result.agreeCount} de ${result.comparableCount} temas comparáveis`}
                      </span>
                      <Link
                        to={`/candidato/${candidate.id}`}
                        prefetch="intent"
                        className="focus-ring relative flex-none font-semibold text-indigo-600 hover:text-indigo-700 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-['']"
                      >
                        {/* "Ver por tema" promete uma leitura tema a tema que
                            uma candidatura sem NENHUMA posição aprovada não
                            tem — e hoje esse é o caso da esmagadora maioria.
                            A ficha continua valendo a visita (proposta de
                            governo protocolada, gastos, bens declarados,
                            situação no TSE), então o destino não muda; o
                            rótulo é que para de prometer o que não há. */}
                        {candidate.positionCount > 0
                          ? "Ver por tema"
                          : "Ver a ficha"}{" "}
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </article>
                );
              })}

              {results.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="focus-ring flex min-h-11 items-center justify-center rounded-xl p-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  {showAll ? (
                    "Mostrar só os 3 primeiros"
                  ) : (
                    <>
                      Ver os {results.length} <span aria-hidden="true">→</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <section className="mt-5 rounded-2xl border border-slate-200 bg-white px-6 py-9 text-center">
              <h2 className="text-base font-bold text-slate-800">
                {anyDocumented
                  ? "Nenhuma posição documentada nos temas que você respondeu"
                  : "Ainda não há posições documentadas para comparar"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-pretty text-slate-500">
                {answered === 1
                  ? "Sua resposta continua guardada"
                  : `Suas ${answered} respostas continuam guardadas`}{" "}
                no seu aparelho.{" "}
                {anyDocumented
                  ? // `anyDocumented` é um `some`: garante que EXISTEM posições
                    // documentadas em outros temas, não que toda candidatura
                    // tenha. A frase para exatamente onde o dado para.
                    `Acontece que nenhuma das ${candidates.length} candidaturas registrou posição com fonte justamente nos temas que você respondeu — há posições documentadas sobre outros temas, e elas estão nas fichas.`
                  : `Acontece que nenhuma das ${candidates.length} candidaturas tem posição registrada com fonte ainda.`}{" "}
                E sem as duas pontas não existe percentual de compatibilidade.
              </p>
              <p className="mx-auto mt-2.5 max-w-md text-xs leading-relaxed text-pretty text-slate-500">
                Preferimos não mostrar lista nenhuma a mostrar uma ordenada por
                critério que não seja a sua resposta.{" "}
                {anyDocumented && canAnswerMore ? (
                  <>
                    Responder mais perguntas alcança outros temas e pode
                    destravar o cálculo — o que você já respondeu continua onde
                    está.{" "}
                    <Link
                      to="/quiz"
                      className="focus-ring font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Voltar ao quiz <span aria-hidden="true">→</span>
                    </Link>
                  </>
                ) : (
                  "Assim que houver posições aprovadas, o cálculo aparece aqui sem você refazer o quiz."
                )}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link
                  to="/candidatos"
                  className="focus-ring rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-900"
                >
                  Ver as candidaturas <span aria-hidden="true">→</span>
                </Link>
                <Link
                  to="/metodologia"
                  className="focus-ring rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:border-slate-300"
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
              <h2 className="text-xs font-bold tracking-[0.06em] text-slate-500 uppercase">
                Seu perfil nas respostas
              </h2>
              <p className="mt-2 flex items-center gap-2 text-base font-bold text-slate-800">
                <span aria-hidden="true">{archetype.emoji}</span>
                {archetype.name}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                {archetype.description}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                É uma leitura das suas próprias respostas — não diz nada sobre
                os candidatos nem sugere em quem votar.
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <h2 className="text-xs font-bold tracking-[0.06em] text-slate-500 uppercase">
              Como ler este número
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              O percentual compara as suas respostas com posições{" "}
              <strong className="font-semibold">documentadas</strong>. Tema em
              que falta uma das duas pontas sai da conta inteira — não vale zero
              nem discordância —, por isso o total de temas comparáveis varia de
              candidato para candidato e por isso quem não tem base aparece{" "}
              <strong className="font-semibold">sem número</strong>, nunca com
              0%.
            </p>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-600">
              A conta é feita aqui, no seu navegador: a página baixa as posições
              públicas e cruza com o que está guardado no aparelho. As suas
              respostas não são enviadas ao servidor em momento nenhum.
            </p>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
              Fontes: propostas de governo protocoladas no TSE e votações
              nominais da Câmara e do Senado.{" "}
              <Link
                to="/metodologia"
                className="focus-ring font-semibold text-indigo-600"
              >
                Ver metodologia
              </Link>
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <h2 className="text-xs font-bold tracking-[0.06em] text-slate-500 uppercase">
              Próximos passos
            </h2>
            <div className="mt-2.5 grid gap-2">
              {anyRanked && (
                <>
                  {canCompareRanked && (
                    <Link
                      to={`/comparar?ids=${rankedIds.join(",")}`}
                      onClick={() => comparisonReady && setIds(rankedIds)}
                      className="focus-ring rounded-xl bg-slate-800 p-3 text-center text-sm font-semibold text-white transition-colors hover:bg-slate-900"
                    >
                      Comparar os {rankedIds.length} primeiros
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={copySummary}
                    className="focus-ring rounded-xl border border-slate-200 p-[11px] text-center text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300"
                  >
                    Copiar resumo
                  </button>
                </>
              )}
              {/* Havia um caminho só de volta ao quiz, "Refazer", e ele
                  chamava `reset()`: apagava tudo sem avisar. Rever o que se
                  respondeu e recomeçar do zero são intenções diferentes, e a
                  destrutiva é a que precisa dizer o nome. O quiz relê as
                  respostas do store, então "revisar" é literalmente voltar
                  para lá com tudo no lugar. */}
              <Link
                to="/quiz"
                className="focus-ring rounded-xl border border-slate-200 p-[11px] text-center text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300"
              >
                Revisar minhas respostas
              </Link>
              {/* Sem percentual, a leitura útil não está aqui — está na ficha:
                  proposta de governo protocolada, gastos, bens e situação no
                  TSE existem para quase toda candidatura, mesmo quando a
                  posição por tema ainda não. */}
              <Link
                to="/candidatos"
                className="focus-ring rounded-xl border border-slate-200 p-[11px] text-center text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300"
              >
                Ver todas as fichas
              </Link>
              <Link
                to="/quiz"
                onClick={() => reset()}
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800"
              >
                Começar do zero — apaga as respostas
              </Link>
              {anyRanked && (
                <p className="text-center text-xs text-slate-500">
                  O resumo traz só os percentuais — suas respostas não saem do
                  aparelho.
                </p>
              )}
            </div>
          </section>

          <p className="rounded-2xl border border-indigo-600/[0.12] bg-indigo-600/[0.04] px-[18px] py-3.5 text-xs leading-relaxed text-slate-600">
            Isto{" "}
            <strong className="font-semibold">
              não é recomendação de voto
            </strong>{" "}
            — é uma medida de proximidade entre o que você respondeu e o que
            está documentado. A decisão é sua.
          </p>
        </aside>
      </Container>
    </main>
  );
}
