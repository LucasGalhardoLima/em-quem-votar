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

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
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
