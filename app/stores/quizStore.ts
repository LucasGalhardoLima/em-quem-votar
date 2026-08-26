import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ImportanceLevel } from "~/lib/stance";

/**
 * Respostas do quiz. Vivem no aparelho e só no aparelho.
 *
 * Esta é a razão de o cálculo de compatibilidade ser isomórfico
 * (`app/lib/match.ts`): nenhuma resposta precisa ser serializada em URL nem
 * enviada a um loader para virar resultado. O que a plataforma promete na
 * /metodologia §5 é o que o código faz.
 */
interface QuizStore {
  /** topicSlug → 1..5 */
  answers: Record<string, number>;
  /** categoria temática → peso */
  weights: Record<string, ImportanceLevel>;
  /** Momento da última resposta, para o texto "respondido em". */
  updatedAt: string | null;
  hydrated: boolean;

  setAnswer: (topicSlug: string, stance: number) => void;
  clearAnswer: (topicSlug: string) => void;
  setWeight: (category: string, level: ImportanceLevel) => void;
  reset: () => void;
  markHydrated: () => void;
}

export const useQuizStore = create<QuizStore>()(
  persist(
    (set, get) => ({
      answers: {},
      weights: {},
      updatedAt: null,
      hydrated: false,

      setAnswer: (topicSlug, stance) =>
        set({
          answers: { ...get().answers, [topicSlug]: stance },
          updatedAt: new Date().toISOString(),
        }),

      clearAnswer: (topicSlug) => {
        const next = { ...get().answers };
        delete next[topicSlug];
        set({ answers: next, updatedAt: new Date().toISOString() });
      },

      setWeight: (category, level) =>
        set({ weights: { ...get().weights, [category]: level } }),

      reset: () => set({ answers: {}, weights: {}, updatedAt: null }),

      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "quiz-answers",
      partialize: (s) => ({
        answers: s.answers,
        weights: s.weights,
        updatedAt: s.updatedAt,
      }),
      skipHydration: true,
    },
  ),
);

/** Lê o localStorage após a montagem, para não divergir do HTML do SSR. */
export function useQuizHydration(): boolean {
  useEffect(() => {
    if (useQuizStore.getState().hydrated) return;
    void useQuizStore.persist.rehydrate();
    useQuizStore.getState().markHydrated();
  }, []);
  return useQuizStore((s) => s.hydrated);
}
