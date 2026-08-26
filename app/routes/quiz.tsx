import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Check } from "lucide-react";
import type { Route } from "./+types/quiz";
import { Container } from "~/components/layout";
import { useQuizHydration, useQuizStore } from "~/stores/quizStore";
import {
  IMPORTANCE_LABELS,
  IMPORTANCE_LEVELS,
  USER_STANCE_LABELS,
  type ImportanceLevel,
} from "~/lib/stance";
import { db } from "~/utils/db.server";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Quiz — descubra quais candidaturas mais se aproximam de você" },
    {
      name: "description",
      content:
        "Responda ao quiz e compare suas respostas com as posições documentadas dos candidatos à Presidência. Sem cadastro: as respostas ficam no seu aparelho.",
    },
    { name: "robots", content: "index,follow" },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  const questions = await db.quizQuestion.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    include: {
      topic: { select: { slug: true, name: true, category: true, order: true } },
      options: { orderBy: { stanceValue: "asc" } },
    },
  });

  return {
    questions: questions.map((q) => ({
      id: q.id,
      text: q.text,
      topicSlug: q.topic.slug,
      topicName: q.topic.name,
      topicCategory: q.topic.category,
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label || USER_STANCE_LABELS[o.stanceValue] || "",
        description: o.description,
        stanceValue: o.stanceValue,
      })),
    })),
  };
}

export default function Quiz({ loaderData }: Route.ComponentProps) {
  const { questions } = loaderData;
  const navigate = useNavigate();
  const hydrated = useQuizHydration();

  const [index, setIndex] = useState(0);
  const answers = useQuizStore((s) => s.answers);
  const weights = useQuizStore((s) => s.weights);
  const setAnswer = useQuizStore((s) => s.setAnswer);
  const clearAnswer = useQuizStore((s) => s.clearAnswer);
  const setWeight = useQuizStore((s) => s.setWeight);

  const total = questions.length;
  const question = questions[index];

  const categoryPosition = useMemo(() => {
    if (!question) return { current: 0, total: 0 };
    const categories = [...new Set(questions.map((q) => q.topicCategory))];
    return {
      current: categories.indexOf(question.topicCategory) + 1,
      total: categories.length,
    };
  }, [questions, question]);

  if (total === 0) {
    return (
      <main className="flex-1">
        <Container className="py-20 text-center">
          <h1 className="font-heading text-2xl font-bold text-slate-800">
            O quiz ainda não está disponível
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[14.5px] text-slate-500">
            As perguntas ainda não foram carregadas neste ambiente. Enquanto
            isso, você pode navegar pelos candidatos e ver as posições
            documentadas.
          </p>
          <Link
            to="/candidatos"
            className="mt-6 inline-block rounded-xl bg-slate-800 px-6 py-3 text-[13.5px] font-semibold text-white hover:bg-slate-900"
          >
            Ver os candidatos
          </Link>
        </Container>
      </main>
    );
  }

  if (!question) return null;

  const answer = hydrated ? answers[question.topicSlug] : undefined;
  const weight: ImportanceLevel =
    (hydrated ? weights[question.topicCategory] : undefined) ?? "medium";
  const isLast = index === total - 1;
  const progressPct = (index / total) * 100;

  function goNext() {
    if (isLast) navigate("/resultado");
    else setIndex((i) => i + 1);
  }

  function goBack() {
    if (index === 0) navigate("/");
    else setIndex((i) => i - 1);
  }

  function skip() {
    clearAnswer(question.topicSlug);
    goNext();
  }

  return (
    <main className="flex-1">
      <Container className="pt-3">
        <div className="mb-1.5 flex justify-between text-[12px] text-slate-500">
          <span>
            <strong className="font-semibold text-slate-800">
              Pergunta {index + 1}
            </strong>{" "}
            de {total}
          </span>
          <span className="truncate pl-3">
            {question.topicCategory} · tema {categoryPosition.current} de{" "}
            {categoryPosition.total}
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label="Progresso do quiz"
        >
          <div
            className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </Container>

      <div className="mx-auto w-full max-w-[640px] px-5 pt-9 pb-14 sm:px-10">
        <span className="inline-block rounded-full border border-indigo-600/[0.12] bg-indigo-600/[0.06] px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] text-indigo-600 uppercase">
          {question.topicName}
        </span>

        <h1 className="font-heading mt-3.5 text-[22px] leading-[1.25] font-bold tracking-[-0.01em] text-pretty text-slate-800 sm:text-[26px]">
          {question.text}
        </h1>

        <div
          className="mt-5 grid gap-2"
          role="radiogroup"
          aria-label="Sua resposta"
        >
          {question.options.map((option) => {
            const selected = answer === option.stanceValue;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setAnswer(question.topicSlug, option.stanceValue)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl px-[18px] text-left text-[14.5px] transition-colors",
                  selected
                    ? "border-2 border-indigo-600 bg-indigo-600/[0.06] py-3 font-bold text-slate-800"
                    : "border border-slate-200 bg-white py-[13px] font-medium text-slate-600 hover:border-indigo-300",
                )}
              >
                <span>
                  {option.label}
                  {option.description && (
                    <span className="mt-0.5 block text-[12.5px] font-normal text-slate-400">
                      {option.description}
                    </span>
                  )}
                </span>
                {selected && (
                  <Check className="size-4 flex-none text-indigo-600" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-[18px] py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[13px] text-slate-500">
            Peso de <strong className="font-semibold text-slate-700">
              {question.topicCategory}
            </strong>{" "}
            para você
          </span>
          <div className="flex gap-1.5" role="group" aria-label="Peso do tema">
            {IMPORTANCE_LEVELS.map((level) => {
              const active = weight === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setWeight(question.topicCategory, level)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors",
                    active
                      ? "border-slate-800 bg-slate-800 font-bold text-white"
                      : "border-slate-200 bg-white font-semibold text-slate-500 hover:border-slate-300",
                  )}
                >
                  {IMPORTANCE_LABELS[level]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            className="text-[13.5px] font-semibold text-slate-500 transition-colors hover:text-slate-800"
          >
            ← Voltar
          </button>
          <button
            type="button"
            onClick={skip}
            className="text-[13px] text-slate-400 transition-colors hover:text-slate-500"
          >
            Pular este tema
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={answer === undefined}
            className={cn(
              "rounded-xl px-7 py-3 text-[14.5px] font-bold transition-colors",
              answer === undefined
                ? "cursor-not-allowed bg-slate-200 text-slate-400"
                : "bg-slate-800 text-white hover:bg-slate-900",
            )}
          >
            {isLast ? "Ver resultado →" : "Próxima →"}
          </button>
        </div>

        <p className="mt-7 text-center text-[12px] text-slate-400">
          Sair e continuar depois — as respostas ficam no aparelho. Nada é
          enviado ao servidor.
        </p>
      </div>
    </main>
  );
}
