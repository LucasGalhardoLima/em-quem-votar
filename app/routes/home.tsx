import { Link } from "react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Route } from "./+types/home";
import { pageMeta } from "~/root";
import {
  Container,
  CountdownBanner,
  MAIN_CONTENT_ID,
} from "~/components/layout";
import { countdownCopy } from "~/lib/election";
import { db } from "~/utils/db.server";
import { ArticleService } from "~/services/article.server";

export function meta({}: Route.MetaArgs) {
  return [
    ...pageMeta({
      title: "Em Quem Votar? | Vote com consciência",
      description:
        "Compare os candidatos à Presidência em 2026 por posições documentadas, votações nominais e gastos declarados ao TSE. Sem viés, sem propaganda — toda afirmação tem fonte.",
      type: "website",
    }),
    { name: "robots", content: "index,follow" },
  ];
}

/**
 * Para onde o número da home aponta.
 *
 * A home fala só da disputa presidencial ("Compare os candidatos à
 * Presidência"), mas `/candidatos` lista presidente E os 27 governos — 211
 * candidaturas hoje. O CTA prometia "Ver os 13 candidatos" e entregava 211.
 *
 * Corrigido pelo lado da contagem: o número é o do recorte que o destino
 * exibe, e o destino já vem recortado. Duas coisas seguem juntas de
 * propósito — mudar uma sem a outra reabre a divergência.
 *
 * A contagem NÃO filtra por situação. `/candidatos` mostra toda candidatura
 * registrada, com o badge de situação de cada uma; contar só as que estão na
 * disputa (`RUNNING_STATUSES`) faria o número encolher abaixo do que a página
 * lista no dia em que um registro for indeferido — a mesma promessa quebrada,
 * só que mais difícil de perceber.
 */
const HOME_RACE = "presidential";
const HOME_RACE_HREF = `/candidatos?cargo=${HOME_RACE}`;

export async function loader({}: Route.LoaderArgs) {
  const [candidateCount, recentBills, articles] = await Promise.all([
    db.candidate.count({ where: { electionType: HOME_RACE } }),
    db.bill.findMany({
      where: { status: "approved" },
      orderBy: { voteDate: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        simplifiedTitle: true,
        simplifiedDescription: true,
        voteDate: true,
        sourceType: true,
      },
    }),
    ArticleService.list(),
  ]);

  return {
    candidateCount,
    countdown: countdownCopy(),
    recentBills: recentBills.map((b) => ({
      ...b,
      voteDate: b.voteDate.toISOString(),
    })),
    articles: articles.slice(0, 3),
  };
}

const STEPS = [
  {
    title: "Responda ao quiz",
    body: "Uma pergunta por tema, com o peso que você define para cada eixo.",
  },
  {
    title: "Compare com posições reais",
    body: "Extraídas das propostas de governo protocoladas no TSE e de votações nominais.",
  },
  {
    title: "Verifique cada fonte",
    body: "Documento, página e link em toda afirmação exibida.",
  },
];

const TRUST = [
  { strong: "Sem cadastro", rest: "— respostas ficam no aparelho" },
  { strong: "Peso igual", rest: "para todas as candidaturas" },
  {
    strong: "TSE · Câmara · Senado",
    rest: "— só fontes oficiais, com data de atualização",
  },
];

export default function Home({ loaderData }: Route.ComponentProps) {
  const { candidateCount, countdown, recentBills, articles } = loaderData;

  const candidatesLabel =
    candidateCount > 0
      ? `${candidateCount} candidatura${candidateCount === 1 ? "" : "s"} à Presidência`
      : "candidaturas à Presidência";

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <CountdownBanner {...countdown} />

      <Container className="flex flex-col items-center gap-7 px-6 pt-14 pb-12 text-center sm:pt-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-600/10 bg-indigo-600/[0.05] px-4 py-2 text-sm font-medium text-indigo-600">
          <span className="size-2 rounded-full bg-indigo-600" aria-hidden="true" />
          Eleições 2026 · {candidatesLabel}
        </span>

        <div className="grid gap-5">
          <h1 className="font-heading text-[clamp(2.75rem,8vw,5.5rem)] leading-[1.08] font-bold tracking-[-0.02em] text-balance text-slate-800">
            Vote com
            <span className="block text-indigo-600">consciência.</span>
          </h1>
          <p className="mx-auto max-w-[640px] text-[17px] leading-relaxed text-pretty text-slate-600 sm:text-[19px]">
            Compare os candidatos à Presidência com base em{" "}
            <strong className="font-semibold text-slate-800">posições reais</strong>,
            votações nominais e gastos declarados ao TSE. Sem viés, sem propaganda —
            toda afirmação tem fonte.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            to="/quiz"
            prefetch="intent"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-8 py-4 text-[17px] font-bold text-white shadow-lg shadow-slate-800/10 transition-colors hover:bg-slate-900"
          >
            <Sparkles className="size-[18px]" aria-hidden="true" />
            Fazer o Quiz
            <ArrowRight className="size-[18px]" aria-hidden="true" />
          </Link>
          <Link
            to={HOME_RACE_HREF}
            prefetch="intent"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-4 text-[15px] font-semibold text-slate-600 transition-colors hover:border-slate-300"
          >
            {candidateCount > 0
              ? `Ver as ${candidateCount} candidaturas à Presidência`
              : "Ver as candidaturas à Presidência"}
          </Link>
        </div>

        <ul className="flex flex-col items-center gap-2 text-[13px] text-slate-500 sm:flex-row sm:gap-6">
          {TRUST.map((t) => (
            <li key={t.strong}>
              <strong className="font-semibold text-slate-800">{t.strong}</strong>{" "}
              {t.rest}
            </li>
          ))}
        </ul>
      </Container>

      <Container className="grid gap-4 pb-14 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-5"
          >
            <span className="flex size-7 flex-none items-center justify-center rounded-full bg-indigo-600/[0.08] text-[13px] font-bold text-indigo-600">
              {i + 1}
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-slate-800">{step.title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                {step.body}
              </p>
            </div>
          </div>
        ))}
      </Container>

      {recentBills.length > 0 && (
        <Container className="pb-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold tracking-[-0.02em] text-slate-800">
                Votações recentes
              </h2>
              <p className="mt-1 text-[13.5px] text-slate-500">
                Como o Congresso votou nos temas que estão em disputa na eleição.
              </p>
            </div>
            <Link
              to="/votacoes"
              className="flex-none text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Ver todas →
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {recentBills.map((bill) => (
              <Link
                key={bill.id}
                to={`/votacao/${bill.id}`}
                prefetch="intent"
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-300"
              >
                <span className="text-[11px] font-bold tracking-[0.06em] text-indigo-600 uppercase">
                  {bill.sourceType === "senado" ? "Senado" : "Câmara"}
                </span>
                <span className="text-[15px] leading-snug font-bold text-pretty text-slate-800">
                  {bill.simplifiedTitle || bill.title}
                </span>
                {bill.simplifiedDescription && (
                  <span className="line-clamp-3 text-[13px] leading-relaxed text-slate-500">
                    {bill.simplifiedDescription}
                  </span>
                )}
                <time
                  dateTime={bill.voteDate}
                  className="mt-auto pt-2 text-[12px] text-slate-500"
                >
                  {new Intl.DateTimeFormat("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(bill.voteDate))}
                </time>
              </Link>
            ))}
          </div>
        </Container>
      )}

      {articles.length > 0 && (
        <Container className="pb-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold tracking-[-0.02em] text-slate-800">
                Para entender a eleição
              </h2>
              <p className="mt-1 text-[13.5px] text-slate-500">
                Textos curtos e sem lado sobre como o voto funciona.
              </p>
            </div>
            <Link
              to="/educacao"
              className="flex-none text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Ver todos →
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {articles.map((article) => (
              <Link
                key={article.slug}
                to={`/${article.slug}`}
                prefetch="intent"
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-300"
              >
                <span className="text-[11px] font-bold tracking-[0.06em] text-indigo-600 uppercase">
                  {article.category}
                </span>
                <span className="text-[15px] leading-snug font-bold text-pretty text-slate-800">
                  {article.title}
                </span>
                <span className="line-clamp-3 text-[13px] leading-relaxed text-slate-500">
                  {article.excerpt}
                </span>
              </Link>
            ))}
          </div>
        </Container>
      )}
    </main>
  );
}
