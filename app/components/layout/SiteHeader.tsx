import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { Menu, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { Container } from "./Container";

const NAV_ITEMS = [
  { label: "Candidatos", to: "/candidatos", match: ["/candidatos", "/candidato"] },
  { label: "Quiz", to: "/quiz", match: ["/quiz", "/resultado"] },
  { label: "Comparação", to: "/comparar", match: ["/comparar"] },
  { label: "Votações", to: "/votacoes", match: ["/votacoes", "/votacao"] },
  { label: "Metodologia", to: "/metodologia", match: ["/metodologia"] },
] as const;

/**
 * Alvo do link de salto. As rotas marcam o próprio `<main>` com este id; onde
 * ele ainda não existe, o fallback pega o primeiro `<main>` da página — assim
 * o link nunca vira âncora morta enquanto as demais telas não são marcadas.
 */
export const MAIN_CONTENT_ID = "conteudo";

function skipToContent(event: React.MouseEvent<HTMLAnchorElement>) {
  const target =
    document.getElementById(MAIN_CONTENT_ID) ?? document.querySelector("main");
  if (!target) return; // deixa o navegador tentar a âncora sozinho
  event.preventDefault();
  target.setAttribute("tabindex", "-1");
  target.focus();
  target.scrollIntoView();
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      {/*
        Primeiro foco tabulável da página. Sem ele o teclado percorre os cinco
        itens de navegação a cada troca de rota antes de chegar ao conteúdo.
      */}
      <a
        href={`#${MAIN_CONTENT_ID}`}
        onClick={skipToContent}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-50 focus:rounded-xl focus:bg-slate-800 focus:px-4 focus:py-2.5 focus:text-[13.5px] focus:font-semibold focus:text-white"
      >
        Pular para o conteúdo
      </a>
      <Container className="flex items-center gap-9 py-3.5">
        <Link
          to="/"
          className="flex-none text-base font-black tracking-[-0.04em] text-slate-800"
        >
          EM QUEM <span className="text-indigo-600">VOTAR?</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-6 text-[13.5px] md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              prefetch="intent"
              className={cn(
                "transition-colors hover:text-slate-800",
                isActive(item)
                  ? "font-bold text-slate-800"
                  : "font-medium text-slate-600",
              )}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link
            to="/quiz"
            className="rounded-xl bg-slate-800 px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-slate-900"
          >
            Fazer o Quiz
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            className="-mr-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </Container>

      {open && (
        <nav className="border-t border-slate-200 bg-white md:hidden">
          <Container className="flex flex-col py-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-2 py-3 text-sm transition-colors",
                  isActive(item)
                    ? "font-bold text-slate-800"
                    : "font-medium text-slate-600",
                )}
              >
                {item.label}
              </NavLink>
            ))}
          </Container>
        </nav>
      )}
    </header>
  );
}
