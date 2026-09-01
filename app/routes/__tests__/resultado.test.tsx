import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import Resultado from "../resultado";
import type { MatchCandidate } from "~/lib/match";
import { useQuizStore } from "~/stores/quizStore";

/**
 * O que esta suíte trava é REDAÇÃO, não layout.
 *
 * As frases do /resultado afirmam coisas sobre pessoas reais — "nenhuma
 * candidatura tem posição registrada com fonte" é uma acusação de omissão. As
 * condições que escolhem cada frase são derivadas no corpo do componente, e
 * duas delas já saíram erradas: `anyComparable` é relativo aos temas
 * RESPONDIDOS, e o piso de `match.ts` torna o percentual inalcançável quando o
 * quiz é curto demais. Nos dois casos a falta era do quiz e o texto culpava a
 * documentação.
 *
 * Por isso os testes conferem a frase que a pessoa lê, e não um booleano: é a
 * frase que pode mentir.
 */

const CATEGORIES: Record<string, string> = {
  saude: "Social",
  economia: "Econômico",
  seguranca: "Segurança",
  ambiente: "Ambiental",
  educacao: "Social",
};

const TOPICS = Object.entries(CATEGORIES).map(([slug, category]) => ({
  slug,
  name: slug,
  category,
}));

function candidate(
  id: string,
  positions: Record<string, number>,
  /** Posições documentadas em temas FORA do quiz — o caso que a frase errava. */
  extraDocumented = 0,
): MatchCandidate {
  return {
    id,
    name: id,
    displayName: id,
    party: "PARTIDO",
    photoUrl: null,
    coalition: null,
    registrationStatus: "APPROVED",
    tseStatusLabel: null,
    number: 10,
    positions,
    positionCategories: Object.fromEntries(
      Object.keys(positions).map((slug) => [slug, CATEGORIES[slug] ?? "Outros"]),
    ),
    positionCount: Object.keys(positions).length + extraDocumented,
  };
}

function setAnswers(answers: Record<string, number>) {
  window.localStorage.setItem(
    "quiz-answers",
    JSON.stringify({
      state: { answers, weights: {}, updatedAt: "2026-08-28T12:00:00.000Z" },
      version: 0,
    }),
  );
}

function renderResultado(
  candidates: MatchCandidate[],
  totalQuestions = TOPICS.length,
) {
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <Resultado
          // O componente só lê `loaderData`; os demais campos de Route.ComponentProps
          // não são tocados por nenhum caminho testado aqui.
          {...({
            loaderData: { candidates, topics: TOPICS, totalQuestions },
          } as unknown as Parameters<typeof Resultado>[0])}
        />
      ),
    },
  ]);
  return render(<RouterProvider router={router} />);
}

/** Texto corrido da página, com espaços normalizados. */
function pageText(): string {
  return (document.body.textContent ?? "").replace(/\s+/g, " ");
}

beforeEach(() => {
  window.localStorage.clear();
  // O store é módulo, não instância: sem zerar `hydrated` o segundo teste
  // reaproveita as respostas do primeiro, porque `useQuizHydration` sai cedo
  // quando já hidratou e nunca relê o localStorage.
  useQuizStore.setState({
    answers: {},
    weights: {},
    updatedAt: null,
    hydrated: false,
  });
});

describe("/resultado — de quem é a falta", () => {
  it("uma resposta só: o gargalo é o quiz, e a frase não culpa a candidatura", async () => {
    // Piso mínimo de match.ts é 2 temas comparáveis; com UMA resposta o máximo
    // possível é 1. Nem a candidatura que documentou tudo alcança percentual.
    setAnswers({ saude: 5 });
    renderResultado([
      candidate("Ana", { saude: 5 }, 13),
      candidate("Bruno", { saude: 1 }, 13),
    ]);

    expect(await screen.findByText("Sua compatibilidade")).toBeInTheDocument();

    const text = pageText();
    expect(text).toContain("o que falta aqui é resposta, não documento");
    expect(text).not.toContain("Nenhuma candidatura tem base documental");
    // A lista aparece (a base existe), sem percentual.
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getAllByText("Base insuficiente")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Voltar ao quiz/ })).toHaveAttribute(
      "href",
      "/quiz",
    );
  });

  it("duas respostas ainda alcançam percentual — o piso é 2, não 3", async () => {
    // Derruba a hipótese de que 1 OU 2 respostas caem sempre no estado sem
    // pódio: com as duas pontas nos dois temas, o número é publicável.
    setAnswers({ saude: 5, economia: 5 });
    renderResultado([
      candidate("Ana", { saude: 5, economia: 5 }),
      candidate("Bruno", { saude: 1 }),
    ]);

    expect(await screen.findByText("Sua compatibilidade")).toBeInTheDocument();
    expect(pageText()).toContain("Empates aparecem em ordem alfabética");
    expect(screen.getByText(/^\d+%$/)).toBeInTheDocument();
  });

  it("quiz longo e base fraca: aí a falta é documental, escopada ao que se respondeu", async () => {
    // Cinco respostas → piso 3. Todo mundo com 1 ou 2 temas comparáveis.
    setAnswers({ saude: 5, economia: 5, seguranca: 5, ambiente: 5, educacao: 5 });
    renderResultado([
      candidate("Ana", { saude: 5 }),
      candidate("Bruno", { economia: 2, saude: 4 }),
    ]);

    expect(await screen.findByText("Sua compatibilidade")).toBeInTheDocument();

    const text = pageText();
    expect(text).toContain(
      "Nenhuma candidatura tem posição documentada em temas suficientes entre os que você respondeu",
    );
    // Não oferece "responda mais perguntas": aqui responder mais não é o ponto.
    expect(screen.queryByRole("link", { name: /Voltar ao quiz/ })).toBeNull();
  });

  it("estado vazio com documentação existente: a frase se limita aos temas respondidos", async () => {
    // Ninguém documentou os temas respondidos, mas as duas candidaturas têm
    // 13 posições registradas em outros temas. Dizer "nenhuma candidatura tem
    // posição registrada com fonte ainda" seria falso sobre as duas.
    setAnswers({ saude: 5, economia: 5, seguranca: 5 });
    renderResultado([
      candidate("Ana", { ambiente: 3 }, 12),
      candidate("Bruno", { educacao: 2 }, 12),
    ]);

    expect(await screen.findByText("Sua compatibilidade")).toBeInTheDocument();

    const text = pageText();
    expect(text).toContain(
      "Nenhuma posição documentada nos temas que você respondeu",
    );
    expect(text).toContain("há posições documentadas sobre outros temas");
    expect(text).not.toContain(
      "candidaturas tem posição registrada com fonte ainda",
    );
    expect(screen.getByRole("link", { name: /Voltar ao quiz/ })).toBeInTheDocument();
  });

  it("estado vazio sem documentação nenhuma: a afirmação absoluta é verdadeira e permanece", async () => {
    setAnswers({ saude: 5, economia: 5, seguranca: 5 });
    renderResultado([candidate("Ana", {}), candidate("Bruno", {})]);

    expect(await screen.findByText("Sua compatibilidade")).toBeInTheDocument();

    const text = pageText();
    expect(text).toContain("Ainda não há posições documentadas para comparar");
    expect(text).toContain(
      "nenhuma das 2 candidaturas tem posição registrada com fonte ainda",
    );
    expect(text).not.toContain("há posições documentadas sobre outros temas");
  });

  it("cartão sem tema comparável não afirma ausência absoluta quando há documentação", async () => {
    setAnswers({ saude: 5, economia: 5, seguranca: 5 });
    renderResultado([
      candidate("Ana", { saude: 5, economia: 5, seguranca: 5 }),
      // Documentada em 12 temas, nenhum deles respondido pela pessoa.
      candidate("Bruno", {}, 12),
      candidate("Carla", {}),
    ]);

    expect(await screen.findByText("Sua compatibilidade")).toBeInTheDocument();

    const text = pageText();
    expect(text).toContain("Nenhum tema que você respondeu tem posição documentada");
    expect(text).toContain("Nenhum tema com posição documentada ainda");
  });

  it("uma resposta só, sem grafia quebrada no estado vazio", async () => {
    setAnswers({ saude: 5 });
    renderResultado([candidate("Ana", {}, 5)]);

    expect(await screen.findByText("Sua compatibilidade")).toBeInTheDocument();

    const text = pageText();
    expect(text).toContain("Sua resposta continua guardada");
    expect(text).not.toContain("Suas 1 respostas");
  });
});
