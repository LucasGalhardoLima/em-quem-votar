import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/quiz";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { QuizCard } from "~/components/quiz/QuizCard";
import { QuizProgress } from "~/components/quiz/QuizProgress";
import {
  ImportanceWeighting,
  type ImportanceLevel,
} from "~/components/quiz/ImportanceWeighting";
import { THEMATIC_CATEGORIES } from "~/data/archetypes";
import { db } from "~/utils/db.server";
import { Loader2, ArrowRight } from "lucide-react";

export function meta() {
  return [
    {
      title: "Quiz Presidencial: Descubra seu candidato | Em Quem Votar",
    },
    {
      name: "description",
      content:
        "Responda 20 perguntas e descubra qual candidato à presidência mais se alinha com suas ideias.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const questions = await db.quizQuestion.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    include: {
      topic: { select: { slug: true, name: true, category: true } },
      options: { orderBy: { order: "asc" } },
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
        label: o.label,
        description: o.description,
        stanceValue: o.stanceValue,
        icon: o.icon,
      })),
    })),
    totalQuestions: questions.length,
  };
}

type Phase = "quiz" | "importance" | "finishing";

export default function Quiz() {
  const { questions, totalQuestions } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<Phase>("quiz");
  const [importanceWeights, setImportanceWeights] = useState<
    Record<string, ImportanceLevel>
  >(() => {
    const defaults: Record<string, ImportanceLevel> = {};
    for (const cat of THEMATIC_CATEGORIES) {
      defaults[cat] = "medium";
    }
    return defaults;
  });

  const currentQuestion = questions[currentIndex];
  const axisLabel = currentQuestion?.topicCategory;

  const handleAnswer = (topicSlug: string, stanceValue: number) => {
    const newAnswers = { ...answers, [topicSlug]: stanceValue };
    setAnswers(newAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // All questions answered, go to importance weighting
      setPhase("importance");
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    setPhase("finishing");

    // Serialize answers: topicSlug:stance,topicSlug:stance,...
    const vectorString = Object.entries(answers)
      .map(([slug, stance]) => `${slug}:${stance}`)
      .join(",");

    // Serialize weights: category:level,category:level,...
    const weightsString = Object.entries(importanceWeights)
      .filter(([, level]) => level !== "medium")
      .map(([cat, level]) => `${encodeURIComponent(cat)}:${level}`)
      .join(",");

    const params = new URLSearchParams();
    if (vectorString) params.set("v", vectorString);
    if (weightsString) params.set("w", weightsString);

    setTimeout(() => {
      navigate(`/resultado?${params.toString()}`);
    }, 400);
  };

  // Quiz phase
  if (phase === "quiz" && currentQuestion) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header
          breadcrumbItems={[{ label: "Quiz Presidencial", active: true }]}
        />

        <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 max-w-2xl mx-auto w-full">
          <QuizProgress
            currentQuestion={currentIndex}
            totalQuestions={totalQuestions}
            axisLabel={axisLabel}
          />

          <div className="mt-6 md:mt-10 w-full">
            <QuizCard
              question={currentQuestion}
              questionNumber={currentIndex + 1}
              totalQuestions={totalQuestions}
              selectedValue={answers[currentQuestion.topicSlug] ?? null}
              onAnswer={handleAnswer}
              onBack={currentIndex > 0 ? handleBack : undefined}
            />
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // Importance weighting phase
  if (phase === "importance") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header
          breadcrumbItems={[{ label: "Quiz Presidencial", active: true }]}
        />

        <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 max-w-2xl mx-auto w-full">
          <div className="w-full space-y-6">
            <ImportanceWeighting
              weights={importanceWeights}
              onChange={(category, level) =>
                setImportanceWeights((prev) => ({ ...prev, [category]: level }))
              }
            />

            <button
              type="button"
              onClick={handleSubmit}
              className="w-full flex items-center justify-center gap-3 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold py-4 px-8 rounded-xl transition-colors text-lg"
            >
              Ver meu resultado
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // Finishing / loading overlay
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        breadcrumbItems={[{ label: "Quiz Presidencial", active: true }]}
      />
      <main className="flex-1 flex items-center justify-center">
        <div className="bg-card rounded-2xl p-8 md:p-12 max-w-md mx-4 text-center shadow-lg border border-border">
          <Loader2 className="w-12 h-12 text-brand-primary animate-spin mx-auto mb-6" />
          <h3 className="text-xl font-bold text-foreground mb-2">
            Calculando seu match...
          </h3>
          <p className="text-sm text-muted-foreground">
            Analisando suas respostas e comparando com as posições de todos os
            candidatos.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
