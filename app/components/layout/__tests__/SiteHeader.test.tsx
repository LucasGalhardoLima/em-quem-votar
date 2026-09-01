/**
 * Menu mobile do SiteHeader.
 *
 * O que estes testes protegem é silencioso quando quebra: o menu fica sempre
 * no DOM (o `aria-controls` do botão é um IDREF e precisa resolver também com
 * o menu fechado), então é `hidden` + `inert` que o tiram do fluxo e da
 * navegação por teclado. Trocar isso por desmontagem, ou perder o fechamento
 * na troca de rota, não quebra nenhuma tela — só deixa o menu aberto por cima
 * da página nova, ou o Tab caindo dentro de um menu invisível.
 *
 * A asserção "os links do menu fechado não recebem foco" foi deixada de fora
 * de propósito: o jsdom não implementa `inert` nem a regra de que um elemento
 * `display:none` deixa de ser área focável — `.focus()` funciona nos três
 * casos (verificado). Essa garantia vem do CSS compilado e da spec, não daqui.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { SiteHeader } from "../SiteHeader";

function Probe() {
  const { pathname } = useLocation();
  return <main id="conteudo">rota: {pathname}</main>;
}

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <SiteHeader />
      <Routes>
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const menu = () => document.getElementById("menu-mobile")!;
const burger = () => screen.getByRole("button", { name: /menu/i });
const desktopNav = () =>
  document.querySelector<HTMLElement>('nav[aria-label="Principal"]')!;
const hrefs = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLAnchorElement>("a")].map((a) =>
    a.getAttribute("href"),
  );

describe("SiteHeader — destinos do menu", () => {
  /**
   * O menu do telefone é uma SEGUNDA renderização da mesma lista. Enquanto
   * forem dois `map` sobre `NAV_ITEMS` isto é tautológico — e é exatamente por
   * isso que o teste existe: no dia em que alguém acrescentar um item "só no
   * desktop", metade dos visitantes (que chegam pelo telefone) deixa de ter
   * como alcançar a seção, e nenhuma tela quebra para avisar.
   */
  it("oferece a mesma lista no desktop e no telefone", () => {
    renderHeader();
    expect(hrefs(desktopNav())).toEqual(hrefs(menu()));
  });

  it("inclui /educacao, que só era alcançável pela home", () => {
    renderHeader();
    expect(hrefs(desktopNav())).toContain("/educacao");
    expect(hrefs(menu())).toContain("/educacao");
  });

  it("marca a seção atual, inclusive num artigo de /educacao", () => {
    render(
      <MemoryRouter initialEntries={["/educacao/como-escolher"]}>
        <SiteHeader />
      </MemoryRouter>,
    );
    const atual = [...desktopNav().querySelectorAll("a")].filter(
      (a) => a.getAttribute("aria-current") === "page",
    );
    expect(atual.map((a) => a.getAttribute("href"))).toEqual(["/educacao"]);
  });
});

describe("SiteHeader — menu mobile", () => {
  it("fica no DOM com o menu fechado, com hidden + inert", () => {
    renderHeader();
    expect(menu()).not.toBeNull();
    expect(menu().hasAttribute("hidden")).toBe(true);
    expect(menu().hasAttribute("inert")).toBe(true);
    expect(getComputedStyle(menu()).display).toBe("none");
    expect(burger().getAttribute("aria-controls")).toBe("menu-mobile");
    expect(
      document.getElementById(burger().getAttribute("aria-controls")!),
    ).toBe(menu());
    expect(burger().getAttribute("aria-expanded")).toBe("false");
  });

  it("abre e fecha pelo botão", () => {
    renderHeader();
    fireEvent.click(burger());
    expect(menu().hasAttribute("hidden")).toBe(false);
    expect(menu().hasAttribute("inert")).toBe(false);
    expect(burger().getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(burger());
    expect(menu().hasAttribute("hidden")).toBe(true);
    expect(menu().hasAttribute("inert")).toBe(true);
  });

  it("fecha ao clicar num item do próprio menu", () => {
    renderHeader();
    fireEvent.click(burger());
    const link = menu().querySelector<HTMLAnchorElement>(
      'a[href="/votacoes"]',
    )!;
    fireEvent.click(link);
    expect(screen.getByText(/rota: \/votacoes/)).toBeTruthy();
    expect(menu().hasAttribute("hidden")).toBe(true);
  });

  it("fecha ao navegar por um link de FORA do menu (CTA do quiz)", () => {
    renderHeader();
    fireEvent.click(burger());
    expect(menu().hasAttribute("hidden")).toBe(false);
    const cta = screen.getByRole("link", { name: "Fazer o Quiz" });
    expect(menu().contains(cta)).toBe(false);
    fireEvent.click(cta);
    expect(screen.getByText(/rota: \/quiz/)).toBeTruthy();
    expect(menu().hasAttribute("hidden")).toBe(true);
  });
});
