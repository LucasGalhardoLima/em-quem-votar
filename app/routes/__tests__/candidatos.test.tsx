/**
 * Comportamento do lote de `/candidatos`.
 *
 * A lista passou a renderizar 24 candidaturas por vez com um "mostrar mais",
 * porque as 211 de uma vez davam 49.662px de rolagem no telefone. Essa é uma
 * mudança barata de fazer e cara de errar: a ordem da lista é SORTEADA por
 * request (`shuffleSeed`) justamente para que nenhuma candidatura ganhe a
 * primeira posição de graça, e um lote que reordene ou duplique ao expandir
 * desfaz essa garantia sem que nada na tela denuncie.
 *
 * Por isso o caso central aqui não é "o botão revela mais cartões" e sim
 * "o lote seguinte é o sufixo exato da mesma ordem, sem repetir ninguém".
 * É teste de uma regra de produto do CLAUDE.md, não de um detalhe de UI.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll } from "vitest";

/**
 * Shim de `Request` — mistura de realms, não defeito do produto.
 *
 * Ao digitar na busca a rota navega, e o React Router monta um `Request`
 * client-side passando o `signal` de um `AbortController`. Sob vitest, esse
 * controller vem do jsdom, enquanto `Request` vem do undici embutido no Node
 * — que faz brand check de webidl e rejeita um `AbortSignal` que não seja o
 * dele. O resultado é `TypeError: Expected signal to be an instance of
 * AbortSignal` como unhandled rejection: os testes passam e a suíte sai com
 * código 1.
 *
 * No navegador as duas classes vêm do MESMO realm, então a incompatibilidade
 * não existe fora daqui — shimar é registrar isso, não esconder falha. O
 * shim é deliberadamente burro: só guarda url e init, que é tudo que o
 * caminho de navegação toca neste arquivo.
 */
beforeAll(() => {
  const Original = globalThis.Request;
  class TestRequest {
    url: string;
    method = "GET";
    constructor(url: string | URL, init?: RequestInit) {
      this.url = String(url);
      Object.assign(this, init);
      // `method` depois do assign e com reserva: o React Router chama
      // `request.method.toUpperCase()` para saber se a navegação é mutação, e
      // um init sem `method` (o caso de toda navegação por link) deixaria a
      // propriedade indefinida.
      this.method = init?.method ?? "GET";
    }
  }
  globalThis.Request = TestRequest as unknown as typeof Original;
});
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import Candidatos from "../candidatos";
import { useComparisonStore } from "~/stores/comparisonStore";

function makeItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    name: `NOME COMPLETO ${i}`,
    displayName: i === 3 ? "ZEBRA SINGULAR" : `CANDIDATO ${i}`,
    party: "PT",
    coalition: null,
    photoUrl: null,
    registrationStatus: i % 2 === 0 ? "APPROVED" : "PENDING_JUDGMENT",
    tseStatusLabel: null,
    number: 10 + i,
    viceName: `VICE ${i}`,
    viceParty: "PT",
    positionCount: 0,
    office: i < 13 ? "presidential" : "governor",
    uf: i < 13 ? null : "RN",
  }));
}

function renderList(count = 60) {
  const items = makeItems(count);
  const router = createMemoryRouter(
    [
      {
        path: "/candidatos",
        element: (
          <Candidatos
            {...({
              loaderData: {
                items,
                total: count,
                statusCounts: [
                  { status: "APPROVED", count: Math.ceil(count / 2) },
                  { status: "PENDING_JUDGMENT", count: Math.floor(count / 2) },
                ],
                initialQuery: "",
                initialStatus: "todos",
                uf: null,
                office: null,
              },
            } as unknown as Parameters<typeof Candidatos>[0])}
          />
        ),
      },
    ],
    { initialEntries: ["/candidatos"] },
  );
  return render(<RouterProvider router={router} />);
}

function cardNames(): string[] {
  return screen
    .getAllByRole("article")
    .map(
      (a) => within(a).getAllByRole("heading", { level: 3 })[0].textContent ?? "",
    );
}

function type(value: string) {
  fireEvent.change(screen.getByLabelText("Buscar candidatos"), {
    target: { value },
  });
}

beforeEach(() => {
  useComparisonStore.setState({ selectedIds: [], hydrated: false });
});

describe("lote", () => {
  it("24 no primeiro lote; o próximo não duplica nem reordena", () => {
    renderList(60);
    const first = cardNames();
    expect(first).toHaveLength(24);

    fireEvent.click(
      screen.getByRole("button", { name: /Mostrar mais 24 de 36 restantes/ }),
    );

    const second = cardNames();
    expect(second).toHaveLength(48);
    expect(second.slice(0, 24)).toEqual(first); // prefixo — ordem do servidor intacta
    expect(new Set(second).size).toBe(second.length); // sem duplicatas
  });

  it("busca reseta o lote", () => {
    renderList(60);
    fireEvent.click(screen.getByRole("button", { name: /Mostrar mais/ }));
    expect(cardNames()).toHaveLength(48);
    type("CANDIDATO");
    expect(cardNames()).toHaveLength(24);
  });

  it("último lote muda o rótulo e o botão some", () => {
    renderList(30);
    fireEvent.click(screen.getByRole("button", { name: /Mostrar as 6 restantes/ }));
    expect(cardNames()).toHaveLength(30);
    expect(screen.queryByRole("button", { name: /^Mostrar/ })).toBeNull();
  });

  it("todas as seções de disputa cabem no orçamento do lote, em ordem de cédula", () => {
    renderList(60);
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings[0]).toBe("Presidente");
    // 13 presidenciais + 11 do governo de RN = 24
    expect(headings).toEqual(["Presidente", "Governador — Rio Grande do Norte"]);
    expect(screen.getByText("11 de 47 candidaturas")).toBeTruthy();
  });
});

describe("feedback", () => {
  it("estado vazio nomeia o termo buscado e oferece limpar", () => {
    renderList(30);
    type("xyzzy");
    expect(
      screen.getByText(/Nenhuma candidatura encontrada para .xyzzy./),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Limpar filtros" }).length,
    ).toBeGreaterThan(0);
  });

  it("live region anuncia a contagem depois que a digitação para", async () => {
    renderList(30);
    const live = document.querySelector('[aria-live="polite"][role="status"]')!;
    type("ZEBRA");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 700));
    });
    expect(live.textContent).toMatch(/1 candidatura para ZEBRA/);
  });

  it("contagem visível fica junto do controle", () => {
    renderList(30);
    expect(screen.getByText("30 candidaturas")).toBeTruthy();
  });

  it("limpar filtros zera busca e situação", () => {
    renderList(30);
    type("xyzzy");
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect(cardNames()).toHaveLength(24);
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
  });
});

describe("bandeja de filtros", () => {
  it("botão Filtros controla a bandeja por aria-expanded/aria-controls", () => {
    renderList(30);
    const btn = screen.getByRole("button", { name: /Filtros/ });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    const trayId = btn.getAttribute("aria-controls")!;
    const tray = document.getElementById(trayId)!;
    expect(tray).toBeTruthy();
    expect(tray.className).toContain("hidden");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(trayId)!.className).not.toContain("hidden");
  });
});

describe("comparar", () => {
  it("o botão de comparar age sem navegar para a ficha", () => {
    renderList(30);
    act(() => useComparisonStore.setState({ hydrated: true }));
    const btn = screen.getAllByRole("button", { name: /à comparação/ })[0];
    expect(btn.getAttribute("aria-label")).toMatch(
      /Adicionar CANDIDATO 0 à comparação/,
    );
    fireEvent.click(btn);
    expect(useComparisonStore.getState().selectedIds).toEqual(["id-0"]);
    expect(window.location.pathname).not.toContain("/candidato/");
  });
});

describe("cartão", () => {
  it("o item de grade tem min-w-0 e o nome não usa truncate", () => {
    renderList(30);
    const card = screen.getAllByRole("article")[0];
    expect(card.className.split(/\s+/)).toContain("min-w-0");
    const h3 = within(card).getAllByRole("heading", { level: 3 })[0];
    expect(h3.className).toContain("line-clamp-2");
    expect(h3.className).not.toContain("truncate");
    const vice = within(card).getByText(/^Vice:/);
    expect(vice.className).toContain("line-clamp-2");
    expect(vice.className).not.toContain("truncate");
  });
});
