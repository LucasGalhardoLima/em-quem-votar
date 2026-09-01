import { useEffect, useState } from "react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteLoaderData,
} from "react-router";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "sonner";

import type { Route } from "./+types/root";
import "./app.css";
import { checkRateLimit } from "~/utils/rate-limit.server";
import {
  Container,
  MAIN_CONTENT_ID,
  SiteFooter,
  SiteHeader,
} from "~/components/layout";
import { countdownCopy } from "~/lib/election";

export async function loader({ request }: Route.LoaderArgs) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  if (!checkRateLimit(ip)) {
    throw new Response("Too Many Requests", { status: 429 });
  }
  return {
    /**
     * Contagem regressiva calculada no SERVIDOR, uma vez por request, para o
     * rodapé — mesma razão descrita no `CountdownBanner`: a data de referência
     * é Brasília, e computá-la no cliente divergiria da marcação do SSR.
     */
    countdown: countdownCopy(),
    /**
     * Origem absoluta do request, para a `<link rel="canonical">` do `Layout`.
     * Mesma leitura que `sitemap.xml` e o `og:url` da ficha de candidato já
     * fazem (`new URL(request.url).origin`) — não existe `SITE_URL` neste
     * projeto e introduzir uma segunda forma de descobrir o host criaria duas
     * respostas possíveis para "qual é a URL canônica desta página".
     */
    origin: new URL(request.url).origin,
  };
}

const SITE_NAME = "Em Quem Votar?";
const SITE_DESCRIPTION =
  "Compare as candidaturas de 2026 por posições documentadas, votações nominais e gastos declarados ao TSE. Sem viés, sem propaganda — toda afirmação tem fonte.";

/**
 * `meta` da raiz = padrão de todo o site.
 *
 * O <Meta> do React Router NÃO mescla rotas: ele percorre a cadeia de matches
 * e, quando um módulo de rota não exporta `meta`, copia o do ancestral mais
 * próximo (`leafMeta`, em react-router/dist/.../Meta). Era exatamente isso que
 * faltava — sem `meta` aqui, as 13 rotas MDX (cujo frontmatter YAML vira
 * `export const frontmatter`, que o React Router não lê) saíam sem <title>
 * nenhum, e 10 delas estão no sitemap.
 *
 * Este fallback é a rede de segurança: nenhuma rota, nem uma criada amanhã,
 * pode voltar a ficar sem título. As páginas com identidade própria continuam
 * exportando o seu `meta`, que substitui este por inteiro (não há merge — por
 * isso cada rota que quer Open Graph precisa declarar as suas próprias tags).
 *
 * Sem `og:image` de propósito: não existe imagem institucional em `public/`
 * (`public/images` está vazio) e apontar a tag para um arquivo inexistente
 * daria card quebrado no WhatsApp. `summary` é o formato correto de card sem
 * imagem grande; quem tem imagem de verdade — a página de candidato — declara
 * `summary_large_image` e o og:image apontando para /resources/og/:id.
 */
/**
 * Monta o conjunto padrão de tags de uma página sem imagem própria.
 *
 * Existe para que as 13 rotas MDX não repitam 13 vezes o mesmo bloco de
 * `og:*`/`twitter:*` — elas passam só o que é delas (título e resumo, ambos
 * lidos do próprio frontmatter) e o contrato de compartilhamento fica num
 * lugar só, onde não pode divergir entre arquivos.
 */
export function pageMeta({
  title,
  description = SITE_DESCRIPTION,
  type = "article",
}: {
  title: string;
  description?: string;
  type?: "website" | "article";
}) {
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: type },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "pt_BR" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
}

export function meta(): Route.MetaDescriptors {
  return pageMeta({
    title: `${SITE_NAME} | Vote com consciência`,
    type: "website",
  });
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@500;600;700;800&display=swap",
  },
];

/**
 * `<link rel="canonical">` de todas as páginas.
 *
 * Mora AQUI, no `Layout`, e não no `pageMeta()` acima, pela mesma propriedade
 * que aquele comentário descreve: `<Meta>` não mescla a cadeia de rotas — a
 * rota que exporta `meta` próprio SUBSTITUI o do ancestral por inteiro. Uma
 * canonical declarada no `meta` da raiz sumiria justamente nas rotas que têm
 * identidade própria, e qualquer rota criada amanhã nasceria sem ela. O
 * `Layout`, ao contrário, renderiza em toda rota por construção; nenhuma pode
 * escapar.
 *
 * A canonical é `origin + pathname`, sem query string, e isso é deliberado:
 * `/candidatos` sorteia a ordem a cada request (`shuffleSeed`) e aceita
 * filtros e busca na URL, então a mesma página existe sob dezenas de query
 * strings. Todas apontam para a URL sem parâmetros — a mesma que o
 * `sitemap.xml` declara. Somado aos 301 legados (`/busca`, `/politico/:id`,
 * `/artigos/:slug`, `/educacao/funcoes-vereador`), é o que faz sitemap,
 * redirects e páginas dizerem a mesma coisa.
 *
 * Sem `origin` não sai canonical: isso acontece quando o loader da raiz não
 * chegou a rodar, que é o caso de uma URL sem rota — e uma página 404 não deve
 * mesmo se declarar canônica de nada.
 */
function CanonicalLink() {
  const { pathname } = useLocation();
  const origin = useRouteLoaderData<typeof loader>("root")?.origin;
  if (!origin) return null;
  return <link rel="canonical" href={`${origin}${pathname}`} />;
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f8fafc" />
        <Meta />
        <CanonicalLink />
        <Links />
      </head>
      <body className="bg-slate-50 text-slate-800 antialiased">
        {children}
        <Toaster richColors position="bottom-center" closeButton />
        <ScrollRestoration />
        <Scripts />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

/**
 * Anuncia a CHEGADA do conteúdo diferido.
 *
 * O `SkeletonLoader` marca `<main aria-busy="true">` e traz um `role="status"`
 * que anuncia o INÍCIO do carregamento. Só que esse nó desaparece junto com o
 * esqueleto quando o `<Await>` resolve — e uma live region que não existia no
 * DOM antes da mudança não anuncia coisa alguma. Quem usa leitor de tela ouvia
 * "carregando…" e depois silêncio, sem saber que a página já estava pronta.
 *
 * Por isso a região vive aqui, FORA do `<Outlet />`: está montada desde o
 * primeiro render e sobrevive à troca esqueleto → conteúdo. O sinal é o
 * próprio `aria-busy` do `<main>`, que o esqueleto já publica — nada de
 * contrato novo entre os módulos.
 *
 * shortcut: o observer escuta o `<body>` inteiro porque o esqueleto é de
 * outro módulo e não expõe contexto; o callback só faz um `getElementById` —
 * upgrade: um contexto exportado pelo SkeletonLoader avisaria a raiz sem
 * tocar no DOM.
 */
function ContentArrivalAnnouncer() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const isBusy = () =>
      document.getElementById(MAIN_CONTENT_ID)?.getAttribute("aria-busy") ===
      "true";

    let busy = isBusy();
    const observer = new MutationObserver(() => {
      const now = isBusy();
      if (now === busy) return;
      busy = now;
      // Ao entrar em carregamento a mensagem é limpa: sem isso, dois
      // carregamentos seguidos escreveriam o mesmo texto e o segundo não
      // seria anunciado (a live region só fala quando o conteúdo muda).
      setMessage(now ? "" : "Conteúdo carregado.");
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-busy"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <SiteHeader />
      <Outlet />
      <ContentArrivalAnnouncer />
      <SiteFooter countdown={loaderData.countdown} />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Algo deu errado";
  let details =
    "Tivemos um problema inesperado ao carregar esta página. Tente novamente em instantes.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Página não encontrada";
      details =
        "O endereço que você abriu não existe ou foi movido. Os candidatos continuam em /candidatos.";
    } else if (error.status === 429) {
      title = "Muitas requisições";
      details =
        "Recebemos requisições demais deste endereço. Aguarde um minuto e recarregue a página.";
    } else {
      title = `Erro ${error.status}`;
      details = error.statusText || details;
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <SiteHeader />
      {/*
        A página de erro também precisa de <main>: o link "Pular para o
        conteúdo" do cabeçalho é renderizado aqui do mesmo jeito, e sem alvo
        ele caía no fallback `querySelector("main")` — que aqui não achava
        nada, deixando o primeiro foco tabulável da página sem destino.
      */}
      <main id={MAIN_CONTENT_ID} className="flex flex-1 flex-col">
        <Container className="flex flex-1 flex-col items-center justify-center gap-5 py-24 text-center">
          <h1 className="font-heading text-4xl font-bold tracking-[-0.02em] text-slate-800">
            {title}
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-slate-600">
            {details}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/candidatos"
              className="rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
            >
              Ver os candidatos
            </Link>
            <Link
              to="/"
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300"
            >
              Voltar ao início
            </Link>
          </div>
          {stack && (
            <pre className="mt-6 w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 text-left text-xs text-slate-600">
              <code>{stack}</code>
            </pre>
          )}
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
