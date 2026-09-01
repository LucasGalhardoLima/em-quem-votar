import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { Menu, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { Container } from "./Container";

/**
 * As seções de primeiro nível do site. Uma rota que não está aqui nem no
 * rodapé só existe para quem chega por busca ou por um link interno solto —
 * foi o que aconteceu com `/educacao`, dez artigos alcançáveis a partir de um
 * único link no meio da home. Quem entrava por qualquer outra página nunca
 * descobria a seção. Antes de criar uma rota de conteúdo, decida aqui (menu) ou
 * no `SiteFooter` (institucional) por onde se chega nela.
 */
const NAV_ITEMS = [
  {
    label: "Candidatos",
    to: "/candidatos",
    match: ["/candidatos", "/candidato"],
  },
  { label: "Quiz", to: "/quiz", match: ["/quiz", "/resultado"] },
  { label: "Comparação", to: "/comparar", match: ["/comparar"] },
  { label: "Votações", to: "/votacoes", match: ["/votacoes", "/votacao"] },
  { label: "Educação", to: "/educacao", match: ["/educacao"] },
  { label: "Metodologia", to: "/metodologia", match: ["/metodologia"] },
] as const;

/**
 * Alvo do link de salto. As rotas marcam o próprio `<main>` com este id; onde
 * ele ainda não existe, o fallback pega o primeiro `<main>` da página — assim
 * o link nunca vira âncora morta enquanto as demais telas não são marcadas.
 */
export const MAIN_CONTENT_ID = "conteudo";

/**
 * Alvo do `aria-controls` do botão de menu. `aria-controls` é um IDREF: se o
 * id não resolve, o atributo é inválido e a relação simplesmente não existe —
 * então o `<nav>` fica sempre no DOM e alterna `hidden`, em vez de ser
 * desmontado. É também o que o padrão de disclosure da WAI-ARIA faz.
 *
 * Isto é seguro NESTE projeto porque o preflight do Tailwind v4 declara
 * `[hidden]:where(:not([hidden="until-found"])) { display: none !important }`
 * (node_modules/tailwindcss/preflight.css:391, entra via `@import "tailwindcss"`
 * no topo de app.css). O `!important` põe o atributo acima de qualquer
 * utilitária de `display` — o modo clássico de esse padrão quebrar. Se algum
 * dia o preflight sair, `hidden` volta a ser só o UA stylesheet e uma classe
 * de `display` no `<nav>` passa a vencê-lo.
 */
const MOBILE_NAV_ID = "menu-mobile";

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

  /**
   * Fechar no `onClick` de cada NavLink não bastava: o logo e o botão do quiz
   * também navegam, e ficam FORA do menu. Sair por um deles deixava o menu
   * aberto sobre a página nova. Aqui a rota é a fonte da verdade; o `onClick`
   * dos NavLinks continua porque clicar no item da rota atual não muda o
   * `pathname` e portanto não dispara este efeito.
   */
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      {/*
        Primeiro foco tabulável da página. Sem ele o teclado percorre os seis
        itens de navegação a cada troca de rota antes de chegar ao conteúdo.
      */}
      <a
        href={`#${MAIN_CONTENT_ID}`}
        onClick={skipToContent}
        className="focus-ring sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-50 focus:rounded-xl focus:bg-slate-800 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white"
      >
        Pular para o conteúdo
      </a>
      {/*
        O espaçamento entre os três blocos é medido, não escolhido: a linha
        inteira (marca 138px + botão do quiz 118px + menu 44px) não cabe nos
        280px úteis de uma tela de 320px com o respiro de 36px do desktop. Como
        a marca não encolhe e o menu tem largura fixa, o único item que cedia
        era o botão — que colapsava para a menor palavra e quebrava em três
        linhas. Aqui o respiro acompanha a largura: 8px até o `lg` e os 36px
        originais a partir dele.

        A navegação horizontal começa em `lg`, e não em `md` como antes: com
        `Educação` são SEIS itens, e a linha de 768px passou a estourar 87px
        para fora da viewport (medido no Chrome headless em /metodologia; com
        cinco itens era 0). O estouro some por volta de 860px, então `lg`
        (1024px) é o primeiro degrau do Tailwind que cabe com folga — na faixa
        768–1023 o menu de hambúrguer assume. Refeito depois da mudança: 0px de
        estouro em 320, 360, 390, 414, 768, 900, 1023, 1024, 1280 e 1440.

        UM CASO CONHECIDO, anterior a esta mudança e não resolvido aqui: a
        320px a linha cabe por 0px — a caixa do botão de menu termina
        exatamente na borda da viewport, gastando o respiro direito do
        Container. Quando a barra de rolagem é clássica (Windows/Linux, ou
        zoom de 400% num monitor de 1280) ela come 15px e a viewport de layout
        vira 305px: aí a mesma linha estoura 15px. Não é efeito do sexto item
        (a 320px a navegação horizontal está escondida); os três blocos da
        linha — marca 138px, botão 102px e menu 44px — já somavam isso. Sair
        disso exige encurtar a marca ou o rótulo do botão abaixo de 360px, que
        é decisão de conteúdo, não de layout.
      */}
      <Container className="flex items-center gap-2 py-3.5 lg:gap-9">
        <Link
          to="/"
          className="focus-ring flex-none rounded-sm text-base font-black tracking-[-0.04em] text-slate-800"
        >
          EM QUEM <span className="text-indigo-600">VOTAR?</span>
        </Link>

        <nav
          aria-label="Principal"
          className="hidden flex-1 items-center gap-6 text-sm lg:flex"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              prefetch="intent"
              className={cn(
                "focus-ring rounded-sm transition-colors hover:text-slate-800",
                isActive(item)
                  ? "font-bold text-slate-800"
                  : "font-medium text-slate-600",
              )}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {/*
            Botão SECUNDÁRIO de propósito. Ele era `bg-slate-800` — o mesmo
            preenchimento, a mesma palavra e o mesmo destino do botão do herói
            da home, os dois acima da dobra. Duas primárias idênticas na porta
            de entrada anulam uma à outra: o cabeçalho é fixo e roubava do
            herói a condição de destino único da página. O acesso ao quiz
            continua em toda rota, em contorno; o preenchimento cheio fica com
            a ação principal de cada tela.

            Revisto em 2026-08-31 para as rotas onde o quiz seria a ação
            principal: a conclusão não muda. `/candidatos` tem "comparar",
            `/comparar` tem "ver a ficha", `/votacao/:id` tem a fonte oficial,
            `/quiz` já É o quiz — em nenhuma delas o botão do cabeçalho é a
            ação principal da tela. Promovê-lo só onde não há concorrente faria
            o cabeçalho mudar de peso a cada rota, que é justamente o que uma
            barra fixa não pode fazer: ela é a única coisa idêntica em todas as
            páginas.
          */}
          {/*
            `flex-none whitespace-nowrap`: o rótulo de um botão nunca é ponto
            de quebra. Sem isto o botão era o único item elástico da linha e
            absorvia sozinho toda a falta de espaço, encolhendo até a largura
            da maior palavra — "Fazer / o / Quiz" em três linhas de 86px de
            altura. Não bastaria sozinho: numa caixa genuinamente estreita
            trocaria quebra por rolagem horizontal (24px de estouro a 320px,
            medidos), e é por isso que vem junto com o respiro variável do
            Container acima e com o recuo menor abaixo de 360px — a única
            combinação que zera o estouro na largura de referência do SC 1.4.10.
          */}
          <Link
            to="/quiz"
            className="focus-ring flex-none rounded-xl border border-slate-200 bg-white px-2 py-3 text-sm font-semibold whitespace-nowrap text-slate-800 transition-colors min-[360px]:px-4 hover:border-slate-300 hover:bg-slate-50"
          >
            Fazer o Quiz
          </Link>
          {/* `p-3` + ícone de 20px = 44px, o alvo mínimo do SC 2.5.8; o
              `-mr-2` devolve os 8px de padding novo para que o ícone continue
              alinhado à régua do Container. */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls={MOBILE_NAV_ID}
            className="focus-ring -mr-2 rounded-lg p-3 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            {open ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </Container>

      {/* Sempre no DOM, escondido com `hidden` — ver a nota em MOBILE_NAV_ID.
          `inert` junto: `display:none` já tira do foco em todo navegador atual,
          mas `hidden` é uma linha de CSS de distância de ser sobrescrito,
          enquanto `inert` é do DOM e sobrevive a isso. É a diferença entre não
          haver foco escondido e não haver foco escondido POR ENQUANTO. */}
      <nav
        id={MOBILE_NAV_ID}
        hidden={!open}
        inert={!open}
        aria-label="Menu"
        className="border-t border-slate-200 bg-white lg:hidden"
      >
        <Container className="flex flex-col py-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "focus-ring rounded-lg px-2 py-3 text-sm transition-colors",
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
    </header>
  );
}
